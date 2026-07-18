import {
  DECK_PREFLIGHT_VERSION,
  type DeckIR,
  type DeckPreflightReport,
  type DeckPreflightSummary,
  type Diagnostic,
  type SlideIR,
  type SourceRange,
} from "@drever/schema";
import type { Root, RootContent } from "mdast";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { createDiagnostic } from "./diagnostics.ts";
import { createJsonSnapshot } from "./json-snapshot.ts";
import { parseDeck } from "./parse-deck.ts";
import { staticSlideTitle } from "./static-slide-title.ts";

export type PreflightDeckOptions = Readonly<{
  path?: string;
}>;

type MdxJsxElement = Extract<RootContent, { type: "mdxJsxFlowElement" | "mdxJsxTextElement" }>;
type MdxJsxNamedAttribute = Extract<
  MdxJsxElement["attributes"][number],
  { type: "mdxJsxAttribute" }
>;

type AnalyzedSlide = Readonly<{
  children: readonly RootContent[];
  slide: SlideIR;
  title?: Readonly<{
    normalized: string;
    source?: SourceRange;
    value: string;
  }>;
}>;

const parser = unified().use(remarkParse).use(remarkMdx);

const descendants = (node: RootContent): readonly RootContent[] =>
  "children" in node && Array.isArray(node.children) ? (node.children as RootContent[]) : [];

const isElement = (node: RootContent): node is MdxJsxElement =>
  node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement";

const sourceRange = (position: RootContent["position"], path: string): SourceRange | undefined => {
  if (position === undefined) {
    return;
  }
  const startOffset = position.start.offset;
  const endOffset = position.end.offset;
  if (startOffset === undefined || endOffset === undefined) {
    return;
  }
  return {
    path,
    start: { line: position.start.line, column: position.start.column, offset: startOffset },
    end: { line: position.end.line, column: position.end.column, offset: endOffset },
  };
};

const slideSourceRange = (slide: SlideIR): SourceRange | undefined => {
  const first = slide.fragments[0]?.range;
  const last = slide.fragments.at(-1)?.range;
  return first === undefined || last === undefined
    ? undefined
    : { path: first.path, start: first.start, end: last.end };
};

const isWithinSlide = (node: RootContent, slide: SlideIR): boolean => {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return (
    start !== undefined &&
    end !== undefined &&
    slide.fragments.some(({ range }) => start >= range.start.offset && end <= range.end.offset)
  );
};

const childrenForSlide = (tree: Root, slide: SlideIR): readonly RootContent[] =>
  tree.children.filter((node) => isWithinSlide(node, slide));

const walk = (children: readonly RootContent[], visit: (node: RootContent) => void): void => {
  for (const child of children) {
    if (isElement(child) && child.name === "Note") {
      continue;
    }
    visit(child);
    walk(descendants(child), visit);
  }
};

const namedAttributes = (node: MdxJsxElement, name: string): readonly MdxJsxNamedAttribute[] =>
  node.attributes.filter(
    (attribute): attribute is MdxJsxNamedAttribute =>
      attribute.type === "mdxJsxAttribute" && attribute.name === name,
  );

const staticStringValue = (attribute: MdxJsxNamedAttribute): string | undefined => {
  if (typeof attribute.value === "string") {
    return attribute.value;
  }
  const body =
    typeof attribute.value === "object" && attribute.value !== null
      ? attribute.value.data?.estree?.body
      : undefined;
  const statement = body?.length === 1 ? body[0] : undefined;
  const expression = statement?.type === "ExpressionStatement" ? statement.expression : undefined;
  const value = expression?.type === "Literal" ? expression.value : undefined;
  return typeof value === "string" ? value : undefined;
};

const isDynamicAttribute = (attribute: MdxJsxNamedAttribute): boolean => {
  if (
    typeof attribute.value === "string" ||
    attribute.value === null ||
    attribute.value === undefined
  ) {
    return false;
  }
  const body = attribute.value.data?.estree?.body;
  const statement = body?.length === 1 ? body[0] : undefined;
  const expression = statement?.type === "ExpressionStatement" ? statement.expression : undefined;
  return expression?.type !== "Literal";
};

const emptyAltDiagnostic = (
  node: RootContent | MdxJsxNamedAttribute,
  path: string,
  slideId: string,
): Diagnostic => {
  const range = sourceRange(node.position, path);
  return createDiagnostic(
    "DREVER_A11Y_IMAGE_ALT_EMPTY",
    "warning",
    "This image has empty alternative text.",
    {
      stage: "design",
      hint: 'Keep alt="" only when the image is purely decorative; otherwise describe the image purpose.',
      ...(range === undefined ? {} : { source: range }),
      slideId,
    },
  );
};

const inspectMarkdownImage = (
  node: Extract<RootContent, { type: "image" | "imageReference" }>,
  path: string,
  slideId: string,
  diagnostics: Diagnostic[],
): void => {
  if ((node.alt ?? "").trim().length === 0) {
    diagnostics.push(emptyAltDiagnostic(node, path, slideId));
  }
};

const inspectMdxImage = (
  node: MdxJsxElement,
  path: string,
  slideId: string,
  diagnostics: Diagnostic[],
): void => {
  const alternatives = namedAttributes(node, "alt");
  if (alternatives.length > 0) {
    for (const alternative of alternatives) {
      const value = staticStringValue(alternative);
      if (value !== undefined) {
        if (value.trim().length === 0) {
          diagnostics.push(emptyAltDiagnostic(alternative, path, slideId));
        }
        return;
      }
    }
    if (alternatives.some(isDynamicAttribute)) {
      return;
    }
  } else if (node.attributes.some((attribute) => attribute.type === "mdxJsxExpressionAttribute")) {
    return;
  }

  const range = sourceRange(node.position, path);
  diagnostics.push(
    createDiagnostic(
      "DREVER_A11Y_IMAGE_ALT_MISSING",
      "error",
      "The authored <img> element has no alt attribute.",
      {
        stage: "design",
        hint: 'Add concise alternative text, or use alt="" only for a purely decorative image.',
        ...(range === undefined ? {} : { source: range }),
        slideId,
      },
    ),
  );
};

const hasCaptionSource = (track: MdxJsxElement): boolean => {
  let usable = false;
  for (const attribute of track.attributes) {
    if (attribute.type === "mdxJsxExpressionAttribute") {
      usable = true;
      continue;
    }
    if (attribute.name !== "src") {
      continue;
    }
    const value = staticStringValue(attribute);
    usable = value === undefined ? isDynamicAttribute(attribute) : value.trim().length > 0;
  }
  return usable;
};

const hasStaticCaptionsTrack = (video: MdxJsxElement): boolean => {
  let found = false;
  walk(descendants(video), (node) => {
    if (!isElement(node) || node.name !== "track") {
      return;
    }
    found ||=
      hasCaptionSource(node) &&
      namedAttributes(node, "kind").some(
        (attribute) => staticStringValue(attribute)?.trim().toLowerCase() === "captions",
      );
  });
  return found;
};

const inspectVideo = (
  node: MdxJsxElement,
  path: string,
  slideId: string,
  diagnostics: Diagnostic[],
): void => {
  if (hasStaticCaptionsTrack(node)) {
    return;
  }
  const range = sourceRange(node.position, path);
  diagnostics.push(
    createDiagnostic(
      "DREVER_A11Y_VIDEO_CAPTIONS_MISSING",
      "warning",
      "The authored <video> element has no static captions track.",
      {
        stage: "design",
        hint: 'Add a <track kind="captions" src="..." /> child with a static kind attribute.',
        ...(range === undefined ? {} : { source: range }),
        slideId,
      },
    ),
  );
};

const inspectSlideContent = (
  { children, slide }: AnalyzedSlide,
  path: string,
  diagnostics: Diagnostic[],
): void => {
  let previousHeadingDepth: number | undefined;
  walk(children, (node) => {
    if (node.type === "heading") {
      if (previousHeadingDepth !== undefined && node.depth > previousHeadingDepth + 1) {
        const range = sourceRange(node.position, path);
        diagnostics.push(
          createDiagnostic(
            "DREVER_A11Y_HEADING_LEVEL_SKIPPED",
            "warning",
            `Heading level jumps from h${previousHeadingDepth} to h${node.depth}.`,
            {
              stage: "design",
              hint: `Use h${previousHeadingDepth + 1} here or introduce the missing intermediate level.`,
              ...(range === undefined ? {} : { source: range }),
              slideId: slide.id,
              details: { from: previousHeadingDepth, to: node.depth },
            },
          ),
        );
      }
      previousHeadingDepth = node.depth;
      return;
    }
    if (node.type === "image" || node.type === "imageReference") {
      inspectMarkdownImage(node, path, slide.id, diagnostics);
      return;
    }
    if (!isElement(node)) {
      return;
    }
    if (node.name === "img") {
      inspectMdxImage(node, path, slide.id, diagnostics);
    } else if (node.name === "video") {
      inspectVideo(node, path, slide.id, diagnostics);
    }
  });
};

const analyzeSlides = (deck: DeckIR, tree: Root, diagnostics: Diagnostic[]): void => {
  const analyzed: AnalyzedSlide[] = deck.slides.map((slide) => {
    const children = childrenForSlide(tree, slide);
    const inferred = staticSlideTitle(children);
    let title: AnalyzedSlide["title"];
    if (inferred !== undefined) {
      const range = sourceRange(inferred.position, deck.sourcePath);
      title = {
        normalized: inferred.title.normalize("NFKC").toLowerCase(),
        ...(range === undefined ? {} : { source: range }),
        value: inferred.title,
      };
    }
    if (title === undefined) {
      const range = slideSourceRange(slide);
      diagnostics.push(
        createDiagnostic(
          "DREVER_A11Y_SLIDE_TITLE_MISSING",
          "error",
          `Slide ${slide.index + 1} has no static title.`,
          {
            stage: "design",
            hint: "Add a static Markdown heading or a static aria-label, title, heading, or label prop to the slide layout.",
            ...(range === undefined ? {} : { source: range }),
            slideId: slide.id,
          },
        ),
      );
    }
    return { children, slide, ...(title === undefined ? {} : { title }) };
  });

  const firstTitle = new Map<string, AnalyzedSlide>();
  for (const entry of analyzed) {
    inspectSlideContent(entry, deck.sourcePath, diagnostics);
    if (entry.title === undefined) {
      continue;
    }
    const first = firstTitle.get(entry.title.normalized);
    if (first?.title === undefined) {
      firstTitle.set(entry.title.normalized, entry);
      continue;
    }
    diagnostics.push(
      createDiagnostic(
        "DREVER_A11Y_SLIDE_TITLE_DUPLICATE",
        "error",
        `Slide ${entry.slide.index + 1} repeats the static title "${entry.title.value}" from slide ${first.slide.index + 1}.`,
        {
          stage: "design",
          hint: "Give each slide a distinct title for navigation and assistive technology.",
          ...(entry.title.source === undefined ? {} : { source: entry.title.source }),
          slideId: entry.slide.id,
          details: { firstSlideId: first.slide.id, normalizedTitle: entry.title.normalized },
        },
      ),
    );
  }
};

const compareDiagnostics = (left: Diagnostic, right: Diagnostic): number => {
  const offsetDifference =
    (left.source?.start.offset ?? Number.MAX_SAFE_INTEGER) -
    (right.source?.start.offset ?? Number.MAX_SAFE_INTEGER);
  if (offsetDifference !== 0) {
    return offsetDifference;
  }
  if (left.code !== right.code) {
    return left.code < right.code ? -1 : 1;
  }
  const leftSlide = left.slideId ?? "";
  const rightSlide = right.slideId ?? "";
  return leftSlide === rightSlide ? 0 : leftSlide < rightSlide ? -1 : 1;
};

const summarize = (diagnostics: readonly Diagnostic[]): DeckPreflightSummary => ({
  errors: diagnostics.filter(({ severity }) => severity === "error").length,
  warnings: diagnostics.filter(({ severity }) => severity === "warning").length,
  info: diagnostics.filter(({ severity }) => severity === "info").length,
});

const report = (
  sourcePath: string,
  slideCount: number,
  diagnostics: readonly Diagnostic[],
): DeckPreflightReport => {
  const ordered = diagnostics.toSorted(compareDiagnostics);
  return createJsonSnapshot({
    version: DECK_PREFLIGHT_VERSION,
    sourcePath,
    slideCount,
    summary: summarize(ordered),
    diagnostics: ordered,
  });
};

/** Produces a deterministic accessibility and design report without compiling the deck. */
export const preflightDeck = (
  source: string,
  options: PreflightDeckOptions = {},
): DeckPreflightReport => {
  const parsed = parseDeck(source, options);
  const sourcePath = options.path ?? "slides.mdx";
  if (!parsed.ok) {
    return report(sourcePath, 0, parsed.diagnostics);
  }

  const diagnostics = [...parsed.diagnostics];
  const tree = parser.parse(source) as Root;
  analyzeSlides(parsed.value, tree, diagnostics);
  return report(parsed.value.sourcePath, parsed.value.slides.length, diagnostics);
};

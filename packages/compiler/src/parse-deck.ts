import {
  DECK_IR_VERSION,
  type DeckIR,
  type Diagnostic,
  type DiagnosticResult,
  type SlideIR,
  type SourceFragment,
  type SourcePoint,
  type SourceRange,
} from "@drever/schema";
import type { RootContent } from "mdast";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { createDiagnostic } from "./diagnostics.ts";

export type ParseDeckOptions = Readonly<{
  path?: string;
}>;

type OffsetRange = Readonly<{
  start: number;
  end: number;
}>;

type Segment = Readonly<{
  range: OffsetRange;
  exclusions: readonly OffsetRange[];
}>;

type PointLocator = (offset: number) => SourcePoint;

const parser = unified().use(remarkParse).use(remarkMdx);

const createPointLocator = (source: string): PointLocator => {
  const lineStarts = [0];
  for (let offset = 0; offset < source.length; offset += 1) {
    if (source[offset] === "\n") {
      lineStarts.push(offset + 1);
    }
  }

  return (offset) => {
    const normalizedOffset = Math.min(Math.max(offset, 0), source.length);
    let lower = 0;
    let upper = lineStarts.length;

    while (lower + 1 < upper) {
      const middle = Math.floor((lower + upper) / 2);
      if ((lineStarts[middle] ?? 0) <= normalizedOffset) {
        lower = middle;
      } else {
        upper = middle;
      }
    }

    const lineStart = lineStarts[lower] ?? 0;
    return {
      line: lower + 1,
      column: normalizedOffset - lineStart + 1,
      offset: normalizedOffset,
    };
  };
};

const sourceRange = (path: string, locate: PointLocator, range: OffsetRange): SourceRange => ({
  path,
  start: locate(range.start),
  end: locate(range.end),
});

const getOffsets = (node: RootContent): OffsetRange | undefined => {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined ? undefined : { start, end };
};

const isSlideSeparator = (node: RootContent, source: string, range: OffsetRange): boolean =>
  node.type === "thematicBreak" && source.slice(range.start, range.end).trim() === "---";

const ambiguousSeparatorRange = (
  node: RootContent,
  source: string,
  range: OffsetRange,
): OffsetRange | undefined => {
  if (node.type !== "heading" || node.depth !== 2) {
    return;
  }

  const value = source.slice(range.start, range.end);
  const lastLineStart = value.lastIndexOf("\n") + 1;
  const match = /^(\s{0,3})(---)[\t ]*$/u.exec(value.slice(lastLineStart));
  if (!match) {
    return;
  }

  const start = range.start + lastLineStart + (match[1]?.length ?? 0);
  return { start, end: start + 3 };
};

const subtractRanges = (range: OffsetRange, exclusions: readonly OffsetRange[]): OffsetRange[] => {
  const fragments: OffsetRange[] = [];
  let cursor = range.start;

  for (const exclusion of exclusions) {
    if (cursor < exclusion.start) {
      fragments.push({ start: cursor, end: exclusion.start });
    }
    cursor = Math.max(cursor, exclusion.end);
  }

  if (cursor < range.end) {
    fragments.push({ start: cursor, end: range.end });
  }

  return fragments;
};

const trimRanges = (source: string, ranges: readonly OffsetRange[]): OffsetRange[] => {
  const trimmed = ranges.map((range) => ({ ...range }));

  while (trimmed.length > 0) {
    const first = trimmed[0];
    if (!first) {
      break;
    }

    const value = source.slice(first.start, first.end);
    const contentOffset = value.search(/\S/u);
    if (contentOffset >= 0) {
      first.start += contentOffset;
      break;
    }
    trimmed.shift();
  }

  while (trimmed.length > 0) {
    const last = trimmed.at(-1);
    if (!last) {
      break;
    }

    const value = source.slice(last.start, last.end);
    const trailingWhitespace = value.match(/\s+$/u)?.[0].length ?? 0;
    if (trailingWhitespace < value.length) {
      last.end -= trailingWhitespace;
      break;
    }
    trimmed.pop();
  }

  return trimmed;
};

const sourceFragments = (
  segment: Segment,
  source: string,
  path: string,
  locate: PointLocator,
): SourceFragment[] =>
  trimRanges(source, subtractRanges(segment.range, segment.exclusions)).map((range) => ({
    value: source.slice(range.start, range.end),
    range: sourceRange(path, locate, range),
  }));

const createSlide = (
  segment: Segment,
  index: number,
  source: string,
  path: string,
  locate: PointLocator,
  diagnostics: Diagnostic[],
): SlideIR => {
  const id = `slide-${index + 1}`;
  const fragments = sourceFragments(segment, source, path, locate);

  if (fragments.length === 0) {
    diagnostics.push(
      createDiagnostic("DREVER_DECK_EMPTY_SLIDE", "warning", `Slide ${index + 1} is empty.`, {
        stage: "parse",
        hint: "Remove the extra slide separator or add slide content.",
        source: sourceRange(path, locate, {
          start: segment.range.start,
          end: segment.range.start,
        }),
        slideId: id,
      }),
    );
  }

  return {
    id,
    index,
    source: fragments.map((fragment) => fragment.value).join(""),
    fragments,
  };
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "The MDX source could not be parsed.";

const errorOffset = (error: unknown): number | undefined => {
  if (typeof error !== "object" || error === null || !("place" in error)) {
    return;
  }

  const { place } = error;
  if (typeof place !== "object" || place === null || !("offset" in place)) {
    return;
  }

  return typeof place.offset === "number" && Number.isSafeInteger(place.offset) && place.offset >= 0
    ? place.offset
    : undefined;
};

const missingPositionDiagnostic = (node: RootContent): Diagnostic =>
  createDiagnostic(
    "DREVER_INTERNAL_POSITION",
    "error",
    `The MDX parser returned a ${node.type} node without a source position.`,
    {
      stage: "parse",
      hint: "Please report this as a Drever compiler bug.",
    },
  );

export const parseDeck = (
  source: string,
  options: ParseDeckOptions = {},
): DiagnosticResult<DeckIR> => {
  const path = options.path ?? "slides.mdx";
  const locate = createPointLocator(source);
  let children: RootContent[];

  try {
    const tree = parser.parse(source);
    children = tree.children;
  } catch (error) {
    const offset = errorOffset(error) ?? 0;
    return {
      ok: false,
      diagnostics: [
        createDiagnostic("DREVER_MDX_PARSE", "error", errorMessage(error), {
          stage: "parse",
          hint: "Fix the MDX syntax and compile again.",
          source: sourceRange(path, locate, { start: offset, end: offset }),
        }),
      ],
    };
  }

  const diagnostics: Diagnostic[] = [];
  const preamble: SourceFragment[] = [];
  const segments: Segment[] = [];
  let segmentStart = 0;
  let exclusions: OffsetRange[] = [];

  for (const node of children) {
    const nodeRange = getOffsets(node);
    if (nodeRange) {
      const ambiguousRange = ambiguousSeparatorRange(node, source, nodeRange);
      if (ambiguousRange) {
        diagnostics.push(
          createDiagnostic(
            "DREVER_DECK_AMBIGUOUS_SEPARATOR",
            "warning",
            'This "---" is parsed as a Setext heading underline, not a slide separator.',
            {
              stage: "parse",
              hint: 'Add a blank line before "---" or write the heading with "##".',
              source: sourceRange(path, locate, ambiguousRange),
            },
          ),
        );
      }
    }

    if (node.type !== "mdxjsEsm" && node.type !== "thematicBreak") {
      continue;
    }

    const range = nodeRange;
    if (!range) {
      diagnostics.push(missingPositionDiagnostic(node));
      continue;
    }

    if (node.type === "mdxjsEsm") {
      preamble.push({
        value: source.slice(range.start, range.end),
        range: sourceRange(path, locate, range),
      });
      exclusions.push(range);
      continue;
    }

    if (isSlideSeparator(node, source, range)) {
      segments.push({ range: { start: segmentStart, end: range.start }, exclusions });
      segmentStart = range.end;
      exclusions = [];
    }
  }

  segments.push({ range: { start: segmentStart, end: source.length }, exclusions });

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { ok: false, diagnostics };
  }

  return {
    ok: true,
    value: {
      version: DECK_IR_VERSION,
      sourcePath: path,
      preamble,
      slides: segments.map((segment, index) =>
        createSlide(segment, index, source, path, locate, diagnostics),
      ),
    },
    diagnostics,
  };
};

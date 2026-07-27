/// <reference lib="dom" />

import { layout, prepare } from "@chenglou/pretext";

export type ExperimentalTextLayoutFinding = Readonly<{
  actualLineCount: number;
  actualOverflow: boolean;
  code: "DREVER_EXPERIMENTAL_TEXT_LAYOUT_RISK";
  contentHeight: number;
  contentWidth: number;
  element: ExperimentalTextLayoutTarget;
  predictedHeight: number;
  predictedLineCount: number;
  predictedOverflow: boolean;
  whiteSpace: "normal" | "pre-wrap";
}>;

export type ExperimentalTextLayoutMeasurement = Readonly<{
  actualLineCount: number;
  actualOverflow: boolean;
  contentHeight: number;
  contentWidth: number;
  element: ExperimentalTextLayoutTarget;
  predictedHeight: number;
  predictedLineCount: number;
  predictedOverflow: boolean;
  whiteSpace: "normal" | "pre-wrap";
}>;

export type ExperimentalTextLayoutReport = Readonly<{
  authority: "advisory";
  checked: number;
  experimental: true;
  findings: readonly ExperimentalTextLayoutFinding[];
  limitations: readonly string[];
  measurements: readonly ExperimentalTextLayoutMeasurement[];
  skipped: Readonly<Record<string, number>>;
  version: 1;
}>;

export type ExperimentalTextLayoutTarget = Readonly<{
  slideIndex?: number;
  sourcePath?: string;
  sourceRange?: string;
  tag: string;
  text: string;
}>;

const CANDIDATE_SELECTOR = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "li",
  "blockquote",
  "figcaption",
  "th",
  "td",
  "[data-drever-text-audit]",
].join(",");

const GENERIC_FONTS = new Set([
  "-apple-system",
  "blinkmacsystemfont",
  "cursive",
  "emoji",
  "fangsong",
  "fantasy",
  "math",
  "monospace",
  "sans-serif",
  "serif",
  "system-ui",
  "ui-monospace",
  "ui-rounded",
  "ui-sans-serif",
  "ui-serif",
]);

const LIMITATIONS = Object.freeze([
  "Pretext is not a full CSS inline-formatting or font-rendering engine.",
  "Rich inline markup, generated content, non-default wrapping or indentation, automatic hyphenation, columns, transforms, generic system fonts, and non-default word spacing or font shaping settings are skipped.",
  "Rendered DOM geometry and screenshots remain authoritative.",
] as const);

type Candidate =
  | Readonly<{ element: HTMLElement; kind: "ready"; style: CSSStyleDeclaration; text: string }>
  | Readonly<{ kind: "skip"; reason: string }>;

const number = (value: string): number | undefined => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const firstFontFamily = (fontFamily: string): string =>
  (fontFamily.split(",")[0] ?? "").trim().replace(/^(['"])(.*)\1$/u, "$2");

const hasGeneratedContent = (element: Element): boolean =>
  ["::before", "::after"].some((pseudo) => {
    const content = getComputedStyle(element, pseudo).content;
    return content !== "none" && content !== "normal" && content !== '""' && content !== "";
  });

const hasTransparentAncestor = (element: HTMLElement, root: ParentNode): boolean => {
  let ancestor = element.parentElement;
  while (ancestor !== null) {
    if ((number(getComputedStyle(ancestor).opacity) ?? 1) <= 0.001) return true;
    if (ancestor === root) break;
    ancestor = ancestor.parentElement;
  }
  return false;
};

const candidate = (element: Element, root: ParentNode): Candidate => {
  if (!(element instanceof HTMLElement)) {
    return { kind: "skip", reason: "non-html" };
  }
  const style = getComputedStyle(element);
  const bounds = element.getBoundingClientRect();
  if (
    element.hidden ||
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    style.display === "none" ||
    style.visibility !== "visible" ||
    number(style.opacity) === 0
  ) {
    return { kind: "skip", reason: "not-visible" };
  }
  if (hasTransparentAncestor(element, root)) {
    return { kind: "skip", reason: "transparent-ancestor" };
  }
  const source = element.textContent ?? "";
  const text = style.whiteSpace === "pre-wrap" ? source : source.trim();
  if (text.length === 0) {
    return { kind: "skip", reason: "empty" };
  }
  if (element.children.length > 0) {
    return { kind: "skip", reason: "rich-inline" };
  }
  if (hasGeneratedContent(element)) {
    return { kind: "skip", reason: "generated-content" };
  }
  if (style.writingMode !== "horizontal-tb") {
    return { kind: "skip", reason: "writing-mode" };
  }
  if (style.whiteSpace !== "normal" && style.whiteSpace !== "pre-wrap") {
    return { kind: "skip", reason: "white-space" };
  }
  if (style.wordBreak !== "normal" && style.wordBreak !== "keep-all") {
    return { kind: "skip", reason: "word-break" };
  }
  if (style.overflowWrap !== "normal" && style.overflowWrap !== "break-word") {
    return { kind: "skip", reason: "overflow-wrap" };
  }
  if (style.hyphens === "auto") {
    return { kind: "skip", reason: "hyphenation" };
  }
  const textWrapStyle = style.getPropertyValue("text-wrap-style");
  if (textWrapStyle !== "" && textWrapStyle !== "auto") {
    return { kind: "skip", reason: "text-wrap-style" };
  }
  const fontVariantEmoji = style.getPropertyValue("font-variant-emoji");
  if (
    style.columnCount !== "auto" ||
    style.fontKerning !== "auto" ||
    style.fontFeatureSettings !== "normal" ||
    style.fontVariantAlternates !== "normal" ||
    style.fontVariantCaps !== "normal" ||
    style.fontVariantEastAsian !== "normal" ||
    style.fontVariantLigatures !== "normal" ||
    style.fontVariantNumeric !== "normal" ||
    style.fontVariantPosition !== "normal" ||
    style.fontVariationSettings !== "normal" ||
    (fontVariantEmoji !== "" && fontVariantEmoji !== "normal") ||
    (number(style.textIndent) ?? 0) !== 0 ||
    style.textTransform !== "none" ||
    (style.wordSpacing !== "normal" && (number(style.wordSpacing) ?? Number.NaN) !== 0) ||
    (style.transform !== "none" && style.transform !== "") ||
    (style.scale !== "none" && style.scale !== "1" && style.scale !== "")
  ) {
    return { kind: "skip", reason: "font-or-transform" };
  }
  const tabSize = style.getPropertyValue("tab-size");
  if (style.whiteSpace === "pre-wrap" && tabSize !== "" && tabSize !== "8") {
    return { kind: "skip", reason: "tab-size" };
  }
  const family = firstFontFamily(style.fontFamily).toLowerCase();
  if (family.length === 0 || GENERIC_FONTS.has(family)) {
    return { kind: "skip", reason: "generic-font" };
  }
  if (number(style.fontSize) === undefined || number(style.lineHeight) === undefined) {
    return { kind: "skip", reason: "non-numeric-type-metrics" };
  }
  if (style.letterSpacing !== "normal" && number(style.letterSpacing) === undefined) {
    return { kind: "skip", reason: "non-numeric-letter-spacing" };
  }
  return { element, kind: "ready", style, text };
};

const contentSize = (
  element: HTMLElement,
  style: CSSStyleDeclaration,
): Readonly<{ height: number; width: number }> => ({
  height: Math.max(
    0,
    element.clientHeight - (number(style.paddingTop) ?? 0) - (number(style.paddingBottom) ?? 0),
  ),
  width: Math.max(
    0,
    element.clientWidth - (number(style.paddingLeft) ?? 0) - (number(style.paddingRight) ?? 0),
  ),
});

const renderedLineCount = (element: HTMLElement): number => {
  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  const lines: number[] = [];
  for (const bounds of range.getClientRects()) {
    if (bounds.width === 0 || bounds.height === 0) continue;
    if (!lines.some((top) => Math.abs(top - bounds.top) < 1)) {
      lines.push(bounds.top);
    }
  }
  range.detach();
  return lines.length;
};

const target = (element: HTMLElement, text: string): ExperimentalTextLayoutTarget => {
  const source = element.closest<HTMLElement>("[data-drever-dev-source-range]");
  const slideIndex = number(
    element.closest<HTMLElement>("[data-drever-slide]")?.dataset.slideIndex ?? "",
  );
  const sourcePath = source?.dataset.dreverDevSourcePath;
  const sourceRange = source?.dataset.dreverDevSourceRange;
  return Object.freeze({
    tag: element.tagName.toLowerCase(),
    text: text.replace(/\s+/gu, " ").trim().slice(0, 160),
    ...(slideIndex === undefined ? {} : { slideIndex }),
    ...(sourcePath === undefined ? {} : { sourcePath }),
    ...(sourceRange === undefined ? {} : { sourceRange }),
  });
};

const measure = ({
  element,
  style,
  text,
}: Extract<Candidate, { kind: "ready" }>): ExperimentalTextLayoutMeasurement => {
  const size = contentSize(element, style);
  const font = [
    style.fontStyle,
    style.fontWeight,
    style.fontStretch,
    style.fontSize,
    style.fontFamily,
  ]
    .filter((value) => value !== "" && value !== "normal")
    .join(" ");
  const lineHeight = number(style.lineHeight);
  if (lineHeight === undefined) {
    throw new TypeError("The candidate line height changed after validation.");
  }
  const letterSpacing = style.letterSpacing === "normal" ? 0 : number(style.letterSpacing);
  if (letterSpacing === undefined) {
    throw new TypeError("The candidate letter spacing changed after validation.");
  }
  const prediction = layout(
    prepare(text, font, {
      letterSpacing,
      whiteSpace: style.whiteSpace as "normal" | "pre-wrap",
      wordBreak: style.wordBreak as "normal" | "keep-all",
    }),
    size.width,
    lineHeight,
  );
  const actualLineCount = renderedLineCount(element);
  const tolerance = 1;
  const actualOverflow =
    element.scrollHeight > element.clientHeight + tolerance ||
    element.scrollWidth > element.clientWidth + tolerance;
  return Object.freeze({
    actualLineCount,
    actualOverflow,
    contentHeight: size.height,
    contentWidth: size.width,
    element: target(element, text),
    predictedHeight: prediction.height,
    predictedLineCount: prediction.lineCount,
    predictedOverflow: prediction.height > size.height + tolerance,
    whiteSpace: style.whiteSpace as "normal" | "pre-wrap",
  });
};

const settlePaint = async (document: Document): Promise<void> => {
  await document.fonts.ready;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};

/**
 * Runs an advisory Pretext pass over visible plain-text blocks.
 *
 * @experimental Rendered browser output remains the source of truth.
 */
export const auditExperimentalTextLayout = async (
  root: ParentNode = document,
): Promise<ExperimentalTextLayoutReport> => {
  const ownerDocument = root instanceof Document ? root : (root.ownerDocument ?? document);
  await settlePaint(ownerDocument);
  const skipped: Record<string, number> = {};
  const measurements: ExperimentalTextLayoutMeasurement[] = [];
  for (const element of root.querySelectorAll(CANDIDATE_SELECTOR)) {
    const slide = element.closest("[data-drever-slide]");
    if (slide === null && !element.hasAttribute("data-drever-text-audit")) {
      skipped["outside-slide"] = (skipped["outside-slide"] ?? 0) + 1;
      continue;
    }
    if (slide?.hasAttribute("hidden") === true) {
      skipped["inactive-slide"] = (skipped["inactive-slide"] ?? 0) + 1;
      continue;
    }
    const result = candidate(element, root);
    if (result.kind === "skip") {
      skipped[result.reason] = (skipped[result.reason] ?? 0) + 1;
      continue;
    }
    const measurement = measure(result);
    if (measurement.contentWidth <= 0 || measurement.contentHeight <= 0) {
      skipped["empty-content-box"] = (skipped["empty-content-box"] ?? 0) + 1;
      continue;
    }
    measurements.push(measurement);
  }
  const findings = measurements
    .filter(
      ({ actualLineCount, actualOverflow, predictedLineCount, predictedOverflow, whiteSpace }) =>
        actualOverflow ||
        predictedOverflow ||
        (whiteSpace === "normal" && actualLineCount !== predictedLineCount),
    )
    .map((measurement) =>
      Object.freeze({
        code: "DREVER_EXPERIMENTAL_TEXT_LAYOUT_RISK" as const,
        ...measurement,
      }),
    );
  return Object.freeze({
    authority: "advisory",
    checked: measurements.length,
    experimental: true,
    findings: Object.freeze(findings),
    limitations: LIMITATIONS,
    measurements: Object.freeze(measurements),
    skipped: Object.freeze(skipped),
    version: 1,
  });
};

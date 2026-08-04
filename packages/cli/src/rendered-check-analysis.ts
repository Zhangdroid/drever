import {
  RENDERED_PREFLIGHT_RULESET_VERSION,
  type Diagnostic,
  type JsonObject,
} from "@drever/schema";
import type {
  RenderedCheckElement,
  RenderedCheckFrame,
  RenderedCheckIssue,
  RenderedCheckRect,
} from "./rendered-check-browser.ts";

const GEOMETRY_TOLERANCE = 2;
const TEXT_SAFE_AREA_BLOCK_RATIO = 0.02;
const TEXT_SAFE_AREA_INLINE_RATIO = 0.015;
const TEXT_SAFE_AREA_MINIMUM = 6;

type FindingState = Readonly<{
  route: string;
  step: number;
}>;

const elementDetails = (element: RenderedCheckElement): JsonObject => {
  const source = element.source;
  return {
    key: element.key,
    label: element.label,
    tag: element.tag,
    ...(source === undefined
      ? {}
      : {
          sourceMapping: {
            precision: source.precision,
            range: source.range,
          },
        }),
  };
};

const frameDetails = (frame: RenderedCheckFrame): JsonObject => ({
  route: frame.route,
  ruleVersion: RENDERED_PREFLIGHT_RULESET_VERSION,
  slideIndex: frame.slide.index,
  step: frame.slide.step,
});

const diagnostic = (
  code: string,
  severity: Diagnostic["severity"],
  message: string,
  frame: RenderedCheckFrame,
  options: Readonly<{
    details?: JsonObject;
    element?: RenderedCheckElement;
    hint: string;
  }>,
): Diagnostic => ({
  code,
  severity,
  stage: "design",
  message,
  hint: options.hint,
  slideId: frame.slide.id,
  ...(options.element?.source?.precision === "exact"
    ? { source: options.element.source.range }
    : {}),
  details: { ...frameDetails(frame), ...options.details },
});

const issueCode = (issue: RenderedCheckIssue): string => {
  if (issue.type === "canvas-overflow") return "DREVER_RENDER_CANVAS_OVERFLOW";
  if (issue.type === "content-clipped") return "DREVER_RENDER_CONTENT_CLIPPED";
  if (issue.type === "content-overlap") return "DREVER_RENDER_CONTENT_OVERLAP";
  if (issue.type === "text-contrast-low") return "DREVER_RENDER_TEXT_CONTRAST_LOW";
  if (issue.type === "text-contrast-indeterminate") {
    return "DREVER_RENDER_TEXT_CONTRAST_INDETERMINATE";
  }
  return "DREVER_RENDER_RUNTIME_FAILED";
};

const issueKey = (frame: RenderedCheckFrame, issue: RenderedCheckIssue): string => {
  if (issue.type === "active-slide-count") return `${issue.type}:${frame.route}`;
  if (issue.type === "text-contrast-indeterminate") {
    return `${issue.type}:${issue.reason}`;
  }
  if (issue.type === "content-overlap") {
    return `${issue.type}:${frame.slide.id}:${issue.elements
      .map(({ key }) => key)
      .toSorted()
      .join(":")}`;
  }
  return `${issue.type}:${frame.slide.id}:${issue.element.key}`;
};

const issueDiagnostic = (
  frame: RenderedCheckFrame,
  issue: RenderedCheckIssue,
  states: readonly FindingState[],
): Diagnostic => {
  if (issue.type === "active-slide-count") {
    return diagnostic(
      issueCode(issue),
      "error",
      `Rendered route ${frame.route} exposed ${issue.actual} active slides instead of one.`,
      frame,
      {
        details: { actual: issue.actual, expected: issue.expected },
        hint: "Fix the presentation runtime or route before evaluating rendered layout.",
      },
    );
  }
  if (issue.type === "canvas-overflow") {
    return diagnostic(
      issueCode(issue),
      "error",
      `Visible ${issue.element.tag} content extends beyond the configured canvas on slide ${frame.slide.index + 1}.`,
      frame,
      {
        details: {
          element: elementDetails(issue.element),
          rect: issue.element.rect,
          states,
        },
        element: issue.element,
        hint: "Reposition or resize the content so its readable footprint remains inside the slide at every Step.",
      },
    );
  }
  if (issue.type === "content-clipped") {
    return diagnostic(
      issueCode(issue),
      "error",
      issue.evidence === "scroll-overflow"
        ? `Visible ${issue.element.tag} content exceeds its scroll surface on slide ${frame.slide.index + 1}.`
        : `A visible line or content fragment is clipped by a ${issue.owner.tag} surface on slide ${frame.slide.index + 1}.`,
      frame,
      {
        details: {
          element: elementDetails(issue.element),
          evidence: issue.evidence,
          owner: { key: issue.owner.key, tag: issue.owner.tag },
          ownerRect: issue.owner.rect,
          ...(issue.overflow === undefined ? {} : { overflow: issue.overflow }),
          rect: issue.element.rect,
          states,
        },
        element: issue.element,
        hint: "Give the content enough room or remove the unintended clipping boundary; do not hide required text.",
      },
    );
  }
  if (issue.type === "content-overlap") {
    const sourceElement =
      issue.elements.find(({ source }) => source?.precision === "exact") ?? issue.elements[0];
    return diagnostic(
      issueCode(issue),
      "error",
      `Readable content overlaps another independent element on slide ${frame.slide.index + 1}.`,
      frame,
      {
        details: {
          elements: issue.elements.map(elementDetails),
          intersection: issue.intersection,
          states,
        },
        element: sourceElement,
        hint: 'Separate the elements, or mark a deliberate overlap with data-drever-overlap="allow". Mark non-content artwork with data-drever-visual-role="decoration".',
      },
    );
  }
  if (issue.type === "text-contrast-low") {
    return diagnostic(
      issueCode(issue),
      "error",
      `Text contrast is ${issue.actual.toFixed(2)}:1 instead of at least ${issue.expected.toFixed(1)}:1 on slide ${frame.slide.index + 1}.`,
      frame,
      {
        details: {
          actual: issue.actual,
          background: issue.background,
          element: elementDetails(issue.element),
          expected: issue.expected,
          fontSize: issue.fontSize,
          fontWeight: issue.fontWeight,
          foreground: issue.foreground,
          largeText: issue.largeText,
          states,
        },
        element: issue.element,
        hint: "Increase the foreground/background contrast while preserving the intended hierarchy.",
      },
    );
  }
  return diagnostic(
    issueCode(issue),
    "warning",
    states.length === 1
      ? `Text contrast cannot be proven from solid computed colors on slide ${frame.slide.index + 1}.`
      : `Text contrast cannot be proven from solid computed colors in ${states.length} rendered states, starting on slide ${frame.slide.index + 1}.`,
    frame,
    {
      details: {
        element: elementDetails(issue.element),
        reason: issue.reason,
        states,
      },
      element: issue.element,
      hint: "Inspect this text against the rendered gradient, image, blend, or translucent surface; an indeterminate result is not a contrast pass.",
    },
  );
};

const analyzeIssues = (frames: readonly RenderedCheckFrame[]): Diagnostic[] => {
  const grouped = new Map<
    string,
    {
      frame: RenderedCheckFrame;
      issue: RenderedCheckIssue;
      states: FindingState[];
    }
  >();
  for (const frame of frames) {
    for (const issue of frame.issues) {
      const key = issueKey(frame, issue);
      const existing = grouped.get(key);
      const state = { route: frame.route, step: frame.slide.step };
      if (existing === undefined) {
        grouped.set(key, { frame, issue, states: [state] });
      } else {
        existing.states.push(state);
      }
    }
  }
  return [...grouped.values()].map(({ frame, issue, states }) =>
    issueDiagnostic(frame, issue, states),
  );
};

const geometryDelta = (
  before: RenderedCheckRect,
  after: RenderedCheckRect,
): Readonly<{ height: number; width: number; x: number; y: number }> => ({
  height: Math.round((after.height - before.height) * 10) / 10,
  width: Math.round((after.width - before.width) * 10) / 10,
  x: Math.round((after.x - before.x) * 10) / 10,
  y: Math.round((after.y - before.y) * 10) / 10,
});

const materialDelta = (delta: ReturnType<typeof geometryDelta>): boolean =>
  [delta.x, delta.y, delta.width, delta.height].some(
    (value) => Math.abs(value) > GEOMETRY_TOLERANCE,
  );

const analyzeGeometry = (frames: readonly RenderedCheckFrame[]): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];
  for (let index = 1; index < frames.length; index += 1) {
    const before = frames[index - 1] as RenderedCheckFrame;
    const after = frames[index] as RenderedCheckFrame;
    if (before.slide.id !== after.slide.id) continue;
    const beforeByKey = new Map(before.elements.map((element) => [element.key, element]));
    for (const element of after.elements) {
      const prior = beforeByKey.get(element.key);
      if (
        element.step !== undefined ||
        prior?.step !== undefined ||
        element.layout === null ||
        prior?.layout === null ||
        prior === undefined
      ) {
        continue;
      }
      const delta = geometryDelta(prior.layout, element.layout);
      if (!materialDelta(delta)) continue;
      diagnostics.push(
        diagnostic(
          "DREVER_RENDER_GEOMETRY_UNSTABLE",
          "warning",
          `Persistent ${element.tag} geometry changes between Steps ${before.slide.step} and ${after.slide.step} on slide ${after.slide.index + 1}.`,
          after,
          {
            details: {
              after: element.layout,
              before: prior.layout,
              delta,
              element: elementDetails(element),
              from: { route: before.route, step: before.slide.step },
              to: { route: after.route, step: after.slide.step },
            },
            element,
            hint: "Keep persistent content in a stable layout frame, or confirm that this reflow is an intentional part of the explanation.",
          },
        ),
      );
    }
  }
  return diagnostics;
};

type CanvasSide = "block-end" | "block-start" | "inline-end" | "inline-start";

const rounded = (value: number): number => Math.round(value * 10) / 10;

const safeAreaEvidence = (
  frame: RenderedCheckFrame,
  element: RenderedCheckElement,
):
  | Readonly<{
      clearance: Readonly<Record<CanvasSide, number>>;
      sides: readonly CanvasSide[];
      threshold: Readonly<{ block: number; inline: number }>;
    }>
  | undefined => {
  if (element.decorative || !element.textual) return;
  const canvas = frame.slide.rect;
  const rect = element.rect;
  if (
    rect.width <= 0 ||
    rect.height <= 0 ||
    rect.x < canvas.x ||
    rect.y < canvas.y ||
    rect.x + rect.width > canvas.x + canvas.width ||
    rect.y + rect.height > canvas.y + canvas.height
  ) {
    return;
  }
  const clearance = {
    "block-end": rounded(canvas.y + canvas.height - (rect.y + rect.height)),
    "block-start": rounded(rect.y - canvas.y),
    "inline-end": rounded(canvas.x + canvas.width - (rect.x + rect.width)),
    "inline-start": rounded(rect.x - canvas.x),
  };
  const threshold = {
    block: rounded(Math.max(TEXT_SAFE_AREA_MINIMUM, canvas.height * TEXT_SAFE_AREA_BLOCK_RATIO)),
    inline: rounded(Math.max(TEXT_SAFE_AREA_MINIMUM, canvas.width * TEXT_SAFE_AREA_INLINE_RATIO)),
  };
  const sides = (Object.keys(clearance) as CanvasSide[]).filter((side) =>
    side.startsWith("inline")
      ? clearance[side] < threshold.inline
      : clearance[side] < threshold.block,
  );
  return sides.length === 0 ? undefined : { clearance, sides, threshold };
};

const analyzeTextSafeArea = (frames: readonly RenderedCheckFrame[]): Diagnostic[] => {
  const grouped = new Map<
    string,
    {
      evidence: NonNullable<ReturnType<typeof safeAreaEvidence>>;
      frame: RenderedCheckFrame;
      element: RenderedCheckElement;
      states: FindingState[];
    }
  >();
  for (const frame of frames) {
    for (const element of frame.elements) {
      const evidence = safeAreaEvidence(frame, element);
      if (evidence === undefined) continue;
      const key = `${frame.slide.id}:${element.key}`;
      const state = { route: frame.route, step: frame.slide.step };
      const existing = grouped.get(key);
      if (existing === undefined) {
        grouped.set(key, { element, evidence, frame, states: [state] });
      } else {
        existing.states.push(state);
      }
    }
  }
  return [...grouped.values()].map(({ element, evidence, frame, states }) =>
    diagnostic(
      "DREVER_RENDER_TEXT_SAFE_AREA",
      "warning",
      `Readable ${element.tag} content hugs the canvas edge on slide ${frame.slide.index + 1}.`,
      frame,
      {
        details: {
          clearance: evidence.clearance,
          element: elementDetails(element),
          sides: evidence.sides,
          states,
          threshold: evidence.threshold,
        },
        element,
        hint: 'Move required text farther inside the canvas or add deliberate container padding. Full-bleed media may reach the edge; mark truly non-content text artwork with data-drever-visual-role="decoration".',
      },
    ),
  );
};

type DensitySignal = "line-fragments" | "semantic-elements" | "text-area";
type DensityState = FindingState &
  RenderedCheckFrame["density"] &
  Readonly<{ signals: readonly DensitySignal[] }>;

const DENSITY_SIGNAL_ORDER = Object.freeze([
  "text-area",
  "line-fragments",
  "semantic-elements",
] as const satisfies readonly DensitySignal[]);

const densitySignals = (frame: RenderedCheckFrame): readonly DensitySignal[] => {
  const signals: DensitySignal[] = [];
  if (frame.density.textAreaRatio >= 0.42) signals.push("text-area");
  if (frame.density.lineFragmentCount >= 30) signals.push("line-fragments");
  if (frame.density.semanticElementCount >= 30) signals.push("semantic-elements");
  return signals;
};

const analyzeDensity = (frames: readonly RenderedCheckFrame[]): Diagnostic[] => {
  const grouped = new Map<
    string,
    {
      frame: RenderedCheckFrame;
      signals: Set<DensitySignal>;
      states: DensityState[];
    }
  >();
  for (const frame of frames) {
    const signals = densitySignals(frame);
    if (signals.length < 2) continue;
    const state = {
      route: frame.route,
      step: frame.slide.step,
      signals,
      ...frame.density,
    };
    const existing = grouped.get(frame.slide.id);
    if (existing === undefined) {
      grouped.set(frame.slide.id, {
        frame,
        signals: new Set(signals),
        states: [state],
      });
    } else {
      existing.states.push(state);
      for (const signal of signals) existing.signals.add(signal);
    }
  }
  return [...grouped.values()].map(({ frame, signals, states }) => {
    const orderedSignals = DENSITY_SIGNAL_ORDER.filter((signal) => signals.has(signal));
    const maximum = {
      characterCount: Math.max(...states.map(({ characterCount }) => characterCount)),
      lineFragmentCount: Math.max(...states.map(({ lineFragmentCount }) => lineFragmentCount)),
      semanticElementCount: Math.max(
        ...states.map(({ semanticElementCount }) => semanticElementCount),
      ),
      textAreaRatio: Math.max(...states.map(({ textAreaRatio }) => textAreaRatio)),
    };
    return diagnostic(
      "DREVER_RENDER_DENSITY_HIGH",
      "warning",
      `Slide ${frame.slide.index + 1} has multiple rendered density signals in ${states.length} Step ${states.length === 1 ? "state" : "states"}.`,
      frame,
      {
        details: {
          maximum,
          signals: orderedSignals,
          states,
        },
        hint: "Review the slide at presentation distance and remove, stage, or move supporting detail into notes when focus is unclear.",
      },
    );
  });
};

const compareDiagnostics = (left: Diagnostic, right: Diagnostic): number => {
  const slide = (left.details?.slideIndex as number) - (right.details?.slideIndex as number);
  if (Number.isFinite(slide) && slide !== 0) return slide;
  const step = (left.details?.step as number) - (right.details?.step as number);
  if (Number.isFinite(step) && step !== 0) return step;
  const source =
    (left.source?.start.offset ?? Number.MAX_SAFE_INTEGER) -
    (right.source?.start.offset ?? Number.MAX_SAFE_INTEGER);
  if (source !== 0) return source;
  return left.code.localeCompare(right.code);
};

/** Converts browser evidence into deterministic product diagnostics. */
export const analyzeRenderedCheckFrames = (
  frames: readonly RenderedCheckFrame[],
): readonly Diagnostic[] =>
  [
    ...analyzeIssues(frames),
    ...analyzeTextSafeArea(frames),
    ...analyzeGeometry(frames),
    ...analyzeDensity(frames),
  ].toSorted(compareDiagnostics);

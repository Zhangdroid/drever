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
  return "DREVER_RENDER_RUNTIME_FAILED";
};

const issueKey = (frame: RenderedCheckFrame, issue: RenderedCheckIssue): string =>
  issue.type === "active-slide-count"
    ? `${issue.type}:${frame.route}`
    : `${issue.type}:${frame.slide.id}:${issue.element.key}`;

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
  return diagnostic(
    issueCode(issue),
    "error",
    `Visible ${issue.element.tag} content is clipped by a ${issue.owner.tag} surface on slide ${frame.slide.index + 1}.`,
    frame,
    {
      details: {
        element: elementDetails(issue.element),
        owner: { key: issue.owner.key, tag: issue.owner.tag },
        ownerRect: issue.owner.rect,
        rect: issue.element.rect,
        states,
      },
      element: issue.element,
      hint: "Give the content enough room or remove the unintended clipping boundary; do not hide required text.",
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
  [...analyzeIssues(frames), ...analyzeGeometry(frames), ...analyzeDensity(frames)].toSorted(
    compareDiagnostics,
  );

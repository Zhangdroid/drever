import {
  RENDERED_PREFLIGHT_RULESET_VERSION,
  type Diagnostic,
  type JsonObject,
} from "@drever/schema";
import type { RenderedPostTransitionEntrance } from "./rendered-motion-browser.ts";

const sourceDetails = (finding: RenderedPostTransitionEntrance): JsonObject => {
  const source = finding.element.source;
  return source === undefined
    ? {}
    : {
        sourceMapping: {
          precision: source.precision,
          range: source.range,
        },
      };
};

/** Converts high-confidence transition timing evidence into stable design diagnostics. */
export const analyzeRenderedPostTransitionEntrances = (
  findings: readonly RenderedPostTransitionEntrance[],
): readonly Diagnostic[] =>
  [...findings]
    .toSorted((left, right) => {
      const slide = left.to.slideIndex - right.to.slideIndex;
      return slide === 0 ? left.to.route.localeCompare(right.to.route) : slide;
    })
    .map((finding): Diagnostic => {
      const source = finding.element.source;
      return {
        code: "DREVER_RENDER_POST_TRANSITION_ENTRANCE",
        severity: "error",
        stage: "design",
        slideId: finding.slideId,
        ...(source?.precision === "exact" ? { source: source.range } : {}),
        message: `A visible ${finding.element.tag} payload starts another entrance after the document transition on slide ${String(finding.to.slideIndex + 1)}.`,
        hint: "Give this handoff one motion owner. Remove the delayed mount/active entrance from document-captured content, or use a local SlideTransition and keep the payload hidden until its live entrance begins.",
        details: {
          animation: finding.animation,
          edge: {
            direction: finding.direction,
            from: finding.from,
            to: finding.to,
          },
          element: {
            key: finding.element.key,
            label: finding.element.label,
            tag: finding.element.tag,
            ...sourceDetails(finding),
          },
          route: finding.to.route,
          ruleVersion: RENDERED_PREFLIGHT_RULESET_VERSION,
          sampledAtMilliseconds: finding.sampledAtMilliseconds,
          slideIndex: finding.to.slideIndex,
          step: finding.to.step,
        },
      };
    });

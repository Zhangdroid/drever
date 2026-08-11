import type { SourceRange } from "@drever/schema";
import { describe, expect, it } from "vite-plus/test";
import { analyzeRenderedPostTransitionEntrances } from "./rendered-motion-analysis.ts";
import type { RenderedPostTransitionEntrance } from "./rendered-motion-browser.ts";

const source = Object.freeze({
  path: "/deck/slides.mdx",
  start: { column: 1, line: 12, offset: 180 },
  end: { column: 11, line: 14, offset: 238 },
} satisfies SourceRange);

const finding = Object.freeze({
  animation: {
    activeStartMilliseconds: 410,
    delayMilliseconds: 320,
    documentFinishMilliseconds: 330,
    durationMilliseconds: 180,
    entranceProperties: ["opacity", "transform"],
    fill: "forwards",
    name: "payload-enter",
  },
  direction: "forward",
  element: {
    key: "section:0",
    label: "Approve the direction",
    source: { precision: "exact", range: source },
    tag: "section",
  },
  from: { route: "/", slideIndex: 0, step: 0 },
  sampledAtMilliseconds: 80,
  slideId: "approval",
  to: { route: "/2", slideIndex: 1, step: 0 },
} satisfies RenderedPostTransitionEntrance);

describe("rendered post-transition entrance analysis", () => {
  it("turns timing evidence into a stable, source-owned error", () => {
    expect(analyzeRenderedPostTransitionEntrances([finding])).toEqual([
      expect.objectContaining({
        code: "DREVER_RENDER_POST_TRANSITION_ENTRANCE",
        severity: "error",
        slideId: "approval",
        source,
        stage: "design",
        details: expect.objectContaining({
          animation: finding.animation,
          edge: {
            direction: "forward",
            from: finding.from,
            to: finding.to,
          },
          route: "/2",
          sampledAtMilliseconds: 80,
          slideIndex: 1,
          step: 0,
        }),
      }),
    ]);
  });

  it("returns no diagnostics without browser evidence", () => {
    expect(analyzeRenderedPostTransitionEntrances([])).toEqual([]);
  });
});

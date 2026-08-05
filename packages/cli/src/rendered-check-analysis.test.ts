import { describe, expect, it } from "vite-plus/test";
import type { SourceRange } from "@drever/schema";
import { analyzeRenderedCheckFrames } from "./rendered-check-analysis.ts";
import type {
  RenderedCheckBackground,
  RenderedCheckElement,
  RenderedCheckFrame,
  RenderedCheckSource,
} from "./rendered-check-browser.ts";

const rect = (x = 0, y = 0, width = 200, height = 80) => ({ height, width, x, y });
const sourceRange: SourceRange = {
  path: "/deck/slides.mdx",
  start: { column: 1, line: 3, offset: 18 },
  end: { column: 10, line: 3, offset: 27 },
};

const element = (
  key: string,
  layout = rect(),
  options: Readonly<{ source?: RenderedCheckSource; step?: number }> = {},
): RenderedCheckElement => ({
  decorative: false,
  fragments: [layout],
  key,
  label: key,
  layout,
  rect: layout,
  ...(options.source === undefined ? {} : { source: options.source }),
  ...(options.step === undefined ? {} : { step: options.step }),
  tag: "h2",
  textual: true,
});

const frame = (
  step: number,
  options: Readonly<{
    density?: RenderedCheckFrame["density"];
    background?: RenderedCheckBackground;
    elements?: readonly RenderedCheckElement[];
    issues?: RenderedCheckFrame["issues"];
  }> = {},
): RenderedCheckFrame => ({
  ...(options.background === undefined ? {} : { background: options.background }),
  density: options.density ?? {
    characterCount: 30,
    lineFragmentCount: 2,
    semanticElementCount: 2,
    textAreaRatio: 0.08,
  },
  elements: options.elements ?? [],
  issues: options.issues ?? [],
  route: step === 0 ? "/" : `/1/${String(step)}`,
  slide: { id: "intro", index: 0, rect: rect(0, 0, 1600, 900), step },
});

const background = (
  options: Readonly<{
    canvasColor?: string;
    localFromNext?: boolean;
    localFromPrevious?: boolean;
    image?: string;
    local?: boolean;
    offset?: string;
    stage?: boolean;
  }> = {},
): RenderedCheckBackground => {
  const color = "rgb(8 17 31)";
  const image = options.image ?? "linear-gradient(rgb(8 17 31), rgb(8 17 31))";
  return {
    canvas: { color: options.canvasColor ?? "rgb(255, 255, 255)", image: "none" },
    covers:
      options.stage === true
        ? []
        : [
            {
              color,
              image,
              key: "section:0",
              rect: rect(0, 0, 1600, 900),
              signature: `${color}|${image}`,
              source: { precision: "exact", range: sourceRange },
              tag: "section",
            },
          ],
    stageBasePresent: options.stage ?? false,
    transition: {
      entryAnimation: "drever-slide-cover",
      fromNext: options.local === true || options.localFromNext === true ? "local" : "document",
      fromPrevious:
        options.local === true || options.localFromPrevious === true ? "local" : "document",
      slideOffset: options.offset ?? "2.5%",
    },
  };
};

describe("rendered check analysis", () => {
  it("aggregates repeated clipping evidence across exact Step states", () => {
    const clipped = element("title");
    const owner = { key: "div:0", rect: rect(0, 0, 120, 40), tag: "div" };
    const diagnostics = analyzeRenderedCheckFrames([
      frame(0, {
        issues: [{ element: clipped, evidence: "line-fragment", owner, type: "content-clipped" }],
      }),
      frame(2, {
        issues: [{ element: clipped, evidence: "line-fragment", owner, type: "content-clipped" }],
      }),
    ]);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: "DREVER_RENDER_CONTENT_CLIPPED",
      severity: "error",
      details: {
        states: [
          { route: "/", step: 0 },
          { route: "/1/2", step: 2 },
        ],
      },
    });
  });

  it("ignores subpixel noise but reports material persistent Step reflow", () => {
    const stable = analyzeRenderedCheckFrames([
      frame(0, { elements: [element("title", rect(100, 80))] }),
      frame(1, { elements: [element("title", rect(101.5, 81.5))] }),
    ]);
    const shifted = analyzeRenderedCheckFrames([
      frame(0, { elements: [element("title", rect(100, 80))] }),
      frame(1, { elements: [element("title", rect(100, 86))] }),
    ]);

    expect(stable).toEqual([]);
    expect(shifted).toMatchObject([
      {
        code: "DREVER_RENDER_GEOMETRY_UNSTABLE",
        severity: "warning",
        details: { delta: { x: 0, y: 6 } },
      },
    ]);
  });

  it("does not treat the entering Step payload as persistent geometry", () => {
    const diagnostics = analyzeRenderedCheckFrames([
      frame(0, { elements: [element("finding", rect(100, 80), { step: 2 })] }),
      frame(2, { elements: [element("finding", rect(300, 180), { step: 2 })] }),
    ]);

    expect(diagnostics).toEqual([]);
  });

  it("warns only when readable text hugs a conservative canvas safe area", () => {
    const diagnostics = analyzeRenderedCheckFrames([
      frame(0, {
        elements: [
          element("edge-title", rect(8, 120, 360, 80)),
          element("settled-copy", rect(24, 18, 360, 80)),
          { ...element("edge-art", rect(0, 0, 1600, 900)), tag: "img", textual: false },
        ],
      }),
    ]);

    expect(diagnostics).toMatchObject([
      {
        code: "DREVER_RENDER_TEXT_SAFE_AREA",
        severity: "warning",
        details: {
          clearance: {
            "block-start": 120,
            "inline-start": 8,
          },
          sides: ["inline-start"],
          threshold: { block: 18, inline: 24 },
        },
      },
    ]);
  });

  it("ignores explicitly decorative edge text in safe-area analysis", () => {
    const decoration = { ...element("folio", rect(0, 0, 200, 40)), decorative: true };

    expect(analyzeRenderedCheckFrames([frame(0, { elements: [decoration] })])).toEqual([]);
  });

  it("requires at least two language-neutral density signals", () => {
    const oneSignal = analyzeRenderedCheckFrames([
      frame(0, {
        density: {
          characterCount: 900,
          lineFragmentCount: 31,
          semanticElementCount: 8,
          textAreaRatio: 0.2,
        },
      }),
    ]);
    const twoSignals = analyzeRenderedCheckFrames([
      frame(0, {
        density: {
          characterCount: 900,
          lineFragmentCount: 31,
          semanticElementCount: 8,
          textAreaRatio: 0.43,
        },
      }),
    ]);

    expect(oneSignal).toEqual([]);
    expect(twoSignals).toMatchObject([
      {
        code: "DREVER_RENDER_DENSITY_HIGH",
        severity: "warning",
        details: { signals: ["text-area", "line-fragments"] },
      },
    ]);
  });

  it("aggregates density evidence across Step states", () => {
    const diagnostics = analyzeRenderedCheckFrames([
      frame(0, {
        density: {
          characterCount: 500,
          lineFragmentCount: 31,
          semanticElementCount: 8,
          textAreaRatio: 0.44,
        },
      }),
      frame(2, {
        density: {
          characterCount: 700,
          lineFragmentCount: 34,
          semanticElementCount: 32,
          textAreaRatio: 0.46,
        },
      }),
    ]);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: "DREVER_RENDER_DENSITY_HIGH",
      details: {
        maximum: {
          characterCount: 700,
          lineFragmentCount: 34,
          semanticElementCount: 32,
          textAreaRatio: 0.46,
        },
        signals: ["text-area", "line-fragments", "semantic-elements"],
        states: [
          { route: "/", step: 0 },
          { route: "/1/2", step: 2 },
        ],
      },
    });
  });

  it("only promotes exact element mappings to diagnostic source locations", () => {
    const owner = { key: "div:0", rect: rect(0, 0, 120, 40), tag: "div" };
    const exact = analyzeRenderedCheckFrames([
      frame(0, {
        issues: [
          {
            element: element("exact", rect(), {
              source: { precision: "exact", range: sourceRange },
            }),
            evidence: "line-fragment",
            owner,
            type: "content-clipped",
          },
        ],
      }),
    ]);
    const ancestor = analyzeRenderedCheckFrames([
      frame(0, {
        issues: [
          {
            element: element("ancestor", rect(), {
              source: { precision: "ancestor", range: sourceRange },
            }),
            evidence: "line-fragment",
            owner,
            type: "content-clipped",
          },
        ],
      }),
    ]);

    expect(exact[0]).toMatchObject({
      source: sourceRange,
      details: {
        element: {
          sourceMapping: { precision: "exact", range: sourceRange },
        },
      },
    });
    expect(ancestor[0]?.source).toBeUndefined();
    expect(ancestor[0]).toMatchObject({
      details: {
        element: {
          sourceMapping: { precision: "ancestor", range: sourceRange },
        },
      },
    });
  });

  it("preserves direct scroll-overflow evidence", () => {
    const overflowing = element("scrolling-copy", rect(), {
      source: { precision: "exact", range: sourceRange },
    });
    const diagnostics = analyzeRenderedCheckFrames([
      frame(0, {
        issues: [
          {
            element: overflowing,
            evidence: "scroll-overflow",
            overflow: { x: 84, y: 0 },
            owner: { key: overflowing.key, rect: rect(), tag: "p" },
            type: "content-clipped",
          },
        ],
      }),
    ]);

    expect(diagnostics).toMatchObject([
      {
        code: "DREVER_RENDER_CONTENT_CLIPPED",
        severity: "error",
        source: sourceRange,
        details: {
          evidence: "scroll-overflow",
          overflow: { x: 84, y: 0 },
        },
      },
    ]);
  });

  it("aggregates a high-confidence content overlap across Step states", () => {
    const first = element("decision", rect(100, 100, 300, 60), {
      source: { precision: "exact", range: sourceRange },
    });
    const second = element("evidence", rect(220, 120, 300, 60));
    const overlap = {
      elements: [first, second] as const,
      intersection: rect(220, 120, 180, 40),
      type: "content-overlap" as const,
    };
    const diagnostics = analyzeRenderedCheckFrames([
      frame(0, { issues: [overlap] }),
      frame(2, { issues: [overlap] }),
    ]);

    expect(diagnostics).toMatchObject([
      {
        code: "DREVER_RENDER_CONTENT_OVERLAP",
        severity: "error",
        source: sourceRange,
        details: {
          elements: [{ key: "decision" }, { key: "evidence" }],
          states: [
            { route: "/", step: 0 },
            { route: "/1/2", step: 2 },
          ],
        },
      },
    ]);
  });

  it("reports resolved low contrast and aggregates repeated states", () => {
    const copy = element("supporting-copy", rect(), {
      source: { precision: "exact", range: sourceRange },
    });
    const lowContrast = {
      actual: 2.32,
      background: "rgb(255 255 255)",
      element: copy,
      expected: 4.5,
      fontSize: 16,
      fontWeight: 400,
      foreground: "rgb(174 174 174)",
      largeText: false,
      type: "text-contrast-low" as const,
    };
    const diagnostics = analyzeRenderedCheckFrames([
      frame(0, { issues: [lowContrast] }),
      frame(2, { issues: [lowContrast] }),
    ]);

    expect(diagnostics).toMatchObject([
      {
        code: "DREVER_RENDER_TEXT_CONTRAST_LOW",
        severity: "error",
        source: sourceRange,
        details: {
          actual: 2.32,
          expected: 4.5,
          largeText: false,
          states: [
            { route: "/", step: 0 },
            { route: "/1/2", step: 2 },
          ],
        },
      },
    ]);
  });

  it("marks image and gradient contrast as indeterminate instead of passing it", () => {
    const copy = element("gradient-copy", rect());
    const diagnostics = analyzeRenderedCheckFrames([
      frame(0, {
        issues: [
          {
            element: copy,
            reason: "background-image-or-gradient",
            type: "text-contrast-indeterminate",
          },
        ],
      }),
    ]);

    expect(diagnostics).toMatchObject([
      {
        code: "DREVER_RENDER_TEXT_CONTRAST_INDETERMINATE",
        severity: "warning",
        details: { reason: "background-image-or-gradient" },
      },
    ]);
  });

  it("summarizes repeated indeterminate contrast by reason", () => {
    const first = element("gradient-copy", rect());
    const second = element("gradient-copy-2", rect());
    const issue = (copy: RenderedCheckElement) => ({
      element: copy,
      reason: "background-image-or-gradient",
      type: "text-contrast-indeterminate" as const,
    });
    const diagnostics = analyzeRenderedCheckFrames([
      frame(0, { issues: [issue(first)] }),
      {
        ...frame(0, { issues: [issue(second)] }),
        route: "/2",
        slide: { id: "second", index: 1, rect: rect(), step: 0 },
      },
    ]);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: "DREVER_RENDER_TEXT_CONTRAST_INDETERMINATE",
      details: {
        reason: "background-image-or-gradient",
        states: [
          { route: "/", step: 0 },
          { route: "/2", step: 0 },
        ],
      },
    });
  });

  it("never compares persistent geometry across different slides", () => {
    const first = frame(0, { elements: [element("title", rect(100, 80))] });
    const second = {
      ...frame(0, { elements: [element("title", rect(400, 300))] }),
      route: "/2",
      slide: { ...first.slide, id: "second", index: 1 },
    };

    expect(analyzeRenderedCheckFrames([first, second])).toEqual([]);
  });

  it("blocks a repeated full-canvas background owned by spatial deck transitions", () => {
    const first = frame(0, { background: background() });
    const second = {
      ...frame(0, { background: background() }),
      route: "/2",
      slide: { ...first.slide, id: "second", index: 1 },
    };

    expect(analyzeRenderedCheckFrames([first, second])).toMatchObject([
      {
        code: "DREVER_RENDER_BACKGROUND_TRANSITIONED",
        severity: "error",
        source: sourceRange,
        details: {
          edges: [
            {
              directions: ["forward", "reverse"],
              from: { route: "/", step: 0 },
              to: { route: "/2", step: 0 },
            },
          ],
        },
      },
    ]);
  });

  it("accepts a Stage-owned, local, or visually stable canvas background", () => {
    const pair = (nextBackground: RenderedCheckBackground) => {
      const first = frame(0, { background: nextBackground });
      const second = {
        ...frame(0, { background: nextBackground }),
        route: "/2",
        slide: { ...first.slide, id: "second", index: 1 },
      };
      return analyzeRenderedCheckFrames([first, second]);
    };

    expect(pair(background({ stage: true }))).toEqual([]);
    expect(pair(background({ local: true }))).toEqual([]);
    expect(pair(background({ image: "none", canvasColor: "rgb(8 17 31)" }))).toEqual([]);
  });

  it("evaluates asymmetric local transitions independently in both directions", () => {
    const diagnostics = (
      firstBackground: RenderedCheckBackground,
      secondBackground: RenderedCheckBackground,
    ) => {
      const first = frame(0, { background: firstBackground });
      const second = {
        ...frame(0, { background: secondBackground }),
        route: "/2",
        slide: { ...first.slide, id: "second", index: 1 },
      };
      return analyzeRenderedCheckFrames([first, second]);
    };

    expect(diagnostics(background(), background({ localFromPrevious: true }))).toMatchObject([
      {
        code: "DREVER_RENDER_BACKGROUND_TRANSITIONED",
        details: { edges: [{ directions: ["reverse"] }] },
      },
    ]);
    expect(diagnostics(background({ localFromNext: true }), background())).toMatchObject([
      {
        code: "DREVER_RENDER_BACKGROUND_TRANSITIONED",
        details: { edges: [{ directions: ["forward"] }] },
      },
    ]);
    expect(
      diagnostics(background({ localFromNext: true }), background({ localFromPrevious: true })),
    ).toEqual([]);

    expect(
      diagnostics(
        background({ image: "none" }),
        background({ canvasColor: "rgb(8 17 31)", image: "none" }),
      ),
    ).toMatchObject([
      {
        code: "DREVER_RENDER_BACKGROUND_TRANSITIONED",
        details: { edges: [{ directions: ["reverse"] }] },
      },
    ]);
  });

  it("still blocks moving slide paint above an unrelated stationary Stage base", () => {
    const movingOverStage = { ...background(), stageBasePresent: true };
    const first = frame(0, { background: movingOverStage });
    const second = {
      ...frame(0, { background: movingOverStage }),
      route: "/2",
      slide: { ...first.slide, id: "second", index: 1 },
    };

    expect(analyzeRenderedCheckFrames([first, second])).toMatchObject([
      { code: "DREVER_RENDER_BACKGROUND_TRANSITIONED", severity: "error" },
    ]);
  });

  it("points to repeated image paint before a source-less flat root", () => {
    const gradient = background().covers[0] as RenderedCheckBackground["covers"][number];
    const flat: RenderedCheckBackground["covers"][number] = {
      color: gradient.color,
      image: "none",
      key: "",
      rect: gradient.rect,
      signature: `${gradient.color}|none`,
      tag: gradient.tag,
    };
    const layered = { ...background(), covers: [flat, gradient] };
    const first = frame(0, { background: layered });
    const second = {
      ...frame(0, { background: layered }),
      route: "/2",
      slide: { ...first.slide, id: "second", index: 1 },
    };

    expect(analyzeRenderedCheckFrames([first, second])).toMatchObject([
      {
        code: "DREVER_RENDER_BACKGROUND_TRANSITIONED",
        details: { background: { image: gradient.image, key: gradient.key } },
        source: sourceRange,
      },
    ]);
  });
});

import { describe, expect, it } from "vite-plus/test";
import type { SourceRange } from "@drever/schema";
import { analyzeRenderedCheckFrames } from "./rendered-check-analysis.ts";
import type {
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
  key,
  label: key,
  layout,
  rect: layout,
  ...(options.source === undefined ? {} : { source: options.source }),
  ...(options.step === undefined ? {} : { step: options.step }),
  tag: "h2",
});

const frame = (
  step: number,
  options: Readonly<{
    density?: RenderedCheckFrame["density"];
    elements?: readonly RenderedCheckElement[];
    issues?: RenderedCheckFrame["issues"];
  }> = {},
): RenderedCheckFrame => ({
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

describe("rendered check analysis", () => {
  it("aggregates repeated clipping evidence across exact Step states", () => {
    const clipped = element("title");
    const owner = { key: "div:0", rect: rect(0, 0, 120, 40), tag: "div" };
    const diagnostics = analyzeRenderedCheckFrames([
      frame(0, { issues: [{ element: clipped, owner, type: "content-clipped" }] }),
      frame(2, { issues: [{ element: clipped, owner, type: "content-clipped" }] }),
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

  it("never compares persistent geometry across different slides", () => {
    const first = frame(0, { elements: [element("title", rect(100, 80))] });
    const second = {
      ...frame(0, { elements: [element("title", rect(400, 300))] }),
      route: "/2",
      slide: { ...first.slide, id: "second", index: 1 },
    };

    expect(analyzeRenderedCheckFrames([first, second])).toEqual([]);
  });
});

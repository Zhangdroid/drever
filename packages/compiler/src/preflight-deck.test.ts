import { DECK_PREFLIGHT_VERSION } from "@drever/schema";
import { describe, expect, it } from "vite-plus/test";
import { preflightDeck } from "./preflight-deck.ts";

const expectDeeplyFrozen = (value: unknown): void => {
  if (typeof value !== "object" || value === null) {
    return;
  }
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) {
    expectDeeplyFrozen(child);
  }
};

describe("deck accessibility preflight", () => {
  it("returns a deeply frozen JSON report for a clean deck", () => {
    const report = preflightDeck(
      `# Opening

## Context

![A diagram of the presentation pipeline](/pipeline.png)

<video src="/demo.mp4">
  <track kind={"captions"} src="/demo.vtt" />
</video>

---

<Statement aria-label="Closing thought" />`,
      { path: "talk.mdx" },
    );

    expect(report).toEqual({
      version: DECK_PREFLIGHT_VERSION,
      sourcePath: "talk.mdx",
      slideCount: 2,
      summary: { errors: 0, warnings: 0, info: 0 },
      diagnostics: [],
    });
    expectDeeplyFrozen(report);
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });

  it("warns when a slide has no provable static title and keeps its exact range", () => {
    const source = "A paragraph without a title.";
    const report = preflightDeck(source, { path: "untitled.mdx" });

    expect(report.diagnostics).toMatchObject([
      {
        code: "DREVER_A11Y_SLIDE_TITLE_MISSING",
        severity: "error",
        stage: "design",
        slideId: "slide-1",
        source: {
          path: "untitled.mdx",
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: source.length + 1, offset: source.length },
        },
      },
    ]);
  });

  it("normalizes case and whitespace before reporting a duplicate title", () => {
    const source = "# Repeat   Me\n\n---\n\n# repeat me";
    const report = preflightDeck(source, { path: "duplicates.mdx" });

    expect(report.diagnostics).toMatchObject([
      {
        code: "DREVER_A11Y_SLIDE_TITLE_DUPLICATE",
        severity: "error",
        slideId: "slide-2",
        details: { firstSlideId: "slide-1", normalizedTitle: "repeat me" },
        source: {
          path: "duplicates.mdx",
          start: { offset: source.lastIndexOf("# repeat me") },
          end: { offset: source.length },
        },
      },
    ]);
  });

  it("distinguishes decorative empty alt text from a missing native MDX alt", () => {
    const source = `# Media

![](/decorative.png)

<img src="/diagram.png" />

<img src="/ornament.png" alt="" />

<Image src="/component-owned.png" />

<img src="/dynamic-alt.png" alt={imageAlt} />

<img {...imageProps} />`;
    const report = preflightDeck(source, { path: "media.mdx" });

    expect(report.diagnostics.map(({ code, severity }) => ({ code, severity }))).toEqual([
      { code: "DREVER_A11Y_IMAGE_ALT_EMPTY", severity: "warning" },
      { code: "DREVER_A11Y_IMAGE_ALT_MISSING", severity: "error" },
      { code: "DREVER_A11Y_IMAGE_ALT_EMPTY", severity: "warning" },
    ]);
    expect(report.diagnostics[0]).toMatchObject({
      slideId: "slide-1",
      source: { path: "media.mdx", start: { offset: source.indexOf("![]") } },
      hint: expect.stringContaining("purely decorative"),
    });
    expect(report.diagnostics[1]).toMatchObject({
      source: { start: { offset: source.indexOf('<img src="/diagram.png"') } },
    });
    expect(report.summary).toEqual({ errors: 1, warnings: 2, info: 0 });
  });

  it("reports a heading level jump at the later heading", () => {
    const source = "# Outline\n\n### Skipped level";
    const report = preflightDeck(source, { path: "headings.mdx" });

    expect(report.diagnostics).toMatchObject([
      {
        code: "DREVER_A11Y_HEADING_LEVEL_SKIPPED",
        severity: "warning",
        slideId: "slide-1",
        details: { from: 1, to: 3 },
        source: {
          path: "headings.mdx",
          start: { line: 3, column: 1, offset: source.indexOf("###") },
        },
      },
    ]);
  });

  it("warns only for native videos without a static captions track", () => {
    const report = preflightDeck(`# Demo

<video src="/silent.mp4" />

<video src="/dynamic.mp4"><track kind={trackKind} /></video>

<Video src="/component-owned.mp4" />`);

    expect(report.diagnostics.map(({ code }) => code)).toEqual([
      "DREVER_A11Y_VIDEO_CAPTIONS_MISSING",
      "DREVER_A11Y_VIDEO_CAPTIONS_MISSING",
    ]);
    expect(report.diagnostics.every(({ slideId }) => slideId === "slide-1")).toBe(true);
  });

  it("requires a usable source without guessing dynamic caption URLs", () => {
    const report = preflightDeck(`# Tracks

<video><track kind="captions" /></video>

<video><track kind="captions" src="" /></video>

<video><track kind="captions" src="/captions.vtt" /></video>

<video><track kind="captions" src={captionsSource} /></video>

<video><track kind="captions" {...captionTrack} /></video>

<video><track kind="captions" {...captionTrack} src="" /></video>

<video><track kind="captions" src="" {...captionTrack} /></video>`);

    expect(report.diagnostics.map(({ code }) => code)).toEqual([
      "DREVER_A11Y_VIDEO_CAPTIONS_MISSING",
      "DREVER_A11Y_VIDEO_CAPTIONS_MISSING",
      "DREVER_A11Y_VIDEO_CAPTIONS_MISSING",
    ]);
    expect(report.summary).toEqual({ errors: 0, warnings: 3, info: 0 });
  });

  it("returns parse failures as a versioned report instead of throwing", () => {
    const report = preflightDeck("# Broken\n\n<Component", { path: "broken.mdx" });

    expect(report).toMatchObject({
      version: DECK_PREFLIGHT_VERSION,
      sourcePath: "broken.mdx",
      slideCount: 0,
      summary: { errors: 1, warnings: 0, info: 0 },
      diagnostics: [
        {
          code: "DREVER_MDX_PARSE",
          severity: "error",
          stage: "parse",
          source: {
            path: "broken.mdx",
            start: { line: 3, column: 11, offset: 20 },
            end: { line: 3, column: 11, offset: 20 },
          },
        },
      ],
    });
    expectDeeplyFrozen(report);
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });

  it("excludes speaker-note content from title inference and accessibility rules", () => {
    const report = preflightDeck(`<Note>
# Speaker-only title

### Speaker-only jump

![](/speaker-only.png)

<img src="/speaker-only-mdx.png" />
</Note>

Visible body without a title.`);

    expect(report.diagnostics.map(({ code }) => code)).toEqual(["DREVER_A11Y_SLIDE_TITLE_MISSING"]);
  });
});

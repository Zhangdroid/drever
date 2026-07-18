import { Slide, Step, type MDXContent } from "@drever/core";
import { DECK_MANIFEST_VERSION, type DeckManifest } from "@drever/schema";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { DeckDocument } from "./document-view.tsx";

const manifest = {
  version: DECK_MANIFEST_VERSION,
  slides: [
    { id: "intro", index: 0, speakerNotes: [], stepStops: [], title: "Introduction" },
    { id: "demo", index: 1, speakerNotes: [], stepStops: [2, 7] },
  ],
} as const satisfies DeckManifest;

const Content: MDXContent = () =>
  createElement(
    Fragment,
    {},
    createElement(Slide, { id: "intro", index: 0 }, "Opening claim"),
    createElement(
      Slide,
      { id: "demo", index: 1 },
      createElement(Step, { at: 2 }, "Evidence"),
      createElement(Step, { at: 7 }, "Decision"),
    ),
  );

describe("DeckDocument", () => {
  it("renders every slide as a named, fully revealed landmark with a table of contents", () => {
    const markup = renderToStaticMarkup(
      createElement(DeckDocument, {
        audienceURL: "https://slides.test/talk/",
        Content,
        canvas: { height: 720, width: 1_280 },
        documentURL: "https://slides.test/talk/document?theme=dark",
        manifest,
      }),
    );

    expect(markup).toContain('data-drever-document=""');
    expect(markup).toContain("--drever-canvas-width:1280");
    expect(markup).toContain('href="https://slides.test/talk/"');
    expect(markup).toContain('href="https://slides.test/talk/document?theme=dark#intro"');
    expect(markup).toContain('href="https://slides.test/talk/document?theme=dark#demo"');
    expect(markup).toContain('id="intro"');
    expect(markup).toContain('aria-label="Introduction"');
    expect(markup).toContain('id="demo"');
    expect(markup).toContain('aria-label="Slide 2"');
    expect(markup).toContain('data-current-step="7"');
    expect(markup).toContain('data-step-state="complete"');
    expect(markup).toContain('data-step-state="active"');
    expect(markup).not.toContain("aria-current");
    expect(markup).not.toContain("aria-hidden");
    expect(markup).not.toContain("inert");
  });
});

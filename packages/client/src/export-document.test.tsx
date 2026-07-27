import { Slide, Step, type MDXContent } from "@drever/core";
import { DECK_MANIFEST_VERSION, type DeckManifest } from "@drever/schema";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { ExportDocument } from "./export-document.tsx";

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
    createElement(Slide, { id: "intro", index: 0 }, "Introduction"),
    createElement(
      Slide,
      { id: "demo", index: 1 },
      createElement(Step, { at: 2 }, "Second state"),
      createElement(Step, { at: 7 }, "Final state"),
    ),
  );

describe("ExportDocument", () => {
  it("renders one isolated active slide for each raw canvas-sized page", () => {
    const markup = renderToStaticMarkup(
      createElement(ExportDocument, {
        Content,
        canvas: { width: 1280, height: 720 },
        manifest,
        pages: [
          { slideId: "intro", slideIndex: 0, step: 0 },
          { slideId: "demo", slideIndex: 1, step: 2 },
          { slideId: "demo", slideIndex: 1, step: 7 },
        ],
      }),
    );

    expect(markup).toContain('class="drever-export-document drever-viewer"');
    expect(markup).toContain('data-drever-export-document=""');
    expect(markup).toContain('data-canvas-width="1280"');
    expect(markup).toContain('data-canvas-height="720"');
    expect(markup).toContain('data-page-count="3"');
    for (const role of ["handwritten", "sans", "serif"]) {
      for (const locale of ["ja", "ko", "zh-hans", "zh-hant"]) {
        expect(markup).toContain(`--drever-theme-font-cjk-${role}-${locale}:`);
      }
    }
    expect(markup).toContain(
      "--drever-theme-font-cjk-sans-zh-hans:&quot;Heiti SC&quot;, &quot;Microsoft YaHei&quot;, &quot;Noto Sans CJK SC&quot;",
    );
    expect(markup).toContain(
      "--drever-theme-font-cjk-sans-ja:&quot;Hiragino Kaku Gothic ProN&quot;, &quot;Yu Gothic&quot;, Meiryo",
    );
    expect(markup).toContain(
      "--drever-theme-font-cjk-serif-zh-hant:&quot;Songti TC&quot;, &quot;LiSong Pro&quot;, PMingLiU",
    );
    expect(markup).toContain(
      "--drever-theme-font-cjk-handwritten-ko:&quot;Nanum Pen Script&quot;, &quot;Nanum Brush Script&quot;, &quot;Apple SD Gothic Neo&quot;",
    );
    expect(markup.match(/data-drever-export-page=""/g)).toHaveLength(3);
    expect(markup).toContain(
      'aria-labelledby="drever-export-page-1-label" class="drever-export-page"',
    );
    expect(markup).toContain(
      'class="drever-visually-hidden" dir="ltr" id="drever-export-page-1-label" lang="en">Slide 1, Step 0</span>',
    );
    expect(markup).not.toContain('aria-label="Slide ');
    expect(markup.match(/>Introduction</g)).toHaveLength(1);
    expect(markup).toContain('id="drever-export-page-2-demo"');
    expect(markup).toContain('id="drever-export-page-3-demo"');
    expect(markup.match(/data-slide-id="demo"/g)).toHaveLength(6);
    expect(markup.match(/data-drever-stage=""/g)).toHaveLength(3);
    expect(markup).toContain('data-page-number="2" data-slide-id="demo"');
    expect(markup).toContain('data-current-step="2"');
    expect(markup).toContain('data-current-step="7"');
  });
});

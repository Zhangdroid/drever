import { Slide, Step, type MDXContent } from "@drever/core";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { ExportDocument } from "./export-document.tsx";

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
    expect(markup.match(/data-drever-export-page=""/g)).toHaveLength(3);
    expect(markup.match(/>Introduction</g)).toHaveLength(1);
    expect(markup).toContain('id="drever-export-page-2-demo"');
    expect(markup).toContain('id="drever-export-page-3-demo"');
    expect(markup.match(/data-slide-id="demo"/g)).toHaveLength(4);
    expect(markup).toContain('data-page-number="2" data-slide-id="demo"');
    expect(markup).toContain('data-current-step="2"');
    expect(markup).toContain('data-current-step="7"');
  });
});

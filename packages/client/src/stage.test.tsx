import { DECK_MANIFEST_VERSION, type DeckManifest } from "@drever/schema";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { DreverClientError } from "./client-error.ts";
import {
  PresentationStage,
  useStage,
  type StageComponents,
  type StageLayerProps,
} from "./stage.tsx";

const manifest = {
  version: DECK_MANIFEST_VERSION,
  slides: [
    { id: "intro", index: 0, speakerNotes: [], stepStops: [] },
    { id: "details", index: 1, speakerNotes: [], stepStops: [2] },
  ],
} as const satisfies DeckManifest;

const Background = (): ReactElement => {
  const { position, renderMode } = useStage();
  return <span data-mode={renderMode}>Background for {position.slideId}</span>;
};

const Foreground = ({ manifest: deck, position }: StageLayerProps): ReactElement => (
  <span>
    {position.slideIndex + 1} / {deck.slides.length}
  </span>
);

const stage = { background: Background, foreground: Foreground } satisfies StageComponents;

describe("PresentationStage", () => {
  it("owns stable background, content, and foreground slots with exact presentation state", () => {
    const markup = renderToStaticMarkup(
      <PresentationStage
        canvas={{ width: 1280, height: 720 }}
        manifest={manifest}
        position={{ slideId: "details", slideIndex: 1, step: 2 }}
        reducedMotion={false}
        renderMode="audience"
        stage={stage}
      >
        <main>Slide content</main>
      </PresentationStage>,
    );

    const background = markup.indexOf('data-drever-stage-layer="background"');
    const content = markup.indexOf('data-drever-stage-layer="content"');
    const foreground = markup.indexOf('data-drever-stage-layer="foreground"');
    expect(background).toBeGreaterThan(-1);
    expect(background).toBeLessThan(content);
    expect(content).toBeLessThan(foreground);
    expect(markup).toContain('data-slide-id="details"');
    expect(markup).toContain('data-current-step="2"');
    expect(markup).toContain('data-page-number="2"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('inert=""');
    expect(markup).toContain('data-mode="audience"');
    expect(markup).toContain("Background for details");
    expect(markup).toContain("2 / 2");
  });

  it("fails at the component boundary when useStage has no stage provider", () => {
    let failure: unknown;
    try {
      renderToStaticMarkup(createElement(Background));
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(DreverClientError);
    expect(failure).toMatchObject({ code: "DREVER_CLIENT_STAGE_CONTEXT_MISSING" });
  });
});

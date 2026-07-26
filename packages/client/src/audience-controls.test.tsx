import { DECK_MANIFEST_VERSION, type DeckManifest } from "@drever/schema";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  AudienceControls,
  readSlideNavigationItems,
  resolveAudienceProgress,
  SlideOverviewItem,
} from "./audience-controls.tsx";
import { createPresentationFocusStore } from "./presentation-focus-store.ts";

const manifest = {
  version: DECK_MANIFEST_VERSION,
  slides: [
    { id: "intro", index: 0, speakerNotes: [], stepStops: [] },
    { id: "details", index: 1, speakerNotes: [], stepStops: [2, 5] },
    { id: "end", index: 2, speakerNotes: [], stepStops: [] },
  ],
} as const satisfies DeckManifest;

describe("audience controls", () => {
  it("describes slide and sparse Step progress at the deck edges", () => {
    expect(resolveAudienceProgress(manifest, { slideId: "intro", slideIndex: 0, step: 0 })).toEqual(
      {
        canGoNext: true,
        canGoPrevious: false,
        slideLabel: "Slide 1 of 3",
      },
    );
    expect(
      resolveAudienceProgress(manifest, { slideId: "details", slideIndex: 1, step: 2 }),
    ).toEqual({
      canGoNext: true,
      canGoPrevious: true,
      slideLabel: "Slide 2 of 3",
      stepLabel: "Step 1 of 2",
    });
    expect(resolveAudienceProgress(manifest, { slideId: "end", slideIndex: 2, step: 0 })).toEqual({
      canGoNext: false,
      canGoPrevious: true,
      slideLabel: "Slide 3 of 3",
    });
  });

  it("builds concise navigator labels from authored semantics before using a fallback", () => {
    const elements = [
      {
        getAttribute: (name: string) => (name === "aria-label" ? "  Opening claim  " : null),
        querySelector: () => ({ getAttribute: () => null, textContent: "Ignored heading" }),
      },
      {
        getAttribute: () => null,
        querySelector: () => ({
          getAttribute: () => null,
          textContent: "  A sparse\nStep story  ",
        }),
      },
      {
        getAttribute: () => null,
        querySelector: () => null,
      },
    ];
    const deck = {
      querySelector: (selector: string) => elements[Number(selector.match(/index="(\d+)"/u)?.[1])],
    } as unknown as ParentNode;

    const items = readSlideNavigationItems(deck, manifest);

    expect(items).toEqual([
      { id: "intro", index: 0, title: "Opening claim" },
      { id: "details", index: 1, title: "A sparse Step story" },
      { id: "end", index: 2, title: "Slide 3" },
    ]);
    expect(Object.isFrozen(items)).toBe(true);
    expect(items.every(Object.isFrozen)).toBe(true);
  });

  it("keeps the authored manifest spacing when visual heading fragments collapse together", () => {
    const titledManifest = {
      ...manifest,
      slides: [
        {
          ...manifest.slides[0],
          title: "One source. Every surface agrees.",
        },
      ],
    } satisfies DeckManifest;
    const deck = {
      querySelector: () => ({
        getAttribute: () => null,
        querySelector: () => ({
          getAttribute: () => null,
          textContent: "One source.Every surface agrees.",
        }),
      }),
    } as unknown as ParentNode;

    expect(readSlideNavigationItems(deck, titledManifest)).toEqual([
      {
        id: "intro",
        index: 0,
        title: "One source. Every surface agrees.",
      },
    ]);
  });

  it("renders a discoverable accessible command surface outside the deck", () => {
    const markup = renderToStaticMarkup(
      <AudienceControls
        canvas={{ height: 1080, width: 1920 }}
        canvasRef={{ current: null }}
        deckRef={{ current: null }}
        manifest={manifest}
        onCopyShareURL={vi.fn()}
        onError={vi.fn()}
        onNavigate={vi.fn()}
        onOpenDocument={vi.fn()}
        onOpenSpeaker={vi.fn()}
        position={{ slideId: "intro", slideIndex: 0, step: 0 }}
        remoteFocus={createPresentationFocusStore({ slideId: "intro", slideIndex: 0, step: 0 })}
        renderSlidePreview={() => <div data-preview="" />}
      />,
    );

    expect(markup).toContain('aria-label="Presentation controls"');
    expect(markup).toContain('aria-label="Open slide navigator"');
    expect(markup).toContain('aria-label="Copy link to current presentation state"');
    expect(markup).toContain('aria-label="Open document view"');
    expect(markup).toContain('aria-label="Open speaker view"');
    expect(markup).toContain('aria-label="Mobile viewing options"');
    expect(markup).toContain('aria-label="Read presentation as a document"');
    expect(markup).toContain('aria-label="Dismiss mobile viewing hint"');
    expect(markup).toContain('aria-label="Open focus tools"');
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).toContain('aria-label="Enter fullscreen"');
    expect(markup).toContain('data-drever-tooltip="Enter fullscreen · F"');
    expect(markup).not.toContain(" title=");
    expect(markup).toContain("Slide 1 of 3");
    expect(markup).toMatch(/aria-label="Previous presentation state"[^>]*disabled/u);
  });

  it("defers an inert visual preview and keeps navigation outside its surface", () => {
    const renderPreview = vi.fn(() => <a href="https://example.com/">Authored link</a>);
    const markup = renderToStaticMarkup(
      <SlideOverviewItem
        canvas={{ height: 900, width: 1600 }}
        current
        onSelect={vi.fn()}
        previewRoot={{ current: null }}
        renderPreview={renderPreview}
        slide={{ id: "intro", index: 0, title: "Opening claim" }}
      />,
    );

    expect(markup).toContain('data-drever-slide-preview=""');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('inert=""');
    expect(markup).toContain('style="aspect-ratio:1600 / 900"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('aria-label="Go to slide 1: Opening claim"');
    expect(renderPreview).not.toHaveBeenCalled();
    expect(markup.indexOf('data-drever-slide-preview=""')).toBeLessThan(markup.indexOf("<button"));
  });
});

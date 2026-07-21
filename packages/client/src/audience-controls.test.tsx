import { DECK_MANIFEST_VERSION, type DeckManifest } from "@drever/schema";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  AudienceControls,
  readSlideNavigationItems,
  resolveAudienceProgress,
} from "./audience-controls.tsx";
import { createPresentationLaserStore } from "./presentation-laser.ts";

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
        querySelector: () => ({ textContent: "Ignored heading" }),
      },
      {
        getAttribute: () => null,
        querySelector: () => ({ textContent: "  A sparse\nStep story  " }),
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
        remoteLaser={createPresentationLaserStore()}
      />,
    );

    expect(markup).toContain('aria-label="Presentation controls"');
    expect(markup).toContain('aria-label="Open slide navigator"');
    expect(markup).toContain('aria-label="Copy link to current presentation state"');
    expect(markup).toContain('aria-label="Open document view"');
    expect(markup).toContain('aria-label="Open speaker view"');
    expect(markup).toContain('aria-label="Open focus tools"');
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).toContain('aria-label="Enter fullscreen"');
    expect(markup).toContain('data-drever-tooltip="Enter fullscreen · F"');
    expect(markup).not.toContain(" title=");
    expect(markup).toContain("Slide 1 of 3");
    expect(markup).toMatch(/aria-label="Previous presentation state"[^>]*disabled/u);
  });
});

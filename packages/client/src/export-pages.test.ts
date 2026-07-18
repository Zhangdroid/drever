import { DECK_MANIFEST_VERSION, type DeckManifest } from "@drever/schema";
import { describe, expect, it } from "vite-plus/test";
import { planExportPages } from "./export-pages.ts";

const manifest = {
  version: DECK_MANIFEST_VERSION,
  slides: [
    { id: "intro", index: 0, speakerNotes: [], stepStops: [] },
    { id: "demo", index: 1, speakerNotes: [], stepStops: [1, 4, 9] },
  ],
} as const satisfies DeckManifest;

describe("PDF export page planning", () => {
  it("exports one fully revealed page per slide by default", () => {
    expect(planExportPages(manifest)).toEqual([
      { slideId: "intro", slideIndex: 0, step: 0 },
      { slideId: "demo", slideIndex: 1, step: 9 },
    ]);
  });

  it("exports the initial state and every authored sparse Step stop when requested", () => {
    const pages = planExportPages(manifest, { includeSteps: true });

    expect(pages).toEqual([
      { slideId: "intro", slideIndex: 0, step: 0 },
      { slideId: "demo", slideIndex: 1, step: 0 },
      { slideId: "demo", slideIndex: 1, step: 1 },
      { slideId: "demo", slideIndex: 1, step: 4 },
      { slideId: "demo", slideIndex: 1, step: 9 },
    ]);
    expect(Object.isFrozen(pages)).toBe(true);
    expect(pages.every(Object.isFrozen)).toBe(true);
  });
});

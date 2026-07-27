import type { MDXContent } from "@drever/core";
import { DECK_MANIFEST_VERSION, type DeckManifest } from "@drever/schema";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { createPresentationFocusStore } from "./presentation-focus-store.ts";
import { createPresentationStateMachine, createPresentationStore } from "./presentation-state.ts";
import { createRehearsalStore } from "./rehearsal.ts";
import {
  filterSpeakerSlides,
  formatSpeakerElapsedTime,
  nextSpeakerPosition,
  Speaker,
} from "./speaker.tsx";

const manifest = {
  version: DECK_MANIFEST_VERSION,
  slides: [
    { id: "intro", index: 0, speakerNotes: [], stepStops: [2, 5], title: "Opening claim" },
    { id: "end", index: 1, speakerNotes: [], stepStops: [], title: "Closing thought" },
  ],
} as const satisfies DeckManifest;

describe("speaker view state", () => {
  it("formats a monotonic presentation timer without wrapping at one hour", () => {
    expect(formatSpeakerElapsedTime(-1)).toBe("00:00:00");
    expect(formatSpeakerElapsedTime(3_723_999)).toBe("01:02:03");
  });

  it("previews the exact sparse navigation stop the next command will reach", () => {
    const machine = createPresentationStateMachine(manifest);

    expect(nextSpeakerPosition(machine, machine.initialPosition)).toEqual({
      slideId: "intro",
      slideIndex: 0,
      step: 2,
    });
    expect(nextSpeakerPosition(machine, { slideId: "intro", slideIndex: 0, step: 5 })).toEqual({
      slideId: "end",
      slideIndex: 1,
      step: 0,
    });
    expect(
      nextSpeakerPosition(machine, { slideId: "end", slideIndex: 1, step: 0 }),
    ).toBeUndefined();
  });

  it("filters the speaker slide catalog by number and readable title", () => {
    expect(filterSpeakerSlides(manifest, "")).toBe(manifest.slides);
    expect(filterSpeakerSlides(manifest, "opening").map(({ id }) => id)).toEqual(["intro"]);
    expect(filterSpeakerSlides(manifest, "2").map(({ id }) => id)).toEqual(["end"]);
    expect(filterSpeakerSlides(manifest, "missing")).toEqual([]);
  });

  it("renders accessible rehearsal status, timing details, and quick slide navigation", () => {
    const machine = createPresentationStateMachine(manifest);
    const store = createPresentationStore(machine);
    const focus = createPresentationFocusStore(store.getSnapshot());
    const rehearsal = createRehearsalStore({
      initialPosition: store.getSnapshot(),
      manifest,
      now: () => 1_000,
      schedule: () => () => undefined,
      targetDurationMs: 25 * 60_000,
    });
    const Content: MDXContent = () => null;

    const markup = renderToStaticMarkup(
      createElement(Speaker, {
        Content,
        focus,
        machine,
        manifest,
        onFocus: focus.dispatch,
        onNavigate: () => undefined,
        onOpenAudience: () => undefined,
        rehearsal,
        store,
      }),
    );

    expect(markup.startsWith('<div class="drever-speaker" data-drever-speaker="">')).toBe(true);
    expect(markup).toContain('<div class="drever-speaker__brand" dir="ltr" lang="en">');
    expect(markup).toContain('aria-labelledby="drever-speaker-rehearsal-label"');
    expect(markup).toContain(
      'id="drever-speaker-rehearsal-label" lang="en">Rehearsal timer</span>',
    );
    expect(markup).not.toContain('aria-label="Rehearsal timer"');
    expect(markup).toContain('data-testid="rehearsal-elapsed"');
    expect(markup).toContain('data-testid="rehearsal-current-slide"');
    expect(markup).toContain('data-testid="rehearsal-pace"');
    expect(markup).toContain('data-testid="rehearsal-status"');
    expect(markup).toContain('data-rehearsal-status="on-pace"');
    expect(markup).toContain("On pace");
    expect(markup).toContain('aria-label="Target duration in minutes"');
    expect(markup).toContain('value="25"');
    expect(markup).toContain('aria-label="Open per-slide timing summary"');
    expect(markup).toContain('data-slide-id="intro"');
    expect(markup).toContain("Opening claim");
    expect(markup).toContain("1 visit");
    expect(markup).toContain(">Pause<");
    expect(markup).toContain(">Reset<");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('id="drever-speaker-slide-dialog"');
    expect(markup).toContain(
      '<span dir="ltr" lang="en">Go to slide 1: </span><span>Opening claim</span>',
    );
    expect(markup).toContain(
      '<span dir="ltr" lang="en">Go to slide 2: </span><span>Closing thought</span>',
    );
    expect(markup).not.toContain('aria-label="Go to slide 1: Opening claim"');
    expect(markup).toContain(
      'class="drever-speaker__preview-label" dir="ltr" id="speaker-current-label" lang="en"',
    );
    expect(markup).toContain(
      'class="drever-speaker__controls" data-drever-speaker-controls="" dir="ltr" lang="en"',
    );
    expect(markup).toContain('aria-label="Use audience laser pointer"');
    expect(markup).toContain('aria-keyshortcuts="L"');
    expect(markup).toContain('data-drever-tooltip="Laser · L"');
    expect(markup).toContain('aria-label="Use audience pen"');
    expect(markup).toContain('aria-keyshortcuts="I"');
    expect(markup).toContain('data-drever-tooltip="Pen · I"');
    expect(markup).toContain('aria-label="Use audience highlighter"');
    expect(markup).toContain('aria-keyshortcuts="H"');
    expect(markup).toContain('data-drever-tooltip="Highlighter · H"');
    expect(markup).toContain('aria-label="Undo audience focus stroke"');
    expect(markup).toContain('aria-label="Clear audience focus marks"');
    expect(markup).not.toContain('title="');
    expect(markup).not.toContain(">Laser<");
    expect(markup).not.toContain(">Pen<");
    expect(markup).not.toContain(">Highlighter<");
    expect(markup).toContain("2 slides found.");

    rehearsal.destroy();
  });
});

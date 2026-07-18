import type { MDXContent } from "@drever/core";
import { DECK_MANIFEST_VERSION, type DeckManifest } from "@drever/schema";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { createPresentationStateMachine, createPresentationStore } from "./presentation-state.ts";
import { createRehearsalStore } from "./rehearsal.ts";
import { formatSpeakerElapsedTime, nextSpeakerPosition, Speaker } from "./speaker.tsx";

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

  it("renders an accessible compact rehearsal control and per-slide summary", () => {
    const machine = createPresentationStateMachine(manifest);
    const store = createPresentationStore(machine);
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
        machine,
        manifest,
        onNavigate: () => undefined,
        onOpenAudience: () => undefined,
        rehearsal,
        store,
      }),
    );

    expect(markup).toContain('aria-label="Rehearsal timer"');
    expect(markup).toContain('data-testid="rehearsal-elapsed"');
    expect(markup).toContain('data-testid="rehearsal-current-slide"');
    expect(markup).toContain('data-testid="rehearsal-pace"');
    expect(markup).toContain('aria-label="Target duration in minutes"');
    expect(markup).toContain('value="25"');
    expect(markup).toContain('aria-label="Open per-slide timing summary"');
    expect(markup).toContain('data-slide-id="intro"');
    expect(markup).toContain("Opening claim");
    expect(markup).toContain("1 visit");
    expect(markup).toContain(">Pause<");
    expect(markup).toContain(">Reset<");

    rehearsal.destroy();
  });
});

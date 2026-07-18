import { DECK_MANIFEST_VERSION, type DeckManifest } from "@drever/schema";
import { describe, expect, it } from "vite-plus/test";
import { createPresentationStateMachine } from "./presentation-state.ts";
import { formatSpeakerElapsedTime, nextSpeakerPosition } from "./speaker.tsx";

const manifest = {
  version: DECK_MANIFEST_VERSION,
  slides: [
    { id: "intro", index: 0, speakerNotes: [], stepStops: [2, 5] },
    { id: "end", index: 1, speakerNotes: [], stepStops: [] },
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
});

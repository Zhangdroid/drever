import { DECK_MANIFEST_VERSION, type DeckManifest } from "@drever/schema";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  createPresentationStateMachine,
  createPresentationStore,
  type DeckPosition,
} from "./presentation-state.ts";

const manifest = {
  version: DECK_MANIFEST_VERSION,
  slides: [
    { id: "intro", index: 0, speakerNotes: [], stepStops: [2, 5] },
    { id: "details", index: 1, speakerNotes: [], stepStops: [3] },
    { id: "end", index: 2, speakerNotes: [], stepStops: [] },
  ],
} as const satisfies DeckManifest;

const position = (slideId: string, slideIndex: number, step: number): DeckPosition => ({
  slideId,
  slideIndex,
  step,
});

describe("presentation state machine", () => {
  it("walks sparse Step stops and crosses slide boundaries", () => {
    const machine = createPresentationStateMachine(manifest);
    const intro = machine.initialPosition;
    const second = machine.transition(intro, { type: "next" });
    const fifth = machine.transition(second?.to as DeckPosition, { type: "next" });
    const details = machine.transition(fifth?.to as DeckPosition, { type: "next" });

    expect(second).toMatchObject({
      from: position("intro", 0, 0),
      to: position("intro", 0, 2),
      transitionType: "drever-step-forward",
    });
    expect(fifth).toMatchObject({
      to: position("intro", 0, 5),
      transitionType: "drever-step-forward",
    });
    expect(details).toMatchObject({
      to: position("details", 1, 0),
      transitionType: "drever-slide-forward",
    });
    expect(machine.transition(details?.to as DeckPosition, { type: "previous" })).toMatchObject({
      to: position("intro", 0, 5),
      transitionType: "drever-slide-backward",
    });
  });

  it("skips reveal stops when navigating by slide", () => {
    const machine = createPresentationStateMachine(manifest);

    expect(machine.transition(position("intro", 0, 2), { type: "nextSlide" })).toMatchObject({
      from: position("intro", 0, 2),
      to: position("details", 1, 0),
      transitionType: "drever-slide-forward",
    });
    expect(machine.transition(position("details", 1, 3), { type: "previousSlide" })).toMatchObject({
      from: position("details", 1, 3),
      to: position("intro", 0, 0),
      transitionType: "drever-slide-backward",
    });
    expect(machine.transition(position("intro", 0, 5), { type: "previousSlide" })).toBeUndefined();
    expect(machine.transition(position("end", 2, 0), { type: "nextSlide" })).toBeUndefined();
  });

  it("stops at the deck edges and classifies explicit jumps", () => {
    const machine = createPresentationStateMachine(manifest);
    const first = machine.initialPosition;
    const last = position("end", 2, 0);

    expect(machine.transition(first, { type: "previous" })).toBeUndefined();
    expect(machine.transition(last, { type: "next" })).toBeUndefined();
    expect(machine.transition(first, { type: "first" })).toBeUndefined();
    expect(machine.transition(last, { type: "last" })).toBeUndefined();
    expect(machine.transition(first, { type: "last" })).toMatchObject({
      to: last,
      transitionType: "drever-jump-forward",
    });
    expect(machine.transition(last, { type: "goTo", slideId: "intro", step: 2 })).toMatchObject({
      to: position("intro", 0, 2),
      transitionType: "drever-jump-backward",
    });
  });

  it("publishes immutable snapshots and notifies only for actual store changes", () => {
    const machine = createPresentationStateMachine(manifest);
    const store = createPresentationStore(machine);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.commit(position("intro", 0, 0));
    store.commit(position("intro", 0, 2));
    expect(listener).toHaveBeenCalledOnce();
    expect(store.getSnapshot()).toEqual(position("intro", 0, 2));
    expect(Object.isFrozen(store.getSnapshot())).toBe(true);

    unsubscribe();
    store.commit(position("intro", 0, 5));
    expect(listener).toHaveBeenCalledOnce();
  });

  it("snapshots speaker notes deeply instead of retaining mutable compiler input", () => {
    const input = {
      version: DECK_MANIFEST_VERSION,
      slides: [
        {
          id: "intro",
          index: 0,
          speakerNotes: [
            { format: "markdown" as const, plainText: "Remember this", value: "**Remember** this" },
          ],
          stepStops: [],
          title: "Opening claim",
        },
      ],
    } satisfies DeckManifest;
    const machine = createPresentationStateMachine(input);
    const sourceNote = input.slides[0]?.speakerNotes[0];
    if (sourceNote === undefined) {
      throw new Error("Test fixture must contain a speaker note.");
    }

    sourceNote.plainText = "Changed after startup";

    expect(machine.manifest.slides[0]?.speakerNotes[0]).toEqual({
      format: "markdown",
      plainText: "Remember this",
      value: "**Remember** this",
    });
    expect(machine.manifest.slides[0]?.title).toBe("Opening claim");
    expect(Object.isFrozen(machine.manifest.slides[0]?.speakerNotes)).toBe(true);
    expect(Object.isFrozen(machine.manifest.slides[0]?.speakerNotes[0])).toBe(true);
  });

  it("rejects malformed manifests and positions with stable error codes", () => {
    expect(() => createPresentationStateMachine(null as unknown as DeckManifest)).toThrowError(
      expect.objectContaining({ code: "DREVER_CLIENT_MANIFEST_INVALID" }),
    );
    expect(() =>
      createPresentationStateMachine({ version: DECK_MANIFEST_VERSION, slides: [] }),
    ).toThrowError(expect.objectContaining({ code: "DREVER_CLIENT_MANIFEST_INVALID" }));
    expect(() =>
      createPresentationStateMachine({
        version: DECK_MANIFEST_VERSION,
        slides: [
          {
            id: "intro",
            index: 0,
            speakerNotes: [{ format: "markdown", plainText: 42, value: "note" }],
            stepStops: [],
          },
        ],
      } as unknown as DeckManifest),
    ).toThrowError(expect.objectContaining({ code: "DREVER_CLIENT_MANIFEST_INVALID" }));
    expect(() =>
      createPresentationStateMachine({
        version: DECK_MANIFEST_VERSION,
        slides: [{ id: "intro", index: 0, speakerNotes: [], stepStops: [], title: "   " }],
      }),
    ).toThrowError(expect.objectContaining({ code: "DREVER_CLIENT_MANIFEST_INVALID" }));

    const machine = createPresentationStateMachine(manifest);
    expect(() => machine.validatePosition(null as unknown as DeckPosition)).toThrowError(
      expect.objectContaining({ code: "DREVER_CLIENT_POSITION_INVALID" }),
    );
    expect(() => machine.validatePosition(position("intro", 0, 3))).toThrowError(
      expect.objectContaining({ code: "DREVER_CLIENT_POSITION_INVALID" }),
    );
  });
});

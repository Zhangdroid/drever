import { DECK_MANIFEST_VERSION } from "@drever/schema";
import { describe, expect, it, vi } from "vite-plus/test";
import { createPresentationStateMachine } from "./presentation-state.ts";
import { createReactTransitionBridge, type ReactTransitionRequest } from "./view-transition.ts";
import { createViewerTransitionChannel, resolveSlideState } from "./viewer.tsx";

const machine = createPresentationStateMachine({
  version: DECK_MANIFEST_VERSION,
  slides: [
    { id: "one", index: 0, speakerNotes: [], stepStops: [] },
    { id: "two", index: 1, speakerNotes: [], stepStops: [] },
  ],
});
const change = machine.transition(machine.initialPosition, { type: "next" });

if (change === undefined) {
  throw new Error("The Viewer transition fixture must produce a change.");
}

describe("Viewer state resolution", () => {
  it("activates only the identified current slide", () => {
    const current = { slideId: "two", slideIndex: 1, step: 3 };

    expect(resolveSlideState(current, { id: "two", index: 1 })).toEqual({
      active: true,
      currentStep: 3,
    });
    expect(resolveSlideState(current, { id: "one", index: 0 })).toEqual({
      active: false,
      currentStep: 0,
    });
    expect(resolveSlideState(current, {})).toEqual({ active: false, currentStep: 0 });
  });
});

describe("Viewer transition channel", () => {
  it("keeps Navigation pending until React reports its layout commit", async () => {
    const channel = createViewerTransitionChannel();
    let request: ReactTransitionRequest | undefined;
    const detach = channel.attach((next) => {
      request = next;
    });
    const bridge = createReactTransitionBridge(channel.schedule);
    let completed = false;
    const navigation = bridge.commit(change, new AbortController().signal).then(() => {
      completed = true;
    });

    await Promise.resolve();
    expect(completed).toBe(false);
    request?.complete();
    await navigation;
    expect(completed).toBe(true);

    detach();
    await expect(bridge.commit(change, new AbortController().signal)).rejects.toMatchObject({
      code: "DREVER_CLIENT_VIEWER_NOT_READY",
    });
  });

  it("allows only one attached Viewer", () => {
    const channel = createViewerTransitionChannel();
    channel.attach(vi.fn());

    expect(() => channel.attach(vi.fn())).toThrowError(
      expect.objectContaining({ code: "DREVER_CLIENT_VIEWER_ALREADY_MOUNTED" }),
    );
  });

  it("fails every pending and future request when closed", async () => {
    const channel = createViewerTransitionChannel();
    channel.attach(vi.fn());
    const bridge = createReactTransitionBridge(channel.schedule);
    const first = bridge.commit(change, new AbortController().signal);
    const second = bridge.commit(change, new AbortController().signal);
    const reason = new Error("viewer destroyed");

    channel.close(reason);
    await expect(first).rejects.toBe(reason);
    await expect(second).rejects.toBe(reason);
    await expect(bridge.commit(change, new AbortController().signal)).rejects.toBe(reason);
    expect(() => channel.attach(vi.fn())).toThrow(reason);
  });
});

import { describe, expect, it, vi } from "vite-plus/test";
import { createPresentationStateMachine } from "./presentation-state.ts";
import {
  createReactTransitionBridge,
  PRESENTATION_TRANSITION_TYPES,
  startScopedViewTransition,
  type ReactTransitionRequest,
  type ScopedViewTransition,
  type ScopedViewTransitionOptions,
  type ScopedViewTransitionRoot,
} from "./view-transition.ts";

const change = createPresentationStateMachine({
  version: 2,
  slides: [
    { id: "one", index: 0, speakerNotes: [], stepStops: [] },
    { id: "two", index: 1, speakerNotes: [], stepStops: [] },
  ],
}).transition({ slideId: "one", slideIndex: 0, step: 0 }, { type: "next" });

if (change === undefined) {
  throw new Error("The transition fixture must produce a change.");
}

describe("React transition bridge", () => {
  it("exposes stable L2 transition types", () => {
    expect(PRESENTATION_TRANSITION_TYPES).toEqual([
      "drever-step-forward",
      "drever-step-backward",
      "drever-slide-forward",
      "drever-slide-backward",
      "drever-jump-forward",
      "drever-jump-backward",
    ]);
    expect(Object.isFrozen(PRESENTATION_TRANSITION_TYPES)).toBe(true);
  });

  it("starts the native transition on the canvas with one directional type", async () => {
    const nativeTransition: ScopedViewTransition = {
      finished: Promise.resolve(),
      ready: Promise.resolve(),
      skipTransition: vi.fn(),
      updateCallbackDone: Promise.resolve(),
    };
    const update = vi.fn(async () => undefined);
    const calls: ScopedViewTransitionOptions[] = [];
    const root = {
      startViewTransition(received: ScopedViewTransitionOptions) {
        calls.push(received);
        return nativeTransition;
      },
    } as unknown as ScopedViewTransitionRoot;

    expect(startScopedViewTransition(root, "drever-slide-forward", update)).toBe(nativeTransition);
    expect(calls).toHaveLength(1);
    const options = calls[0];
    expect(options?.types).toEqual(["drever-slide-forward"]);
    expect(update).not.toHaveBeenCalled();

    await options?.update();
    expect(update).toHaveBeenCalledOnce();
  });

  it("waits for the layout-effect completion signal", async () => {
    let request: ReactTransitionRequest | undefined;
    const bridge = createReactTransitionBridge((next) => {
      request = next;
    });
    const controller = new AbortController();
    let settled = false;
    const committed = bridge.commit(change, controller.signal).then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);
    expect(request).toMatchObject({
      change,
      transitionType: "drever-slide-forward",
      signal: controller.signal,
    });

    request?.complete();
    await committed;
    expect(settled).toBe(true);
  });

  it("propagates scheduler and render failures", async () => {
    const renderError = new Error("render failed");
    const failedBridge = createReactTransitionBridge((request) => request.fail(renderError));
    await expect(failedBridge.commit(change, new AbortController().signal)).rejects.toBe(
      renderError,
    );

    const schedulerError = new Error("scheduler failed");
    const throwingBridge = createReactTransitionBridge(() => {
      throw schedulerError;
    });
    await expect(throwingBridge.commit(change, new AbortController().signal)).rejects.toBe(
      schedulerError,
    );
  });

  it("does not schedule pre-aborted work and rejects pending work on abort", async () => {
    const preAborted = new AbortController();
    preAborted.abort();
    const schedule = vi.fn();
    const bridge = createReactTransitionBridge(schedule);
    await expect(bridge.commit(change, preAborted.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(schedule).not.toHaveBeenCalled();

    let request: ReactTransitionRequest | undefined;
    const pendingController = new AbortController();
    const pendingBridge = createReactTransitionBridge((next) => {
      request = next;
    });
    const pending = pendingBridge.commit(change, pendingController.signal);
    pendingController.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    request?.complete();
  });
});

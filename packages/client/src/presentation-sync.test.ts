import { DECK_MANIFEST_VERSION, type DeckManifest } from "@drever/schema";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  createAudienceSync,
  createBrowserPresentationChannel,
  createSpeakerSync,
  PRESENTATION_SYNC_PROTOCOL,
  type CreateAudienceSyncOptions,
  type PresentationChannel,
  type PresentationChannelMessageEvent,
} from "./presentation-sync.ts";
import { createPresentationStateMachine, createPresentationStore } from "./presentation-state.ts";

const manifest = {
  version: DECK_MANIFEST_VERSION,
  slides: [
    { id: "intro", index: 0, speakerNotes: [], stepStops: [2, 5] },
    { id: "details", index: 1, speakerNotes: [], stepStops: [] },
    { id: "end", index: 2, speakerNotes: [], stepStops: [] },
  ],
} as const satisfies DeckManifest;

const machine = createPresentationStateMachine(manifest);

const flush = async (): Promise<void> => {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve();
  }
};

const createChannelHarness = () => {
  const listeners = new Set<(event: PresentationChannelMessageEvent) => void>();
  const close = vi.fn();
  const postMessage = vi.fn<(message: unknown) => void>();
  const addEventListener = vi.fn(
    (_type: "message", listener: (event: PresentationChannelMessageEvent) => void) => {
      listeners.add(listener);
    },
  );
  const removeEventListener = vi.fn(
    (_type: "message", listener: (event: PresentationChannelMessageEvent) => void) => {
      listeners.delete(listener);
    },
  );
  const channel: PresentationChannel = {
    addEventListener,
    close,
    postMessage,
    removeEventListener,
  };

  return {
    addEventListener,
    channel,
    close,
    dispatch(data: unknown) {
      for (const listener of listeners) {
        listener({ data });
      }
    },
    listeners,
    postMessage,
    removeEventListener,
  };
};

const createLinkedChannels = (): readonly [PresentationChannel, PresentationChannel] => {
  const audienceListeners = new Set<(event: PresentationChannelMessageEvent) => void>();
  const speakerListeners = new Set<(event: PresentationChannelMessageEvent) => void>();

  const endpoint = (
    own: Set<(event: PresentationChannelMessageEvent) => void>,
    peer: Set<(event: PresentationChannelMessageEvent) => void>,
  ): PresentationChannel => ({
    addEventListener: (_type, listener) => own.add(listener),
    close: () => own.clear(),
    postMessage: (data) => {
      for (const listener of peer) {
        listener({ data });
      }
    },
    removeEventListener: (_type, listener) => own.delete(listener),
  });

  return [
    endpoint(audienceListeners, speakerListeners),
    endpoint(speakerListeners, audienceListeners),
  ];
};

describe("browser presentation channel", () => {
  it("uses a stable protocol name isolated by origin and normalized mount path", () => {
    const names: string[] = [];
    class FakeBroadcastChannel {
      constructor(name: string) {
        names.push(name);
      }

      addEventListener(): void {}
      close(): void {}
      postMessage(): void {}
      removeEventListener(): void {}
    }
    const view = { BroadcastChannel: FakeBroadcastChannel };

    createBrowserPresentationChannel(view, new URL("https://slides.test/talk?theme=dark#notes"));
    createBrowserPresentationChannel(view, new URL("https://slides.test/talk/"));
    createBrowserPresentationChannel(view, new URL("https://slides.test/workshop"));
    createBrowserPresentationChannel(view, new URL("https://studio.test/talk"));

    expect(PRESENTATION_SYNC_PROTOCOL).toBe("drever-presentation-sync-v1");
    expect(names).toEqual([
      "drever-presentation-sync-v1:https://slides.test/talk/",
      "drever-presentation-sync-v1:https://slides.test/talk/",
      "drever-presentation-sync-v1:https://slides.test/workshop/",
      "drever-presentation-sync-v1:https://studio.test/talk/",
    ]);
  });
});

describe("speaker and audience presentation sync", () => {
  it("handshakes with a late audience and follows subsequent speaker state", async () => {
    const [audienceChannel, speakerChannel] = createLinkedChannels();
    const speakerStore = createPresentationStore(machine);
    speakerStore.commit({ slideId: "intro", slideIndex: 0, step: 5 });
    const speakerError = vi.fn();
    const audienceError = vi.fn();
    const navigate = vi.fn(async (): Promise<void> => {});
    const speaker = createSpeakerSync({
      channel: speakerChannel,
      onError: speakerError,
      store: speakerStore,
    });

    const audience = createAudienceSync({
      channel: audienceChannel,
      machine,
      navigate,
      onError: audienceError,
    });
    await flush();

    expect(navigate).toHaveBeenNthCalledWith(1, {
      type: "goTo",
      slideId: "intro",
      step: 5,
    });

    const liveChange = machine.transition(speakerStore.getSnapshot(), { type: "next" });
    if (liveChange === undefined) {
      throw new Error("The live synchronization fixture must produce a transition.");
    }
    speakerStore.commit(liveChange.to);
    speaker.publish(liveChange.transitionType);
    await flush();
    expect(navigate).toHaveBeenNthCalledWith(
      2,
      { type: "goTo", slideId: "details", step: 0 },
      { transitionType: "drever-slide-forward" },
    );
    expect(speakerError).not.toHaveBeenCalled();
    expect(audienceError).not.toHaveBeenCalled();

    audience.dispose();
    speaker.dispose();
  });

  it("validates remote positions, serializes navigation, and reports async failures", async () => {
    const harness = createChannelHarness();
    const navigationFailure = new Error("navigation failed");
    const navigate = vi
      .fn<CreateAudienceSyncOptions["navigate"]>()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(navigationFailure);
    const onError = vi.fn();
    const sync = createAudienceSync({ channel: harness.channel, machine, navigate, onError });

    expect(harness.postMessage).toHaveBeenCalledWith({
      drever: PRESENTATION_SYNC_PROTOCOL,
      type: "ready",
    });

    harness.dispatch({ drever: "another-protocol", type: "position", position: null });
    harness.dispatch({
      drever: PRESENTATION_SYNC_PROTOCOL,
      type: "position",
      position: { slideId: "intro", slideIndex: 99, step: 0 },
    });
    harness.dispatch({
      drever: PRESENTATION_SYNC_PROTOCOL,
      type: "position",
      position: { slideId: "intro", slideIndex: 0, step: 2 },
      transitionType: "drever-slide-sideways",
    });
    harness.dispatch({
      drever: PRESENTATION_SYNC_PROTOCOL,
      type: "position",
      position: { slideId: "intro", slideIndex: 0, step: 2 },
      transitionType: "drever-step-forward",
    });
    harness.dispatch({
      drever: PRESENTATION_SYNC_PROTOCOL,
      type: "position",
      position: { slideId: "details", slideIndex: 1, step: 0 },
    });
    await flush();

    expect(navigate.mock.calls).toEqual([
      [{ type: "goTo", slideId: "intro", step: 2 }, { transitionType: "drever-step-forward" }],
      [{ type: "goTo", slideId: "details", step: 0 }],
    ]);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "DREVER_CLIENT_POSITION_INVALID" }),
    );
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "DREVER_CLIENT_SYNC_TRANSITION_INVALID" }),
    );
    expect(onError).toHaveBeenCalledWith(navigationFailure);

    sync.dispose();
    sync.dispose();
    harness.dispatch({
      drever: PRESENTATION_SYNC_PROTOCOL,
      type: "position",
      position: { slideId: "end", slideIndex: 2, step: 0 },
    });
    await flush();

    expect(navigate).toHaveBeenCalledTimes(2);
    expect(harness.removeEventListener).toHaveBeenCalledOnce();
    expect(harness.close).toHaveBeenCalledOnce();
  });

  it("validates transient laser messages and clears them at lifecycle boundaries", () => {
    const harness = createChannelHarness();
    const onError = vi.fn();
    const onLaser = vi.fn();
    const sync = createAudienceSync({
      channel: harness.channel,
      machine,
      navigate: vi.fn(async () => undefined),
      onError,
      onLaser,
    });

    harness.dispatch({
      drever: PRESENTATION_SYNC_PROTOCOL,
      point: { x: 1.1, y: 0.5 },
      position: { slideId: "intro", slideIndex: 0, step: 0 },
      type: "laser",
    });
    harness.dispatch({
      drever: PRESENTATION_SYNC_PROTOCOL,
      point: { x: 0.25, y: 0.75 },
      position: { slideId: "intro", slideIndex: 0, step: 2 },
      type: "laser",
    });
    harness.dispatch({
      drever: PRESENTATION_SYNC_PROTOCOL,
      position: { slideId: "intro", slideIndex: 0, step: 2 },
      type: "laser",
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "DREVER_CLIENT_SYNC_LASER_INVALID" }),
    );
    expect(onLaser).toHaveBeenNthCalledWith(1, {
      point: { x: 0.25, y: 0.75 },
      position: { slideId: "intro", slideIndex: 0, step: 2 },
    });
    expect(onLaser).toHaveBeenNthCalledWith(2);

    sync.dispose();
    harness.dispatch({
      drever: PRESENTATION_SYNC_PROTOCOL,
      point: { x: 0.5, y: 0.5 },
      position: { slideId: "intro", slideIndex: 0, step: 2 },
      type: "laser",
    });
    expect(onLaser).toHaveBeenCalledTimes(3);
    expect(onLaser).toHaveBeenNthCalledWith(3);
  });

  it("publishes explicit live intent, answers ready without intent, and stops after disposal", () => {
    const harness = createChannelHarness();
    const store = createPresentationStore(machine);
    const onError = vi.fn();
    const sync = createSpeakerSync({ channel: harness.channel, onError, store });
    const staleListener = [...harness.listeners][0];

    expect(harness.postMessage).toHaveBeenNthCalledWith(1, {
      drever: PRESENTATION_SYNC_PROTOCOL,
      position: { slideId: "intro", slideIndex: 0, step: 0 },
      type: "position",
    });

    store.commit({ slideId: "intro", slideIndex: 0, step: 5 });
    expect(harness.postMessage).toHaveBeenCalledOnce();
    sync.publish("drever-step-forward");
    harness.dispatch({ drever: "another-protocol", type: "ready" });
    harness.dispatch({ drever: PRESENTATION_SYNC_PROTOCOL, type: "ready" });
    expect(harness.postMessage).toHaveBeenCalledTimes(3);
    expect(harness.postMessage).toHaveBeenNthCalledWith(2, {
      drever: PRESENTATION_SYNC_PROTOCOL,
      position: { slideId: "intro", slideIndex: 0, step: 5 },
      transitionType: "drever-step-forward",
      type: "position",
    });
    expect(harness.postMessage).toHaveBeenNthCalledWith(3, {
      drever: PRESENTATION_SYNC_PROTOCOL,
      position: { slideId: "intro", slideIndex: 0, step: 5 },
      type: "position",
    });

    sync.dispose();
    sync.dispose();
    store.commit({ slideId: "details", slideIndex: 1, step: 0 });
    sync.publish("drever-slide-forward");
    sync.publish("not-a-transition" as never);
    staleListener?.({ data: { drever: PRESENTATION_SYNC_PROTOCOL, type: "ready" } });

    expect(harness.postMessage).toHaveBeenCalledTimes(3);
    expect(harness.removeEventListener).toHaveBeenCalledOnce();
    expect(harness.close).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
  });

  it("rejects an invalid locally published transition without sending it", () => {
    const harness = createChannelHarness();
    const onError = vi.fn();
    const sync = createSpeakerSync({
      channel: harness.channel,
      onError,
      store: createPresentationStore(machine),
    });

    sync.publish("not-a-transition" as never);

    expect(harness.postMessage).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "DREVER_CLIENT_SYNC_TRANSITION_INVALID" }),
    );
    sync.dispose();
  });

  it("publishes only normalized laser state and clears it across navigation and disposal", () => {
    const harness = createChannelHarness();
    const onError = vi.fn();
    const sync = createSpeakerSync({
      channel: harness.channel,
      onError,
      store: createPresentationStore(machine),
    });

    sync.publishLaser({ x: 0.2, y: 0.8 });
    sync.publishLaser({ x: Number.NaN, y: 0.5 });

    expect(harness.postMessage).toHaveBeenNthCalledWith(2, {
      drever: PRESENTATION_SYNC_PROTOCOL,
      point: { x: 0.2, y: 0.8 },
      position: { slideId: "intro", slideIndex: 0, step: 0 },
      type: "laser",
    });
    expect(harness.postMessage).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "DREVER_CLIENT_SYNC_LASER_INVALID" }),
    );

    sync.publish("drever-step-forward");
    expect(harness.postMessage).toHaveBeenNthCalledWith(3, {
      drever: PRESENTATION_SYNC_PROTOCOL,
      position: { slideId: "intro", slideIndex: 0, step: 0 },
      type: "laser",
    });
    expect(harness.postMessage).toHaveBeenNthCalledWith(4, {
      drever: PRESENTATION_SYNC_PROTOCOL,
      position: { slideId: "intro", slideIndex: 0, step: 0 },
      transitionType: "drever-step-forward",
      type: "position",
    });

    sync.publishLaser({ x: 0.4, y: 0.4 });
    sync.dispose();
    sync.publishLaser({ x: 0.6, y: 0.6 });
    expect(harness.postMessage).toHaveBeenNthCalledWith(6, {
      drever: PRESENTATION_SYNC_PROTOCOL,
      position: { slideId: "intro", slideIndex: 0, step: 0 },
      type: "laser",
    });
    expect(harness.postMessage).toHaveBeenCalledTimes(6);
  });
});

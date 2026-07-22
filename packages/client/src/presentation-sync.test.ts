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
import { createPresentationFocusStore } from "./presentation-focus-store.ts";
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

    expect(PRESENTATION_SYNC_PROTOCOL).toBe("drever-presentation-sync-v2");
    expect(names).toEqual([
      "drever-presentation-sync-v2:https://slides.test/talk/",
      "drever-presentation-sync-v2:https://slides.test/talk/",
      "drever-presentation-sync-v2:https://slides.test/workshop/",
      "drever-presentation-sync-v2:https://studio.test/talk/",
    ]);
  });
});

describe("speaker and audience presentation sync", () => {
  it("handshakes a late audience with position and persistent focus state", async () => {
    const [audienceChannel, speakerChannel] = createLinkedChannels();
    const speakerStore = createPresentationStore(machine);
    speakerStore.commit({ slideId: "intro", slideIndex: 0, step: 5 });
    const speakerFocus = createPresentationFocusStore(speakerStore.getSnapshot(), "pen");
    speakerFocus.dispatch({ point: { x: 0.1, y: 0.2 }, type: "begin" });
    speakerFocus.dispatch({ point: { x: 0.4, y: 0.6 }, type: "end" });
    const audienceFocus = createPresentationFocusStore(machine.initialPosition);
    const speakerError = vi.fn();
    const audienceError = vi.fn();
    const navigate = vi.fn(async (): Promise<void> => {});
    const speaker = createSpeakerSync({
      channel: speakerChannel,
      focus: speakerFocus,
      onError: speakerError,
      store: speakerStore,
    });

    const audience = createAudienceSync({
      channel: audienceChannel,
      focus: audienceFocus,
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
    expect(audienceFocus.getSnapshot()).toEqual(speakerFocus.getSnapshot());
    expect(audienceFocus.getSnapshot().strokes).toEqual([
      {
        id: "focus-0",
        points: [
          { x: 0.1, y: 0.2 },
          { x: 0.4, y: 0.6 },
        ],
        tool: "pen",
      },
    ]);

    const liveChange = machine.transition(speakerStore.getSnapshot(), { type: "next" });
    if (liveChange === undefined) {
      throw new Error("The live synchronization fixture must produce a transition.");
    }
    speakerStore.commit(liveChange.to);
    speakerFocus.dispatch({ position: liveChange.to, type: "commitPosition" });
    speaker.publish(liveChange.transitionType);
    await flush();
    expect(navigate).toHaveBeenNthCalledWith(
      2,
      { type: "goTo", slideId: "details", step: 0 },
      { transitionType: "drever-slide-forward" },
    );
    expect(audienceFocus.getSnapshot()).toMatchObject({
      position: { slideId: "details", slideIndex: 1, step: 0 },
      strokes: [],
      tool: "pen",
    });
    expect(speakerError).not.toHaveBeenCalled();
    expect(audienceError).not.toHaveBeenCalled();

    audience.dispose();
    speaker.dispose();
  });

  it("validates remote positions, serializes navigation, and reports async failures", async () => {
    const harness = createChannelHarness();
    const focus = createPresentationFocusStore(machine.initialPosition, "pen");
    focus.dispatch({ point: { x: 0.15, y: 0.25 }, type: "begin" });
    focus.dispatch({ point: { x: 0.35, y: 0.45 }, type: "end" });
    const navigationFailure = new Error("navigation failed");
    const navigate = vi
      .fn<CreateAudienceSyncOptions["navigate"]>()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(navigationFailure);
    const onError = vi.fn();
    const sync = createAudienceSync({
      channel: harness.channel,
      focus,
      machine,
      navigate,
      onError,
    });

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
    expect(focus.getSnapshot().position).toEqual(machine.initialPosition);
    expect(focus.getSnapshot().strokes).toHaveLength(1);
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
    expect(focus.getSnapshot().position).toEqual({ slideId: "intro", slideIndex: 0, step: 2 });
    expect(focus.getSnapshot().strokes).toHaveLength(1);
    harness.dispatch({
      drever: PRESENTATION_SYNC_PROTOCOL,
      type: "position",
      position: { slideId: "details", slideIndex: 1, step: 0 },
    });
    expect(focus.getSnapshot()).toMatchObject({
      position: { slideId: "details", slideIndex: 1, step: 0 },
      strokes: [],
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

    focus.dispatch({ point: { x: 0.5, y: 0.5 }, type: "begin" });
    focus.dispatch({ type: "end" });
    expect(focus.getSnapshot().strokes).toHaveLength(1);
    sync.dispose();
    sync.dispose();
    expect(focus.getSnapshot().strokes).toEqual([]);
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

  it("validates remote focus actions and snapshots before applying them", () => {
    const harness = createChannelHarness();
    const focus = createPresentationFocusStore(machine.initialPosition);
    const onError = vi.fn();
    const sync = createAudienceSync({
      channel: harness.channel,
      focus,
      machine,
      navigate: vi.fn(async () => undefined),
      onError,
    });

    harness.dispatch({
      drever: PRESENTATION_SYNC_PROTOCOL,
      action: { tool: "pen", type: "selectTool" },
      type: "focus-action",
    });
    harness.dispatch({
      drever: PRESENTATION_SYNC_PROTOCOL,
      action: { point: { x: 0.1, y: 0.2 }, type: "begin" },
      type: "focus-action",
    });
    harness.dispatch({
      drever: PRESENTATION_SYNC_PROTOCOL,
      action: { point: { x: 0.5, y: 0.6 }, type: "end" },
      type: "focus-action",
    });

    expect(focus.getSnapshot()).toMatchObject({
      strokes: [
        {
          id: "focus-0",
          points: [
            { x: 0.1, y: 0.2 },
            { x: 0.5, y: 0.6 },
          ],
          tool: "pen",
        },
      ],
      tool: "pen",
    });

    harness.dispatch({
      drever: PRESENTATION_SYNC_PROTOCOL,
      action: { point: { x: 1.1, y: 0.5 }, type: "move" },
      type: "focus-action",
    });
    harness.dispatch({
      drever: PRESENTATION_SYNC_PROTOCOL,
      action: {
        position: { slideId: "details", slideIndex: 1, step: 0 },
        type: "commitPosition",
      },
      type: "focus-action",
    });
    harness.dispatch({ drever: PRESENTATION_SYNC_PROTOCOL, type: "focus-action" });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "DREVER_CLIENT_FOCUS_POINT_INVALID" }),
    );
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "DREVER_CLIENT_SYNC_FOCUS_INVALID" }),
    );
    expect(focus.getSnapshot().position).toEqual(machine.initialPosition);

    harness.dispatch({
      drever: PRESENTATION_SYNC_PROTOCOL,
      state: {
        nextStrokeId: 2,
        position: { slideId: "intro", slideIndex: 0, step: 2 },
        strokes: [
          {
            id: "focus-1",
            points: [{ x: 0.75, y: 0.25 }],
            tool: "highlighter",
          },
        ],
        tool: "highlighter",
      },
      type: "focus-snapshot",
    });
    expect(focus.getSnapshot()).toEqual({
      nextStrokeId: 2,
      position: { slideId: "intro", slideIndex: 0, step: 2 },
      strokes: [
        {
          id: "focus-1",
          points: [{ x: 0.75, y: 0.25 }],
          tool: "highlighter",
        },
      ],
      tool: "highlighter",
    });

    const validSnapshot = focus.getSnapshot();
    harness.dispatch({
      drever: PRESENTATION_SYNC_PROTOCOL,
      state: {
        ...validSnapshot,
        position: { slideId: "missing", slideIndex: 0, step: 0 },
      },
      type: "focus-snapshot",
    });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "DREVER_CLIENT_POSITION_INVALID" }),
    );
    expect(focus.getSnapshot()).toBe(validSnapshot);

    sync.dispose();
    expect(focus.getSnapshot().strokes).toEqual([]);
    harness.dispatch({
      drever: PRESENTATION_SYNC_PROTOCOL,
      action: { tool: "laser", type: "selectTool" },
      type: "focus-action",
    });
    expect(focus.getSnapshot().tool).toBe("highlighter");
  });

  it("publishes explicit live intent, answers ready without intent, and stops after disposal", () => {
    const harness = createChannelHarness();
    const store = createPresentationStore(machine);
    const focus = createPresentationFocusStore(store.getSnapshot());
    const onError = vi.fn();
    const sync = createSpeakerSync({ channel: harness.channel, focus, onError, store });
    const staleListener = [...harness.listeners][0];

    expect(harness.postMessage).toHaveBeenNthCalledWith(1, {
      drever: PRESENTATION_SYNC_PROTOCOL,
      position: { slideId: "intro", slideIndex: 0, step: 0 },
      type: "position",
    });

    store.commit({ slideId: "intro", slideIndex: 0, step: 5 });
    focus.dispatch({ position: store.getSnapshot(), type: "commitPosition" });
    expect(harness.postMessage).toHaveBeenCalledOnce();
    sync.publish("drever-step-forward");
    harness.dispatch({ drever: "another-protocol", type: "ready" });
    harness.dispatch({ drever: PRESENTATION_SYNC_PROTOCOL, type: "ready" });
    expect(harness.postMessage).toHaveBeenCalledTimes(4);
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
    expect(harness.postMessage).toHaveBeenNthCalledWith(4, {
      drever: PRESENTATION_SYNC_PROTOCOL,
      state: focus.getSnapshot(),
      type: "focus-snapshot",
    });

    sync.dispose();
    sync.dispose();
    store.commit({ slideId: "details", slideIndex: 1, step: 0 });
    sync.publish("drever-slide-forward");
    sync.publish("not-a-transition" as never);
    staleListener?.({ data: { drever: PRESENTATION_SYNC_PROTOCOL, type: "ready" } });

    expect(harness.postMessage).toHaveBeenCalledTimes(4);
    expect(harness.removeEventListener).toHaveBeenCalledOnce();
    expect(harness.close).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
  });

  it("rejects an invalid locally published transition without sending it", () => {
    const harness = createChannelHarness();
    const onError = vi.fn();
    const sync = createSpeakerSync({
      channel: harness.channel,
      focus: createPresentationFocusStore(machine.initialPosition),
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

  it("publishes normalized focus actions and clears persistent marks on disposal", () => {
    const harness = createChannelHarness();
    const store = createPresentationStore(machine);
    const focus = createPresentationFocusStore(store.getSnapshot());
    const onError = vi.fn();
    const sync = createSpeakerSync({
      channel: harness.channel,
      focus,
      onError,
      store,
    });

    const selectPen = { tool: "pen", type: "selectTool" } as const;
    focus.dispatch(selectPen);
    sync.publishFocus(selectPen);
    const begin: { point: { x: number; y: number }; type: "begin" } = {
      point: { x: 0.2, y: 0.8 },
      type: "begin",
    };
    focus.dispatch(begin);
    sync.publishFocus(begin);
    begin.point.x = 0.9;
    const end = { point: { x: 0.4, y: 0.6 }, type: "end" } as const;
    focus.dispatch(end);
    sync.publishFocus(end);

    expect(harness.postMessage).toHaveBeenNthCalledWith(2, {
      action: { tool: "pen", type: "selectTool" },
      drever: PRESENTATION_SYNC_PROTOCOL,
      type: "focus-action",
    });
    expect(harness.postMessage).toHaveBeenNthCalledWith(3, {
      action: { point: { x: 0.2, y: 0.8 }, type: "begin" },
      drever: PRESENTATION_SYNC_PROTOCOL,
      type: "focus-action",
    });
    expect(harness.postMessage).toHaveBeenNthCalledWith(4, {
      action: { point: { x: 0.4, y: 0.6 }, type: "end" },
      drever: PRESENTATION_SYNC_PROTOCOL,
      type: "focus-action",
    });

    sync.publishFocus({ point: { x: Number.NaN, y: 0.5 }, type: "move" });
    sync.publishFocus({
      position: { slideId: "details", slideIndex: 1, step: 0 },
      type: "commitPosition",
    });
    expect(harness.postMessage).toHaveBeenCalledTimes(4);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "DREVER_CLIENT_FOCUS_POINT_INVALID" }),
    );
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "DREVER_CLIENT_SYNC_FOCUS_INVALID" }),
    );

    sync.dispose();
    expect(harness.postMessage).toHaveBeenNthCalledWith(5, {
      action: { type: "clear" },
      drever: PRESENTATION_SYNC_PROTOCOL,
      type: "focus-action",
    });
    sync.publishFocus({ type: "undo" });
    sync.publish("drever-step-forward");
    expect(harness.postMessage).toHaveBeenCalledTimes(5);
    expect(harness.removeEventListener).toHaveBeenCalledOnce();
    expect(harness.close).toHaveBeenCalledOnce();
  });
});

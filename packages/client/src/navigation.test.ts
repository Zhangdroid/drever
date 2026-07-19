import { DECK_MANIFEST_VERSION, type DeckManifest } from "@drever/schema";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  createPresentationNavigation,
  type NavigateEventLike,
  type NavigationDestinationLike,
  type NavigationHistoryEntryLike,
  type NavigationLike,
} from "./navigation.ts";
import type { PresentationRouteSurface } from "./presentation-route.ts";
import {
  createPresentationStateMachine,
  createPresentationStore,
  type PresentationChange,
} from "./presentation-state.ts";

const manifest = {
  version: DECK_MANIFEST_VERSION,
  slides: [
    { id: "intro", index: 0, speakerNotes: [], stepStops: [2, 5] },
    { id: "details", index: 1, speakerNotes: [], stepStops: [3] },
    { id: "end", index: 2, speakerNotes: [], stepStops: [] },
  ],
} as const satisfies DeckManifest;

type InterceptOptions = Parameters<NavigateEventLike["intercept"]>[0];

type EventOverrides = Readonly<{
  canIntercept?: boolean;
  cancelable?: boolean;
  downloadRequest?: string | null;
  formData?: FormData | null;
  hashChange?: boolean;
  index?: number;
  info?: unknown;
  navigationType?: NavigateEventLike["navigationType"];
  signal?: AbortSignal;
  state?: unknown;
}>;

type EventHarness = Readonly<{
  event: NavigateEventLike;
  getInterception(): InterceptOptions | undefined;
  preventDefault: ReturnType<typeof vi.fn>;
}>;

const createEvent = (url: string, overrides: EventOverrides = {}): EventHarness => {
  let interception: InterceptOptions | undefined;
  const preventDefault = vi.fn();
  const destination: NavigationDestinationLike = {
    index: overrides.index ?? 1,
    url,
    getState: () => overrides.state,
  };
  return {
    event: {
      canIntercept: overrides.canIntercept ?? true,
      cancelable: overrides.cancelable ?? true,
      destination,
      downloadRequest: overrides.downloadRequest ?? null,
      formData: overrides.formData ?? null,
      hashChange: overrides.hashChange ?? false,
      info: overrides.info,
      navigationType: overrides.navigationType ?? "push",
      signal: overrides.signal ?? new AbortController().signal,
      intercept: (options) => {
        interception = options;
      },
      preventDefault,
    },
    getInterception: () => interception,
    preventDefault,
  };
};

const createEntry = (url: string, index: number, state: unknown): NavigationHistoryEntryLike => ({
  index,
  url,
  getState: () => state,
});

const createNavigationHarness = (initialURL: string, initialIndex = 0) => {
  let listener: ((event: NavigateEventLike) => void) | undefined;
  let currentEntry = createEntry(initialURL, initialIndex, undefined);
  const navigateCalls: Array<
    Readonly<{
      options: Parameters<NavigationLike["navigate"]>[1];
      url: string;
    }>
  > = [];
  const updateCurrentEntry = vi.fn((options: Readonly<{ state: unknown }>) => {
    currentEntry = createEntry(currentEntry.url as string, currentEntry.index, options.state);
  });

  const dispatch = (url: string, overrides: EventOverrides = {}): EventHarness => {
    const harness = createEvent(url, overrides);
    listener?.(harness.event);
    if (!harness.preventDefault.mock.calls.length) {
      currentEntry = createEntry(url, overrides.index ?? currentEntry.index + 1, overrides.state);
    }
    return harness;
  };

  const navigation: NavigationLike = {
    get currentEntry() {
      return currentEntry;
    },
    addEventListener: (_type, nextListener) => {
      listener = nextListener;
    },
    navigate: (url, options) => {
      navigateCalls.push({ url, options });
      const destinationIndex = currentEntry.index + 1;
      const harness = dispatch(url, {
        index: destinationIndex,
        info: options.info,
        navigationType: "push",
        state: options.state,
      });
      const destination = currentEntry;
      const interception = harness.getInterception();
      const finished =
        interception === undefined
          ? Promise.resolve(destination)
          : Promise.resolve()
              .then(() => interception.handler())
              .then(() => destination);
      return { committed: Promise.resolve(destination), finished };
    },
    removeEventListener: (_type, currentListener) => {
      if (listener === currentListener) {
        listener = undefined;
      }
    },
    updateCurrentEntry,
  };

  return {
    dispatch,
    get currentEntry() {
      return currentEntry;
    },
    hasListener: () => listener !== undefined,
    navigateCalls,
    navigation,
    updateCurrentEntry,
  };
};

const createRuntime = (
  initialURL = "https://slides.test/talk?theme=dark",
  initialIndex = 0,
  surface?: PresentationRouteSurface,
) => {
  const machine = createPresentationStateMachine(manifest);
  const store = createPresentationStore(machine);
  const platform = createNavigationHarness(initialURL, initialIndex);
  const changes: PresentationChange[] = [];
  const commit = vi.fn(async (change: PresentationChange) => {
    changes.push(change);
    store.commit(change.to);
  });
  const onError = vi.fn();
  const controller = createPresentationNavigation({
    baseURL: new URL("https://slides.test/talk?theme=dark"),
    commit,
    machine,
    navigation: platform.navigation,
    onError,
    store,
    ...(surface === undefined ? {} : { surface }),
  });
  return { changes, commit, controller, machine, onError, platform, store };
};

describe("presentation Navigation API adapter", () => {
  it("initializes from the URL and caches, rather than sources, entry state", () => {
    const { controller, platform, store } = createRuntime(
      "https://slides.test/talk/1/5?theme=dark",
    );

    expect(controller.initialPosition).toEqual({ slideId: "intro", slideIndex: 0, step: 5 });
    expect(store.getSnapshot()).toEqual(controller.initialPosition);
    expect(platform.updateCurrentEntry).toHaveBeenCalledWith({
      state: { drever: "drever-position-v1", slideId: "intro", step: 5 },
    });
  });

  it("pushes sparse next and previous routes and preserves unrelated query state", async () => {
    const { controller, platform, store } = createRuntime();

    await controller.navigate({ type: "next" });
    expect(platform.navigateCalls[0]).toMatchObject({
      url: "https://slides.test/talk/1/2?theme=dark",
      options: {
        history: "push",
        state: { drever: "drever-position-v1", slideId: "intro", step: 2 },
      },
    });
    expect(store.getSnapshot()).toEqual({ slideId: "intro", slideIndex: 0, step: 2 });

    await controller.navigate({ type: "previous" });
    expect(platform.navigateCalls[1]?.url).toBe("https://slides.test/talk/?theme=dark");
    expect(store.getSnapshot()).toEqual({ slideId: "intro", slideIndex: 0, step: 0 });

    const queryChange = platform.dispatch("https://slides.test/talk?theme=light&mode=present", {
      navigationType: "replace",
    });
    await queryChange.getInterception()?.handler();
    await controller.navigate({ type: "next" });
    expect(platform.navigateCalls[2]?.url).toBe(
      "https://slides.test/talk/1/2?theme=light&mode=present",
    );
  });

  it("preserves a validated synchronized transition intent through route commit", async () => {
    const { changes, controller, platform } = createRuntime();

    await controller.navigate(
      { type: "goTo", slideId: "details", step: 0 },
      { transitionType: "drever-slide-forward" },
    );

    expect(platform.navigateCalls[0]).toMatchObject({
      options: {
        info: {
          drever: "drever-navigation-v1",
          transitionType: "drever-slide-forward",
        },
      },
      url: "https://slides.test/talk/2?theme=dark",
    });
    expect(changes).toEqual([
      expect.objectContaining({
        from: { slideId: "intro", slideIndex: 0, step: 0 },
        to: { slideId: "details", slideIndex: 1, step: 0 },
        transitionType: "drever-slide-forward",
      }),
    ]);
  });

  it("rejects an invalid in-process transition intent before creating history", async () => {
    const { controller, platform } = createRuntime();

    await expect(
      controller.navigate({ type: "next" }, { transitionType: "drever-slide-sideways" } as never),
    ).rejects.toMatchObject({ code: "DREVER_CLIENT_TRANSITION_INVALID" });
    expect(platform.navigateCalls).toEqual([]);
  });

  it("falls back to route semantics when a valid intent is incompatible with the target", async () => {
    const { changes, controller, platform } = createRuntime();

    await controller.navigate(
      { type: "goTo", slideId: "details", step: 0 },
      { transitionType: "drever-step-forward" },
    );

    expect(platform.navigateCalls[0]?.options.info).toEqual({
      drever: "drever-navigation-v1",
      transitionType: "drever-jump-forward",
    });
    expect(changes.at(-1)).toMatchObject({ transitionType: "drever-jump-forward" });
  });

  it("derives rapid commands from the committed URL while React is still pending", async () => {
    const { controller, platform, store } = createRuntime();

    const first = controller.navigate({ type: "next" });
    const second = controller.navigate({ type: "next" });

    expect(store.getSnapshot()).toEqual({ slideId: "intro", slideIndex: 0, step: 0 });
    expect(platform.navigateCalls.map(({ url }) => url)).toEqual([
      "https://slides.test/talk/1/2?theme=dark",
      "https://slides.test/talk/1/5?theme=dark",
    ]);

    await Promise.all([first, second]);
    expect(store.getSnapshot()).toEqual({ slideId: "intro", slideIndex: 0, step: 5 });
  });

  it("synchronously intercepts same-deck routes with manual focus and scroll", async () => {
    const { commit, platform } = createRuntime();
    const harness = platform.dispatch("https://slides.test/talk/2", {
      navigationType: "push",
    });
    const interception = harness.getInterception();

    expect(interception).toMatchObject({ focusReset: "manual", scroll: "manual" });
    expect(commit).not.toHaveBeenCalled();
    await interception?.handler();
    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({
        to: { slideId: "details", slideIndex: 1, step: 0 },
        transitionType: "drever-slide-forward",
      }),
      harness.event.signal,
    );
  });

  it("defaults to audience ownership and leaves reserved speaker paths alone", () => {
    const { platform } = createRuntime();

    expect(platform.dispatch("https://slides.test/talk/2").getInterception()).toBeDefined();
    expect(
      platform.dispatch("https://slides.test/talk/speaker/2").getInterception(),
    ).toBeUndefined();
  });

  it("navigates the speaker surface with the same sparse-step and history contract", async () => {
    const { controller, platform, store } = createRuntime(
      "https://slides.test/talk/speaker?theme=dark#notes",
      0,
      "speaker",
    );

    expect(controller.initialPosition).toEqual({ slideId: "intro", slideIndex: 0, step: 0 });
    await controller.navigate({ type: "next" });
    expect(platform.navigateCalls[0]?.url).toBe(
      "https://slides.test/talk/speaker/1/2?theme=dark#notes",
    );
    expect(store.getSnapshot()).toEqual({ slideId: "intro", slideIndex: 0, step: 2 });

    const destination = platform.dispatch("https://slides.test/talk/speaker/2?theme=dark#notes");
    expect(destination.getInterception()).toMatchObject({
      focusReset: "manual",
      scroll: "manual",
    });
    await destination.getInterception()?.handler();
    expect(store.getSnapshot()).toEqual({ slideId: "details", slideIndex: 1, step: 0 });
    expect(platform.dispatch("https://slides.test/talk/3").getInterception()).toBeUndefined();
  });

  it("does not intercept external, different-path, form, download, hash, reload, or forbidden routes", () => {
    const { platform } = createRuntime();
    const cases: ReadonlyArray<readonly [string, EventOverrides]> = [
      ["https://other.test/talk/2", {}],
      ["https://slides.test/other/2", {}],
      ["https://slides.test/talk/2", { canIntercept: false }],
      ["https://slides.test/talk/2", { formData: {} as FormData }],
      ["https://slides.test/talk/2", { downloadRequest: "deck.pdf" }],
      ["https://slides.test/talk#agenda", { hashChange: true }],
      ["https://slides.test/talk", { navigationType: "reload" }],
    ];

    for (const [url, overrides] of cases) {
      expect(platform.dispatch(url, overrides).getInterception()).toBeUndefined();
    }
  });

  it("cancels invalid same-deck routes and reports the stable route error", () => {
    const { onError, platform } = createRuntime();
    const invalid = platform.dispatch("https://slides.test/talk/missing");

    expect(invalid.getInterception()).toBeUndefined();
    expect(invalid.preventDefault).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "DREVER_CLIENT_ROUTE_INVALID" }),
    );
  });

  it("derives backward and forward traversal direction from history indexes", async () => {
    const { changes, platform } = createRuntime("https://slides.test/talk/2", 10);
    const backward = platform.dispatch("https://slides.test/talk/1/5", {
      index: 9,
      navigationType: "traverse",
    });
    await backward.getInterception()?.handler();
    expect(changes.at(-1)).toMatchObject({ transitionType: "drever-slide-backward" });

    const forward = platform.dispatch("https://slides.test/talk/2", {
      index: 10,
      navigationType: "traverse",
    });
    await forward.getInterception()?.handler();
    expect(changes.at(-1)).toMatchObject({ transitionType: "drever-slide-forward" });
  });

  it("classifies multi-slide traversal as a jump when transient info is unavailable", async () => {
    const { changes, platform } = createRuntime("https://slides.test/talk/3", 12);
    const backward = platform.dispatch("https://slides.test/talk", {
      index: 9,
      navigationType: "traverse",
    });

    await backward.getInterception()?.handler();
    expect(changes.at(-1)).toMatchObject({ transitionType: "drever-jump-backward" });
  });

  it("ignores forged transition info and keeps the URL as route truth", async () => {
    const { changes, platform } = createRuntime();
    const harness = platform.dispatch("https://slides.test/talk/2", {
      info: { drever: "drever-navigation-v1", transitionType: "forged-backward" },
      state: { drever: "drever-position-v1", slideId: "end", step: 0 },
    });
    await harness.getInterception()?.handler();

    expect(changes.at(-1)).toMatchObject({
      to: { slideId: "details", slideIndex: 1, step: 0 },
      transitionType: "drever-slide-forward",
    });
  });

  it("passes abort signals through commits and removes its navigation listener", async () => {
    let receivedSignal: AbortSignal | undefined;
    const commit = vi.fn((_change: PresentationChange, signal: AbortSignal): Promise<void> => {
      receivedSignal = signal;
      return new Promise((_resolve, reject) => {
        const rejectAbort = (): void => reject(signal.reason);
        if (signal.aborted) {
          rejectAbort();
          return;
        }
        signal.addEventListener("abort", rejectAbort, { once: true });
      });
    });
    const machine = createPresentationStateMachine(manifest);
    const store = createPresentationStore(machine);
    const platform = createNavigationHarness("https://slides.test/talk");
    const controller = createPresentationNavigation({
      baseURL: new URL("https://slides.test/talk"),
      commit,
      machine,
      navigation: platform.navigation,
      onError: vi.fn(),
      store,
    });
    const abort = new AbortController();
    const harness = platform.dispatch("https://slides.test/talk/2", {
      signal: abort.signal,
    });
    const handled = harness.getInterception()?.handler();
    abort.abort();

    await expect(handled).rejects.toMatchObject({ name: "AbortError" });
    expect(receivedSignal).toBe(abort.signal);
    controller.dispose();
    expect(platform.hasListener()).toBe(false);
    expect(platform.dispatch("https://slides.test/talk/3").getInterception()).toBeUndefined();
  });
});

import type { MDXContent } from "@drever/core";
import { DECK_MANIFEST_VERSION, type DeckManifest } from "@drever/schema";
import { isValidElement, StrictMode, type ReactNode } from "react";
import type { Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { AttachKeyboardNavigationOptions } from "./keyboard.ts";
import type {
  CreatePresentationNavigationOptions,
  NavigationLike,
  PresentationNavigation,
} from "./navigation.ts";
import type { ViewerPlatform } from "./platform-support.ts";
import type {
  CreateSpeakerSyncOptions,
  PresentationChannel,
  SpeakerPresentationSync,
} from "./presentation-sync.ts";
import type { RehearsalStore } from "./rehearsal.ts";
import type { SpeakerHostProps } from "./speaker.tsx";
import { createSpeaker, type CreateSpeakerOptions } from "./create-speaker.tsx";

const dependencies = vi.hoisted(() => ({
  attachKeyboardNavigation: vi.fn(),
  createBrowserPresentationChannel: vi.fn(),
  createPresentationNavigation: vi.fn(),
  createRehearsalStore: vi.fn(),
  createRoot: vi.fn(),
  createSpeakerSync: vi.fn(),
  requireViewerPlatform: vi.fn(),
  SpeakerHost: vi.fn(() => null),
}));

vi.mock("react-dom/client", () => ({ createRoot: dependencies.createRoot }));
vi.mock("./keyboard.ts", () => ({
  attachKeyboardNavigation: dependencies.attachKeyboardNavigation,
}));
vi.mock("./navigation.ts", () => ({
  createPresentationNavigation: dependencies.createPresentationNavigation,
}));
vi.mock("./platform-support.ts", () => ({
  requireViewerPlatform: dependencies.requireViewerPlatform,
}));
vi.mock("./presentation-sync.ts", () => ({
  createBrowserPresentationChannel: dependencies.createBrowserPresentationChannel,
  createSpeakerSync: dependencies.createSpeakerSync,
}));
vi.mock("./rehearsal.ts", () => ({ createRehearsalStore: dependencies.createRehearsalStore }));
vi.mock("./speaker.tsx", () => ({ SpeakerHost: dependencies.SpeakerHost }));

const manifest = {
  version: DECK_MANIFEST_VERSION,
  slides: [
    { id: "intro", index: 0, speakerNotes: [], stepStops: [2] },
    { id: "details", index: 1, speakerNotes: [], stepStops: [] },
  ],
} as const satisfies DeckManifest;

const Content: MDXContent = () => null;

const flushMicrotasks = async (): Promise<void> => {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
};

const hostPropsFrom = (node: ReactNode): SpeakerHostProps => {
  if (!isValidElement<{ children: ReactNode }>(node) || node.type !== StrictMode) {
    throw new Error("createSpeaker must render a React StrictMode boundary.");
  }
  const host = node.props.children;
  if (!isValidElement<SpeakerHostProps>(host) || host.type !== dependencies.SpeakerHost) {
    throw new Error("createSpeaker must render SpeakerHost inside StrictMode.");
  }
  return host.props;
};

type HarnessOptions = Readonly<{
  autoMount?: boolean;
  currentURL?: string;
}>;

const createHarness = ({
  autoMount = true,
  currentURL = "https://slides.test/talk/speaker/1/2?theme=dark#notes",
}: HarnessOptions = {}) => {
  const events: string[] = [];
  const document = { URL: currentURL } as Document;
  const container = { ownerDocument: document } as Element;
  const navigationSurface = {
    currentEntry: { getState: () => undefined, index: 0, url: currentURL },
  } as NavigationLike;
  const open = vi.fn();
  class TestBroadcastChannel {
    addEventListener(): void {}
    close(): void {}
    postMessage(): void {}
    removeEventListener(): void {}
  }
  const platform: ViewerPlatform = {
    channelView: { BroadcastChannel: TestBroadcastChannel },
    document,
    keyboardTarget: document,
    navigation: navigationSurface,
    view: { open } as unknown as Window,
  };

  let hostProps: SpeakerHostProps | undefined;
  let rendered: ReactNode;
  const rootUnmount = vi.fn(() => events.push("root:unmount"));
  const root: Root = {
    render(node) {
      events.push("root:render");
      rendered = node;
      hostProps = hostPropsFrom(node);
      if (autoMount) {
        queueMicrotask(() => hostProps?.onMounted());
      }
    },
    unmount: rootUnmount,
  };

  const navigationDispose = vi.fn(() => events.push("navigation:dispose"));
  const navigationController: PresentationNavigation = {
    dispose: navigationDispose,
    initialPosition: { slideId: "intro", slideIndex: 0, step: 2 },
    navigate: vi.fn(async () => undefined),
  };
  const channel: PresentationChannel = {
    addEventListener: vi.fn(),
    close: vi.fn(),
    postMessage: vi.fn(),
    removeEventListener: vi.fn(),
  };
  const syncDispose = vi.fn(() => events.push("sync:dispose"));
  const syncPublish = vi.fn();
  const syncPublishLaser = vi.fn();
  const sync: SpeakerPresentationSync = {
    dispose: syncDispose,
    publish: syncPublish,
    publishLaser: syncPublishLaser,
  };
  const rehearsalDestroy = vi.fn();
  const rehearsalCommitPosition = vi.fn();
  const rehearsal: RehearsalStore = {
    commitPosition: rehearsalCommitPosition,
    destroy: rehearsalDestroy,
    getSnapshot: vi.fn(() => ({
      currentSlideElapsedMs: 0,
      currentSlideId: "intro",
      elapsedMs: 0,
      running: true,
      slides: [
        { elapsedMs: 0, slideId: "intro", slideIndex: 0, visits: 1 },
        { elapsedMs: 0, slideId: "details", slideIndex: 1, visits: 0 },
      ],
    })),
    pause: vi.fn(),
    reset: vi.fn(),
    resume: vi.fn(),
    setTargetDuration: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    toggle: vi.fn(),
  };
  const keyboardDispose = vi.fn(() => events.push("keyboard:dispose"));
  let keyboardOptions: AttachKeyboardNavigationOptions | undefined;
  let navigationOptions: CreatePresentationNavigationOptions | undefined;
  let syncOptions: CreateSpeakerSyncOptions | undefined;

  dependencies.requireViewerPlatform.mockReturnValue(platform);
  dependencies.createRoot.mockImplementation(() => root);
  dependencies.createPresentationNavigation.mockImplementation(
    (options: CreatePresentationNavigationOptions): PresentationNavigation => {
      events.push("navigation:attach");
      navigationOptions = options;
      return navigationController;
    },
  );
  dependencies.createBrowserPresentationChannel.mockImplementation(
    (_view: ViewerPlatform["channelView"], baseURL: URL): PresentationChannel => {
      events.push(`channel:create:${baseURL.href}`);
      return channel;
    },
  );
  dependencies.createSpeakerSync.mockImplementation(
    (options: CreateSpeakerSyncOptions): SpeakerPresentationSync => {
      events.push("sync:attach");
      syncOptions = options;
      return sync;
    },
  );
  dependencies.createRehearsalStore.mockReturnValue(rehearsal);
  dependencies.attachKeyboardNavigation.mockImplementation(
    (options: AttachKeyboardNavigationOptions): (() => void) => {
      events.push("keyboard:attach");
      keyboardOptions = options;
      return keyboardDispose;
    },
  );

  return {
    channel,
    container,
    events,
    get hostProps(): SpeakerHostProps {
      if (hostProps === undefined) {
        throw new Error("SpeakerHost has not been rendered.");
      }
      return hostProps;
    },
    get keyboardOptions(): AttachKeyboardNavigationOptions {
      if (keyboardOptions === undefined) {
        throw new Error("Keyboard navigation has not been attached.");
      }
      return keyboardOptions;
    },
    mount(): void {
      hostProps?.onMounted();
    },
    navigationController,
    get navigationOptions(): CreatePresentationNavigationOptions {
      if (navigationOptions === undefined) {
        throw new Error("Presentation navigation has not been attached.");
      }
      return navigationOptions;
    },
    open,
    options(overrides: Partial<CreateSpeakerOptions> = {}): CreateSpeakerOptions {
      return {
        baseURL: "https://slides.test/talk/",
        Content,
        container,
        manifest,
        ...overrides,
      };
    },
    rendered: (): ReactNode => rendered,
    rehearsal,
    rehearsalCommitPosition,
    rehearsalDestroy,
    rootUnmount,
    syncDispose,
    syncPublish,
    syncPublishLaser,
    get syncOptions(): CreateSpeakerSyncOptions {
      if (syncOptions === undefined) {
        throw new Error("Speaker synchronization has not been attached.");
      }
      return syncOptions;
    },
  };
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createSpeaker", () => {
  it("forwards focus-tool appearance to the speaker laser", async () => {
    const harness = createHarness();
    const focusTools = { laser: { color: "#ff4567" } } as const;

    const speaker = await createSpeaker(harness.options({ focusTools }));

    expect(harness.hostProps.focusTools).toBe(focusTools);
    await speaker.destroy();
  });

  it("waits for the mounted speaker UI before owning navigation and sync", async () => {
    const harness = createHarness({ autoMount: false });
    const runSetup = vi.fn(() => undefined);
    let settled = false;
    const creation = createSpeaker(
      harness.options({
        rehearsal: { targetDurationMs: 20 * 60_000 },
        runtime: { runSetup },
      }),
    ).finally(() => {
      settled = true;
    });

    await flushMicrotasks();
    expect(settled).toBe(false);
    expect(isValidElement(harness.rendered())).toBe(true);
    expect(dependencies.createPresentationNavigation).not.toHaveBeenCalled();
    expect(dependencies.createSpeakerSync).not.toHaveBeenCalled();
    expect(dependencies.attachKeyboardNavigation).not.toHaveBeenCalled();
    expect(runSetup).not.toHaveBeenCalled();

    harness.mount();
    const speaker = await creation;

    expect(harness.hostProps.store.getSnapshot()).toEqual({
      slideId: "intro",
      slideIndex: 0,
      step: 2,
    });
    expect(harness.hostProps.rehearsal).toBe(harness.rehearsal);
    expect(dependencies.createRehearsalStore).toHaveBeenCalledWith({
      initialPosition: { slideId: "intro", slideIndex: 0, step: 2 },
      manifest: expect.objectContaining({ version: DECK_MANIFEST_VERSION }),
      targetDurationMs: 20 * 60_000,
    });
    expect(harness.navigationOptions.surface).toBe("speaker");
    expect(harness.navigationOptions.baseURL.href).toBe("https://slides.test/talk/");
    expect(harness.syncOptions.store).toBe(harness.navigationOptions.store);
    expect(harness.keyboardOptions.surface).toBe("speaker");
    expect(harness.events).toEqual([
      "root:render",
      "navigation:attach",
      "channel:create:https://slides.test/talk/",
      "sync:attach",
      "keyboard:attach",
    ]);

    await speaker.destroy();
  });

  it("routes speaker controls through navigation and opens the matching audience URL", async () => {
    const harness = createHarness();
    const speaker = await createSpeaker(harness.options());

    await harness.hostProps.onNavigate({ type: "next" });
    await harness.keyboardOptions.onCommand("last");
    await speaker.navigate({ slideId: "details", step: 0, type: "goTo" });

    expect(harness.navigationController.navigate).toHaveBeenNthCalledWith(1, { type: "next" });
    expect(harness.navigationController.navigate).toHaveBeenNthCalledWith(2, { type: "last" });
    expect(harness.navigationController.navigate).toHaveBeenNthCalledWith(3, {
      slideId: "details",
      step: 0,
      type: "goTo",
    });

    harness.navigationOptions.store.commit({ slideId: "details", slideIndex: 1, step: 0 });
    harness.hostProps.onOpenAudience();
    expect(harness.open).toHaveBeenCalledWith(
      "https://slides.test/talk/2?theme=dark#notes",
      "_blank",
      "noopener",
    );

    await speaker.destroy();
  });

  it("publishes the exact transition only after the speaker route commits it", async () => {
    const harness = createHarness();
    const speaker = await createSpeaker(harness.options());
    const change = {
      from: { slideId: "intro", slideIndex: 0, step: 2 },
      to: { slideId: "details", slideIndex: 1, step: 0 },
      transitionType: "drever-slide-forward",
    } as const;

    await harness.navigationOptions.commit(change, new AbortController().signal);

    expect(harness.rehearsalCommitPosition).toHaveBeenCalledOnce();
    expect(harness.rehearsalCommitPosition).toHaveBeenCalledWith(change.to);
    expect(harness.navigationOptions.store.getSnapshot()).toEqual(change.to);
    expect(harness.syncPublish).toHaveBeenCalledOnce();
    expect(harness.syncPublish).toHaveBeenCalledWith("drever-slide-forward");
    await speaker.destroy();
  });

  it("connects the speaker laser surface to transient presentation sync", async () => {
    const harness = createHarness();
    const speaker = await createSpeaker(harness.options());
    const point = { x: 0.25, y: 0.75 } as const;

    harness.hostProps.onLaser(point);
    harness.hostProps.onLaser();

    expect(harness.syncPublishLaser).toHaveBeenNthCalledWith(1, point);
    expect(harness.syncPublishLaser).toHaveBeenNthCalledWith(2, undefined);
    await speaker.destroy();
  });

  it("owns setup and sync for one idempotent, ordered lifetime", async () => {
    const harness = createHarness();
    const { events } = harness;
    const setupDispose = vi.fn(() => {
      events.push("setup:dispose");
    });
    const speaker = await createSpeaker(
      harness.options({
        runtime: {
          runSetup(runtime) {
            events.push("setup:acquire");
            expect(runtime.getPosition()).toEqual({
              slideId: "intro",
              slideIndex: 0,
              step: 2,
            });
            expect(runtime.surface).toBe("speaker");
            return setupDispose;
          },
        },
      }),
    );

    const first = speaker.destroy();
    const second = speaker.destroy();

    expect(second).toBe(first);
    await first;
    expect(events.slice(-5)).toEqual([
      "keyboard:dispose",
      "sync:dispose",
      "navigation:dispose",
      "root:unmount",
      "setup:dispose",
    ]);
    expect(harness.syncDispose).toHaveBeenCalledOnce();
    expect(harness.navigationController.dispose).toHaveBeenCalledOnce();
    expect(harness.rootUnmount).toHaveBeenCalledOnce();
    expect(harness.rehearsalDestroy).toHaveBeenCalledOnce();
    expect(setupDispose).toHaveBeenCalledOnce();
  });

  it("rolls back every acquired browser resource when runtime setup fails", async () => {
    const harness = createHarness();
    const onError = vi.fn();
    const cause = new Error("speaker setup failed");

    await expect(
      createSpeaker(
        harness.options({
          onError,
          runtime: {
            runSetup: () => {
              throw cause;
            },
          },
        }),
      ),
    ).rejects.toMatchObject({ cause, code: "DREVER_CLIENT_SETUP_FAILED" });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ cause, code: "DREVER_CLIENT_SETUP_FAILED" }),
    );
    expect(harness.events.slice(-4)).toEqual([
      "keyboard:dispose",
      "sync:dispose",
      "navigation:dispose",
      "root:unmount",
    ]);
    expect(harness.syncDispose).toHaveBeenCalledOnce();
    expect(harness.navigationController.dispose).toHaveBeenCalledOnce();
    expect(harness.rootUnmount).toHaveBeenCalledOnce();
    expect(harness.rehearsalDestroy).toHaveBeenCalledOnce();
  });
});

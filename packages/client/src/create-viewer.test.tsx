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
import type { DeckPosition, PresentationChange } from "./presentation-state.ts";
import type { ViewerHostProps } from "./viewer.tsx";
import {
  createViewer,
  type CreateViewerOptions,
  type ViewerDisposer,
  type ViewerRuntime,
  type ViewerRuntimeTheme,
} from "./create-viewer.tsx";

const dependencies = vi.hoisted(() => ({
  attachKeyboardNavigation: vi.fn(),
  createPresentationNavigation: vi.fn(),
  createRoot: vi.fn(),
  requireViewerPlatform: vi.fn(),
  ViewerHost: vi.fn(() => null),
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
vi.mock("./viewer.tsx", () => ({
  ViewerHost: dependencies.ViewerHost,
}));

const manifest = {
  version: DECK_MANIFEST_VERSION,
  slides: [
    { id: "intro", index: 0, speakerNotes: [], stepStops: [2] },
    { id: "details", index: 1, speakerNotes: [], stepStops: [] },
  ],
} as const satisfies DeckManifest;

const Content: MDXContent = () => null;

const runtimeTheme = {
  id: "@drever/theme-test",
  tokens: {},
  motion: {
    id: "editorial",
    intents: ["focus", "continuity"],
    guidance: ["Preserve spatial context between related slides."],
  },
  manifest: { title: "Test", summary: "A deterministic test theme." },
} as const satisfies ViewerRuntimeTheme;

const deferred = <Value,>() => {
  let resolve: ((value: Value) => void) | undefined;
  let reject: ((error: unknown) => void) | undefined;
  const promise = new Promise<Value>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return {
    promise,
    reject: (error: unknown): void => reject?.(error),
    resolve: (value: Value): void => resolve?.(value),
  };
};

const flushMicrotasks = async (): Promise<void> => {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
};

type RootCallbacks = Readonly<{
  onRecoverableError(error: unknown): void;
  onUncaughtError(error: unknown): void;
}>;

type HarnessOptions = Readonly<{
  autoMount?: boolean;
  clipboard?: boolean;
  currentURL?: string;
  teardownErrors?: Partial<
    Readonly<{
      keyboard: unknown;
      navigation: unknown;
      root: unknown;
    }>
  >;
}>;

const hostPropsFrom = (node: ReactNode): ViewerHostProps => {
  if (!isValidElement<{ children: ReactNode }>(node) || node.type !== StrictMode) {
    throw new Error("createViewer must render a React StrictMode boundary.");
  }
  const host = node.props.children;
  if (!isValidElement<ViewerHostProps>(host) || host.type !== dependencies.ViewerHost) {
    throw new Error("createViewer must render ViewerHost inside StrictMode.");
  }
  return host.props;
};

const createHarness = ({
  autoMount = true,
  clipboard = true,
  currentURL = "https://slides.test/talk",
  teardownErrors = {},
}: HarnessOptions = {}) => {
  const events: string[] = [];
  const document = { URL: currentURL } as Document;
  const container = { ownerDocument: document } as Element;
  const navigationSurface = {
    currentEntry: {
      getState: () => undefined,
      index: 0,
      url: currentURL,
    },
  } as NavigationLike;
  class TestBroadcastChannel {
    addEventListener(): void {}
    close(): void {}
    postMessage(): void {}
    removeEventListener(): void {}
  }
  const open = vi.fn(() => null);
  const writeText = vi.fn(async () => undefined);
  const platform: ViewerPlatform = {
    channelView: { BroadcastChannel: TestBroadcastChannel },
    ...(clipboard ? { clipboard: { writeText } } : {}),
    document,
    keyboardTarget: document,
    navigation: navigationSurface,
    view: {
      matchMedia: () => ({ matches: false }),
      open,
    } as unknown as Window,
  };
  let hostProps: ViewerHostProps | undefined;
  let unregisterCommit: (() => void) | undefined;
  const viewerCommit = vi.fn(async (change: PresentationChange, signal: AbortSignal) => {
    if (signal.aborted) {
      throw signal.reason;
    }
    hostProps?.store.commit(change.to);
  });
  const rootUnmount = vi.fn(() => {
    events.push("root:unmount");
    unregisterCommit?.();
    unregisterCommit = undefined;
    if (teardownErrors.root !== undefined) {
      throw teardownErrors.root;
    }
  });
  let rendered: ReactNode;
  let rootCallbacks: RootCallbacks | undefined;
  const mountHost = (): void => {
    if (hostProps === undefined) {
      return;
    }
    unregisterCommit ??= hostProps.registerCommit(viewerCommit);
    hostProps.onMounted();
  };
  const root: Root = {
    render(node) {
      events.push("root:render");
      rendered = node;
      hostProps = hostPropsFrom(node);
      if (autoMount) {
        queueMicrotask(mountHost);
      }
    },
    unmount: rootUnmount,
  };
  const keyboardDispose = vi.fn(() => {
    events.push("keyboard:dispose");
    if (teardownErrors.keyboard !== undefined) {
      throw teardownErrors.keyboard;
    }
  });
  const navigationDispose = vi.fn(() => {
    events.push("navigation:dispose");
    if (teardownErrors.navigation !== undefined) {
      throw teardownErrors.navigation;
    }
  });
  const navigationController: PresentationNavigation = {
    dispose: navigationDispose,
    initialPosition: { slideId: "intro", slideIndex: 0, step: 0 },
    navigate: vi.fn(async () => undefined),
  };
  let keyboardOptions: AttachKeyboardNavigationOptions | undefined;
  let navigationOptions: CreatePresentationNavigationOptions | undefined;

  dependencies.requireViewerPlatform.mockReturnValue(platform);
  dependencies.createRoot.mockImplementation(
    (_target: Element, callbacks?: RootCallbacks): Root => {
      rootCallbacks = callbacks;
      return root;
    },
  );
  dependencies.createPresentationNavigation.mockImplementation(
    (options: CreatePresentationNavigationOptions): PresentationNavigation => {
      events.push("navigation:attach");
      navigationOptions = options;
      return navigationController;
    },
  );
  dependencies.attachKeyboardNavigation.mockImplementation(
    (options: AttachKeyboardNavigationOptions): (() => void) => {
      events.push("keyboard:attach");
      keyboardOptions = options;
      return keyboardDispose;
    },
  );

  return {
    container,
    events,
    failRender(error: unknown): void {
      rootCallbacks?.onUncaughtError(error);
    },
    get hostProps(): ViewerHostProps {
      if (hostProps === undefined) {
        throw new Error("ViewerHost has not been rendered.");
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
      mountHost();
    },
    navigationController,
    get navigationOptions(): CreatePresentationNavigationOptions {
      if (navigationOptions === undefined) {
        throw new Error("Presentation navigation has not been attached.");
      }
      return navigationOptions;
    },
    options(overrides: Partial<CreateViewerOptions> = {}): CreateViewerOptions {
      return { baseURL: "https://slides.test/talk/", Content, container, manifest, ...overrides };
    },
    open,
    writeText,
    rendered: (): ReactNode => rendered,
    rootUnmount,
    viewerCommit,
  };
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createViewer lifecycle", () => {
  it("waits for the stable StrictMode mount before acquiring browser listeners", async () => {
    const harness = createHarness({ autoMount: false });
    const runSetup = vi.fn(() => undefined);
    let settled = false;
    const creation = createViewer(
      harness.options({ runtime: { runSetup, theme: runtimeTheme } }),
    ).finally(() => {
      settled = true;
    });

    await flushMicrotasks();
    expect(settled).toBe(false);
    expect(isValidElement(harness.rendered())).toBe(true);
    expect(dependencies.createPresentationNavigation).not.toHaveBeenCalled();
    expect(dependencies.attachKeyboardNavigation).not.toHaveBeenCalled();
    expect(runSetup).not.toHaveBeenCalled();

    harness.mount();
    harness.mount();
    const viewer = await creation;

    expect(dependencies.createPresentationNavigation).toHaveBeenCalledOnce();
    expect(dependencies.attachKeyboardNavigation).toHaveBeenCalledOnce();
    expect(runSetup).toHaveBeenCalledOnce();
    expect(runSetup).toHaveBeenCalledWith(
      expect.objectContaining({ surface: "audience", theme: runtimeTheme }),
    );
    await viewer.destroy();
  });

  it("delegates Navigation commits to the mounted React viewer", async () => {
    const harness = createHarness();
    const viewer = await createViewer(harness.options());
    const change = {
      from: { slideId: "intro", slideIndex: 0, step: 0 },
      to: { slideId: "details", slideIndex: 1, step: 0 },
      transitionType: "drever-slide-forward",
    } as const satisfies PresentationChange;

    await harness.navigationOptions.commit(change, new AbortController().signal);

    expect(harness.viewerCommit).toHaveBeenCalledOnce();
    expect(harness.viewerCommit).toHaveBeenCalledWith(change, expect.any(AbortSignal));
    expect(harness.navigationOptions.store.getSnapshot()).toEqual(change.to);

    const aborted = new AbortController();
    const reason = new DOMException("superseded before React commit", "AbortError");
    aborted.abort(reason);
    await expect(harness.navigationOptions.commit(change, aborted.signal)).rejects.toBe(reason);
    expect(harness.viewerCommit).toHaveBeenCalledOnce();

    await viewer.destroy();
    await expect(
      harness.navigationOptions.commit(change, new AbortController().signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects a pre-aborted signal without acquiring platform resources", async () => {
    const harness = createHarness();
    const controller = new AbortController();
    const reason = new DOMException("cancelled before creation", "AbortError");
    controller.abort(reason);

    await expect(createViewer(harness.options({ signal: controller.signal }))).rejects.toBe(reason);
    expect(dependencies.requireViewerPlatform).not.toHaveBeenCalled();
    expect(dependencies.createRoot).not.toHaveBeenCalled();
  });

  it("does not acquire listeners when mount and abort settle in the same turn", async () => {
    const harness = createHarness({ autoMount: false });
    const controller = new AbortController();
    const reason = new DOMException("aborted while mounting", "AbortError");
    const creation = createViewer(harness.options({ signal: controller.signal }));
    await flushMicrotasks();

    harness.mount();
    controller.abort(reason);

    await expect(creation).rejects.toBe(reason);
    expect(dependencies.createPresentationNavigation).not.toHaveBeenCalled();
    expect(dependencies.attachKeyboardNavigation).not.toHaveBeenCalled();
    expect(harness.rootUnmount).toHaveBeenCalledOnce();
  });

  it("releases core resources immediately and a setup resource that arrives after abort", async () => {
    const harness = createHarness();
    const controller = new AbortController();
    const acquisition = deferred<void | ViewerDisposer>();
    const lateDispose = vi.fn(() => {
      harness.events.push("setup:late-dispose");
    });
    const runSetup = vi.fn((_runtime: ViewerRuntime) => acquisition.promise);
    const creation = createViewer(
      harness.options({ runtime: { runSetup }, signal: controller.signal }),
    );
    await flushMicrotasks();
    expect(runSetup).toHaveBeenCalledOnce();

    const reason = new DOMException("external lifetime ended", "AbortError");
    controller.abort(reason);
    await expect(creation).rejects.toBe(reason);

    expect(harness.events).toContain("keyboard:dispose");
    expect(harness.events).toContain("navigation:dispose");
    expect(harness.events).toContain("root:unmount");
    expect(lateDispose).not.toHaveBeenCalled();

    acquisition.resolve(lateDispose);
    await acquisition.promise;
    await flushMicrotasks();
    expect(lateDispose).toHaveBeenCalledOnce();
  });

  it("lets an external signal close an already-created viewer exactly once", async () => {
    const harness = createHarness();
    const controller = new AbortController();
    const setupDispose = vi.fn();
    const viewer = await createViewer(
      harness.options({
        runtime: { runSetup: () => setupDispose },
        signal: controller.signal,
      }),
    );
    const listener = vi.fn();
    viewer.subscribe(listener);
    const reason = new DOMException("host removed the viewer", "AbortError");

    controller.abort(reason);
    await viewer.destroy();
    await viewer.destroy();

    expect(harness.rootUnmount).toHaveBeenCalledOnce();
    expect(harness.navigationController.dispose).toHaveBeenCalledOnce();
    expect(setupDispose).toHaveBeenCalledOnce();
    harness.navigationOptions.store.commit({ slideId: "details", slideIndex: 1, step: 0 });
    expect(listener).not.toHaveBeenCalled();
    await expect(viewer.navigate({ type: "next" })).rejects.toBe(reason);
  });

  it("makes destroy idempotent and waits only for the acquired setup disposer", async () => {
    const harness = createHarness();
    const disposal = deferred<void>();
    const setupDispose = vi.fn(() => {
      harness.events.push("setup:dispose");
      return disposal.promise;
    });
    const viewer = await createViewer(
      harness.options({ runtime: { runSetup: () => setupDispose } }),
    );

    const first = viewer.destroy();
    const second = viewer.destroy();

    expect(second).toBe(first);
    expect(harness.events.slice(-4)).toEqual([
      "keyboard:dispose",
      "navigation:dispose",
      "root:unmount",
      "setup:dispose",
    ]);
    expect(setupDispose).toHaveBeenCalledOnce();

    disposal.resolve();
    await first;
    await second;
    expect(harness.rootUnmount).toHaveBeenCalledOnce();
    expect(harness.navigationController.dispose).toHaveBeenCalledOnce();
  });

  it("owns handle subscriptions and reports subscriber failures without stopping peers", async () => {
    const harness = createHarness();
    const onError = vi.fn();
    const viewer = await createViewer(harness.options({ onError }));
    const failure = new Error("listener failed");
    const failingListener = vi.fn(() => {
      throw failure;
    });
    const peerListener = vi.fn();
    const unsubscribeFailing = viewer.subscribe(failingListener);
    viewer.subscribe(peerListener);

    const details: DeckPosition = { slideId: "details", slideIndex: 1, step: 0 };
    harness.navigationOptions.store.commit(details);

    expect(failingListener).toHaveBeenCalledOnce();
    expect(peerListener).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "DREVER_CLIENT_SUBSCRIBER_FAILED", cause: failure }),
    );

    unsubscribeFailing();
    harness.navigationOptions.store.commit({ slideId: "intro", slideIndex: 0, step: 0 });
    expect(failingListener).toHaveBeenCalledOnce();
    expect(peerListener).toHaveBeenCalledTimes(2);

    await viewer.destroy();
    harness.navigationOptions.store.commit(details);
    expect(peerListener).toHaveBeenCalledTimes(2);
    expect(() => viewer.subscribe(vi.fn())).toThrowError(
      expect.objectContaining({ name: "AbortError" }),
    );
    await expect(viewer.navigate({ type: "next" })).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("opens the speaker view at the current clean path while preserving application URL state", async () => {
    const harness = createHarness({
      currentURL: "https://slides.test/talk/1/2?theme=dark#notes",
    });
    const viewer = await createViewer(harness.options());

    await harness.keyboardOptions.onOpenSpeaker?.();

    expect(harness.open).toHaveBeenCalledOnce();
    expect(harness.open).toHaveBeenCalledWith(
      "https://slides.test/talk/speaker/1/2?theme=dark#notes",
      "_blank",
      "noopener",
    );
    await viewer.destroy();
  });

  it("copies the canonical URL for the exact visible slide and Step", async () => {
    const harness = createHarness({
      currentURL: "https://slides.test/talk?theme=dark#notes",
    });
    const viewer = await createViewer(harness.options({ baseURL: "https://slides.test/talk" }));

    await harness.hostProps.onCopyShareURL({ slideId: "intro", slideIndex: 0, step: 2 });

    expect(harness.writeText).toHaveBeenCalledOnce();
    expect(harness.writeText).toHaveBeenCalledWith("https://slides.test/talk/1/2?theme=dark#notes");
    await viewer.destroy();
  });

  it("fails copying clearly when the optional Clipboard API is unavailable", async () => {
    const harness = createHarness({ clipboard: false });
    const viewer = await createViewer(harness.options());

    await expect(
      harness.hostProps.onCopyShareURL({ slideId: "intro", slideIndex: 0, step: 0 }),
    ).rejects.toMatchObject({ code: "DREVER_CLIENT_CLIPBOARD_UNAVAILABLE" });
    await viewer.destroy();
  });

  it("normalizes a rejected clipboard write into the client error contract", async () => {
    const failure = new DOMException("Write permission denied.", "NotAllowedError");
    const harness = createHarness();
    harness.writeText.mockRejectedValueOnce(failure);
    const viewer = await createViewer(harness.options());

    await expect(
      harness.hostProps.onCopyShareURL({ slideId: "intro", slideIndex: 0, step: 0 }),
    ).rejects.toMatchObject({
      cause: failure,
      code: "DREVER_CLIENT_CLIPBOARD_WRITE_FAILED",
    });
    await viewer.destroy();
  });

  it("opens the document inside a mount URL without a trailing slash", async () => {
    const harness = createHarness();
    const viewer = await createViewer(harness.options({ baseURL: "https://slides.test/talk" }));

    harness.hostProps.onOpenDocument();

    expect(harness.open).toHaveBeenCalledWith(
      "https://slides.test/talk/document#intro",
      "_blank",
      "noopener",
    );
    await viewer.destroy();
  });

  it("routes the visible audience controls through the owned navigation and speaker surfaces", async () => {
    const harness = createHarness({ currentURL: "https://slides.test/talk/2?theme=dark#notes" });
    const viewer = await createViewer(harness.options());

    await harness.hostProps.onNavigate({ type: "previousSlide" });
    harness.hostProps.onOpenDocument();
    harness.hostProps.onOpenSpeaker();

    expect(harness.navigationController.navigate).toHaveBeenCalledOnce();
    expect(harness.navigationController.navigate).toHaveBeenCalledWith({
      type: "previousSlide",
    });
    expect(harness.open).toHaveBeenCalledWith(
      "https://slides.test/talk/document?theme=dark#details",
      "_blank",
      "noopener",
    );
    expect(harness.open).toHaveBeenCalledWith(
      "https://slides.test/talk/speaker/2?theme=dark#notes",
      "_blank",
      "noopener",
    );
    await viewer.destroy();
  });

  it("releases listeners and the root when setup fails", async () => {
    const harness = createHarness();
    const onError = vi.fn();
    const setupCause = new Error("setup failed");
    const creation = createViewer(
      harness.options({
        onError,
        runtime: {
          runSetup: () => {
            throw setupCause;
          },
        },
      }),
    );

    await expect(creation).rejects.toMatchObject({
      cause: setupCause,
      code: "DREVER_CLIENT_SETUP_FAILED",
    });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "DREVER_CLIENT_SETUP_FAILED" }),
    );
    expect(harness.navigationController.dispose).toHaveBeenCalledOnce();
    expect(harness.rootUnmount).toHaveBeenCalledOnce();
  });

  it("reports a fatal React render once and tears down partial creation", async () => {
    const harness = createHarness({ autoMount: false });
    const onError = vi.fn();
    const fatal = new Error("render failed");
    const creation = createViewer(harness.options({ onError }));

    harness.failRender(fatal);

    await expect(creation).rejects.toBe(fatal);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(fatal);
    expect(harness.rootUnmount).toHaveBeenCalledOnce();
    expect(dependencies.createPresentationNavigation).not.toHaveBeenCalled();
    expect(dependencies.attachKeyboardNavigation).not.toHaveBeenCalled();
  });

  it("continues teardown after failures and reuses the same rejected destroy promise", async () => {
    const failures = {
      keyboard: new Error("keyboard cleanup failed"),
      navigation: new Error("navigation cleanup failed"),
      root: new Error("root cleanup failed"),
      setup: new Error("setup cleanup failed"),
    };
    const harness = createHarness({ teardownErrors: failures });
    const setupDispose = vi.fn(() => {
      harness.events.push("setup:dispose");
      throw failures.setup;
    });
    const viewer = await createViewer(
      harness.options({ runtime: { runSetup: () => setupDispose } }),
    );

    const first = viewer.destroy();
    const second = viewer.destroy();
    let destroyFailure: unknown;
    try {
      await first;
    } catch (error) {
      destroyFailure = error;
    }

    expect(second).toBe(first);
    expect(destroyFailure).toMatchObject({
      cause: failures.keyboard,
      code: "DREVER_CLIENT_DISPOSE_FAILED",
      suppressedErrors: expect.arrayContaining([
        expect.objectContaining({ cause: failures.navigation }),
        expect.objectContaining({ cause: failures.root }),
        expect.objectContaining({ cause: failures.setup }),
      ]),
    });
    await expect(second).rejects.toBe(destroyFailure);
    expect(harness.rootUnmount).toHaveBeenCalledOnce();
    expect(harness.navigationController.dispose).toHaveBeenCalledOnce();
    expect(setupDispose).toHaveBeenCalledOnce();
  });
});

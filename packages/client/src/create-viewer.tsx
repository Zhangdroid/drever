import type { MDXComponents, MDXContent } from "@drever/core";
import type { CanvasDefinition, DeckManifest, PlannedTheme } from "@drever/schema";
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DreverClientError } from "./client-error.ts";
import { attachKeyboardNavigation } from "./keyboard.ts";
import { createPresentationNavigation, type PresentationNavigation } from "./navigation.ts";
import { requireViewerPlatform } from "./platform-support.ts";
import {
  createPresentationStateMachine,
  createPresentationStore,
  type DeckCommand,
  type DeckPosition,
} from "./presentation-state.ts";
import { createPresentationRouteCodec } from "./presentation-route.ts";
import {
  createAudienceSync,
  createBrowserPresentationChannel,
  type PresentationSync,
} from "./presentation-sync.ts";
import {
  abortReason,
  createReporter,
  destroyedReason,
  disposalFailure,
  isSignalAbort,
  reportCleanupFailures,
  setupFailure,
  subscriberFailure,
  validateDisposer,
  type Awaitable,
  type RuntimeDisposer,
} from "./runtime-lifecycle.ts";
import { createReactTransitionBridge } from "./view-transition.ts";
import { createViewerTransitionChannel, ViewerHost } from "./viewer.tsx";
import { releaseLateAcquisition } from "./viewer-lifecycle.ts";

export type ViewerDisposer = RuntimeDisposer;

export type ViewerRuntimeTheme = PlannedTheme;

export type ViewerRuntime = Readonly<{
  container: Element;
  getPosition(): DeckPosition;
  navigate(command: DeckCommand): Promise<void>;
  reportError(error: unknown): void;
  signal: AbortSignal;
  surface: "audience" | "speaker";
  subscribe(listener: () => void): () => void;
  theme?: ViewerRuntimeTheme;
}>;

export type ViewerSetupRunner = (runtime: ViewerRuntime) => Awaitable<void | ViewerDisposer>;

/** Values imported by an application from virtual:drever/runtime. */
export type ViewerRuntimeModule = Readonly<{
  runSetup?: ViewerSetupRunner;
  theme?: ViewerRuntimeTheme;
}>;

export type CreateViewerOptions = Readonly<{
  Content: MDXContent;
  baseURL: string | URL;
  canvas?: CanvasDefinition;
  container: Element;
  manifest: DeckManifest;
  onError?: (error: unknown) => void;
  reducedMotion?: boolean;
  registry?: MDXComponents;
  runtime?: ViewerRuntimeModule;
  signal?: AbortSignal;
}>;

export type ViewerHandle = Readonly<{
  destroy(): Promise<void>;
  getPosition(): DeckPosition;
  navigate(command: DeckCommand): Promise<void>;
  subscribe(listener: () => void): () => void;
}>;

/**
 * Mounts a complete modern-browser viewer and owns every acquired resource.
 * Runtime virtual-module values are parameters so this package stays portable.
 */
export const createViewer = async (options: CreateViewerOptions): Promise<ViewerHandle> => {
  if (options.signal?.aborted === true) {
    throw abortReason(options.signal);
  }

  const platform = requireViewerPlatform(options.container.ownerDocument);
  const report = createReporter(options.onError);
  const machine = createPresentationStateMachine(options.manifest);
  const currentURL = new URL(platform.navigation.currentEntry?.url ?? platform.document.URL);
  const baseURL = new URL(options.baseURL, currentURL);
  const route = createPresentationRouteCodec({ baseURL, machine });
  const speakerRoute = createPresentationRouteCodec({ baseURL, machine, surface: "speaker" });
  const store = createPresentationStore(machine, route.decodeURL(currentURL));
  const transitions = createViewerTransitionChannel();
  const bridge = createReactTransitionBridge(transitions.schedule);
  const lifetime = new AbortController();
  const subscriptions = new Set<() => void>();

  const subscribe = (listener: () => void): (() => void) => {
    if (lifetime.signal.aborted) {
      throw abortReason(lifetime.signal);
    }
    const unsubscribeStore = store.subscribe(() => {
      try {
        listener();
      } catch (error) {
        report(subscriberFailure(error));
      }
    });
    let active = true;
    const unsubscribe = (): void => {
      if (!active) {
        return;
      }
      active = false;
      subscriptions.delete(unsubscribe);
      unsubscribeStore();
    };
    subscriptions.add(unsubscribe);
    return unsubscribe;
  };

  let keyboardDisposer: (() => void) | undefined;
  let navigation: PresentationNavigation | undefined;
  let reactRoot: Root | undefined;
  let setupDisposer: ViewerDisposer | undefined;
  let setupPromise: Promise<void | ViewerDisposer> | undefined;
  let sync: PresentationSync | undefined;
  let destroyPromise: Promise<void> | undefined;
  let fatalRenderError: unknown;

  const navigateFromControls = async (command: DeckCommand): Promise<void> => {
    if (navigation === undefined) {
      throw new DreverClientError(
        "DREVER_CLIENT_VIEWER_NOT_READY",
        "The audience viewer is not ready to navigate.",
      );
    }
    await navigation.navigate(command);
  };
  const copyShareURL = async (position: DeckPosition): Promise<void> => {
    if (platform.clipboard === undefined) {
      throw new DreverClientError(
        "DREVER_CLIENT_CLIPBOARD_UNAVAILABLE",
        "Copying a presentation link requires the Clipboard API in a secure context.",
      );
    }
    const sourceURL = new URL(platform.navigation.currentEntry?.url ?? currentURL.href);
    const shareURL = route.encodeURL(position, sourceURL);
    try {
      await platform.clipboard.writeText(shareURL.href);
    } catch (cause) {
      throw new DreverClientError(
        "DREVER_CLIENT_CLIPBOARD_WRITE_FAILED",
        "The browser could not copy the presentation link.",
        { cause },
      );
    }
  };
  const openSpeaker = (): void => {
    const sourceURL = new URL(platform.navigation.currentEntry?.url ?? currentURL.href);
    const speakerURL = speakerRoute.encodeURL(store.getSnapshot(), sourceURL);
    platform.view.open(speakerURL.href, "_blank", "noopener");
  };
  const openDocument = (): void => {
    const sourceURL = new URL(platform.navigation.currentEntry?.url ?? currentURL.href);
    const documentURL = new URL(baseURL);
    documentURL.pathname = `${route.basePathname}document`;
    documentURL.search = sourceURL.search;
    documentURL.hash = store.getSnapshot().slideId;
    platform.view.open(documentURL.href, "_blank", "noopener");
  };

  const destroyWithReason = (reason: unknown): Promise<void> => {
    if (destroyPromise !== undefined) {
      return destroyPromise;
    }
    destroyPromise = (async () => {
      if (!lifetime.signal.aborted) {
        lifetime.abort(reason);
      }
      options.signal?.removeEventListener("abort", onExternalAbort);
      transitions.close(reason);

      const errors: unknown[] = [];
      const capture = async (release: () => Awaitable<void>): Promise<void> => {
        try {
          await release();
        } catch (error) {
          errors.push(error);
        }
      };
      const captureSync = (release: () => void): void => {
        try {
          release();
        } catch (error) {
          errors.push(error);
        }
      };
      if (keyboardDisposer !== undefined) {
        const dispose = keyboardDisposer;
        keyboardDisposer = undefined;
        captureSync(dispose);
      }
      for (const unsubscribe of subscriptions) {
        captureSync(unsubscribe);
      }
      if (sync !== undefined) {
        const dispose = sync;
        sync = undefined;
        captureSync(() => dispose.dispose());
      }
      if (navigation !== undefined) {
        const dispose = navigation;
        navigation = undefined;
        captureSync(() => dispose.dispose());
      }
      if (reactRoot !== undefined) {
        const root = reactRoot;
        reactRoot = undefined;
        captureSync(() => root.unmount());
      }
      if (setupDisposer !== undefined) {
        const dispose = setupDisposer;
        setupDisposer = undefined;
        await capture(dispose);
      } else if (setupPromise !== undefined) {
        const acquisition = setupPromise;
        setupPromise = undefined;
        releaseLateAcquisition({
          acquisition,
          onAcquisitionError(error) {
            if (!isSignalAbort(error, lifetime.signal)) {
              report(error instanceof DreverClientError ? error : setupFailure(error));
            }
          },
          onDisposalError: (error) => report(disposalFailure(error)),
          resolveDisposer: validateDisposer,
        });
      }

      if (errors.length > 0) {
        reportCleanupFailures(errors);
      }
    })();
    return destroyPromise;
  };

  const onExternalAbort = (): void => {
    const reason = abortReason(options.signal as AbortSignal);
    void destroyWithReason(reason).catch(report);
  };
  options.signal?.addEventListener("abort", onExternalAbort, { once: true });

  const aborted = new Promise<never>((_resolve, reject) => {
    lifetime.signal.addEventListener("abort", () => reject(abortReason(lifetime.signal)), {
      once: true,
    });
  });

  const mounted = Promise.withResolvers<void>();

  try {
    reactRoot = createRoot(options.container, {
      onRecoverableError: report,
      onUncaughtError(error) {
        fatalRenderError = error;
        mounted.reject(error);
        report(error);
        void destroyWithReason(error).catch(report);
      },
    });
    const canvas = options.canvas ?? options.runtime?.theme?.canvas;
    const reducedMotion =
      options.reducedMotion ?? platform.view.matchMedia("(prefers-reduced-motion: reduce)").matches;
    reactRoot.render(
      <StrictMode>
        <ViewerHost
          Content={options.Content}
          {...(canvas === undefined ? {} : { canvas })}
          machine={machine}
          onCopyShareURL={copyShareURL}
          onError={report}
          onMounted={mounted.resolve}
          onNavigate={navigateFromControls}
          onOpenDocument={openDocument}
          onOpenSpeaker={openSpeaker}
          reducedMotion={reducedMotion}
          {...(options.registry === undefined ? {} : { registry: options.registry })}
          store={store}
          transitions={transitions}
        />
      </StrictMode>,
    );
    await Promise.race([mounted.promise, aborted]);
    if (lifetime.signal.aborted) {
      throw abortReason(lifetime.signal);
    }

    const activeNavigation = createPresentationNavigation({
      baseURL,
      commit: bridge.commit,
      machine,
      navigation: platform.navigation,
      onError: report,
      store,
    });
    navigation = activeNavigation;
    const navigate = async (command: DeckCommand): Promise<void> => {
      if (lifetime.signal.aborted) {
        throw abortReason(lifetime.signal);
      }
      await activeNavigation.navigate(command);
    };
    sync = createAudienceSync({
      channel: createBrowserPresentationChannel(platform.channelView, baseURL),
      machine,
      navigate: activeNavigation.navigate,
      onError: report,
    });
    keyboardDisposer = attachKeyboardNavigation({
      target: platform.keyboardTarget,
      onCommand: (command) => activeNavigation.navigate({ type: command }),
      onError: report,
      onOpenSpeaker: openSpeaker,
    });

    const runtime: ViewerRuntime = Object.freeze({
      container: options.container,
      getPosition: store.getSnapshot,
      navigate,
      reportError: report,
      signal: lifetime.signal,
      surface: "audience",
      subscribe,
      ...(options.runtime?.theme === undefined ? {} : { theme: options.runtime.theme }),
    });

    const runSetup = options.runtime?.runSetup;
    if (runSetup !== undefined) {
      setupPromise = Promise.resolve().then(() => runSetup(runtime));

      try {
        setupDisposer = validateDisposer(await Promise.race([setupPromise, aborted]));
        setupPromise = undefined;
      } catch (error) {
        if (!isSignalAbort(error, lifetime.signal)) {
          setupPromise = undefined;
        }
        throw error instanceof DreverClientError || isSignalAbort(error, lifetime.signal)
          ? error
          : setupFailure(error);
      }
    }

    if (lifetime.signal.aborted) {
      throw abortReason(lifetime.signal);
    }

    return Object.freeze({
      destroy: () => destroyWithReason(destroyedReason("viewer")),
      getPosition: store.getSnapshot,
      navigate,
      subscribe,
    });
  } catch (error) {
    if (!isSignalAbort(error, lifetime.signal) && error !== fatalRenderError) {
      report(error);
    }
    try {
      await destroyWithReason(error);
    } catch (cleanupError) {
      report(cleanupError);
    }
    throw error;
  }
};

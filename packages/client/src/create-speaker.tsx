import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DreverClientError } from "./client-error.ts";
import type {
  CreateViewerOptions,
  ViewerDisposer,
  ViewerHandle,
  ViewerRuntime,
} from "./create-viewer.tsx";
import { attachKeyboardNavigation } from "./keyboard.ts";
import { createPresentationNavigation, type PresentationNavigation } from "./navigation.ts";
import { requireViewerPlatform } from "./platform-support.ts";
import {
  createPresentationStateMachine,
  createPresentationStore,
  type DeckCommand,
} from "./presentation-state.ts";
import { createPresentationRouteCodec } from "./presentation-route.ts";
import {
  createBrowserPresentationChannel,
  createSpeakerSync,
  type SpeakerPresentationSync,
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
} from "./runtime-lifecycle.ts";
import { createRehearsalStore } from "./rehearsal.ts";
import { SpeakerHost } from "./speaker.tsx";
import { releaseLateAcquisition } from "./viewer-lifecycle.ts";

export type SpeakerRehearsalOptions = Readonly<{
  targetDurationMs?: number;
}>;

export type CreateSpeakerOptions = Omit<CreateViewerOptions, "reducedMotion"> &
  Readonly<{
    rehearsal?: SpeakerRehearsalOptions;
  }>;
export type SpeakerHandle = ViewerHandle;

/** Mounts the speaker view for a `/speaker` route. */
export const createSpeaker = async (options: CreateSpeakerOptions): Promise<SpeakerHandle> => {
  if (options.signal?.aborted === true) {
    throw abortReason(options.signal);
  }

  const platform = requireViewerPlatform(options.container.ownerDocument);
  const report = createReporter(options.onError);
  const machine = createPresentationStateMachine(options.manifest);
  const currentURL = new URL(platform.navigation.currentEntry?.url ?? platform.document.URL);
  const baseURL = new URL(options.baseURL, currentURL);
  const speakerRoute = createPresentationRouteCodec({ baseURL, machine, surface: "speaker" });
  const audienceRoute = createPresentationRouteCodec({ baseURL, machine });
  const store = createPresentationStore(machine, speakerRoute.decodeURL(currentURL));
  const rehearsal = createRehearsalStore({
    initialPosition: store.getSnapshot(),
    manifest: machine.manifest,
    ...(options.rehearsal?.targetDurationMs === undefined
      ? {}
      : { targetDurationMs: options.rehearsal.targetDurationMs }),
  });
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
  let sync: SpeakerPresentationSync | undefined;
  let destroyPromise: Promise<void> | undefined;
  let fatalRenderError: unknown;

  const destroyWithReason = (reason: unknown): Promise<void> => {
    if (destroyPromise !== undefined) {
      return destroyPromise;
    }
    destroyPromise = (async () => {
      if (!lifetime.signal.aborted) {
        lifetime.abort(reason);
      }
      options.signal?.removeEventListener("abort", onExternalAbort);

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
      captureSync(rehearsal.destroy);
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
    void destroyWithReason(abortReason(options.signal as AbortSignal)).catch(report);
  };
  options.signal?.addEventListener("abort", onExternalAbort, { once: true });

  const aborted = new Promise<never>((_resolve, reject) => {
    lifetime.signal.addEventListener("abort", () => reject(abortReason(lifetime.signal)), {
      once: true,
    });
  });
  const mounted = Promise.withResolvers<void>();

  const navigateFromControls = async (command: DeckCommand): Promise<void> => {
    try {
      if (navigation === undefined) {
        throw new DreverClientError(
          "DREVER_CLIENT_SPEAKER_NOT_READY",
          "The speaker view is not ready to navigate.",
        );
      }
      await navigation.navigate(command);
    } catch (error) {
      report(error);
    }
  };
  const openAudience = (): void => {
    const sourceURL = new URL(platform.navigation.currentEntry?.url ?? currentURL.href);
    const audienceURL = audienceRoute.encodeURL(store.getSnapshot(), sourceURL);
    platform.view.open(audienceURL.href, "_blank", "noopener");
  };

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
    reactRoot.render(
      <StrictMode>
        <SpeakerHost
          Content={options.Content}
          {...(canvas === undefined ? {} : { canvas })}
          machine={machine}
          manifest={machine.manifest}
          onLaser={(point) => sync?.publishLaser(point)}
          onMounted={mounted.resolve}
          onNavigate={navigateFromControls}
          onOpenAudience={openAudience}
          rehearsal={rehearsal}
          {...(options.registry === undefined ? {} : { registry: options.registry })}
          {...(options.stage === undefined ? {} : { stage: options.stage })}
          store={store}
        />
      </StrictMode>,
    );
    await Promise.race([mounted.promise, aborted]);
    if (lifetime.signal.aborted) {
      throw abortReason(lifetime.signal);
    }

    const activeNavigation = createPresentationNavigation({
      baseURL,
      async commit(change, signal) {
        if (signal.aborted) {
          throw abortReason(signal);
        }
        rehearsal.commitPosition(change.to);
        store.commit(change.to);
        sync?.publish(change.transitionType);
      },
      machine,
      navigation: platform.navigation,
      onError: report,
      store,
      surface: "speaker",
    });
    navigation = activeNavigation;
    const navigate = async (command: DeckCommand): Promise<void> => {
      if (lifetime.signal.aborted) {
        throw abortReason(lifetime.signal);
      }
      await activeNavigation.navigate(command);
    };
    sync = createSpeakerSync({
      channel: createBrowserPresentationChannel(platform.channelView, baseURL),
      onError: report,
      store,
    });
    keyboardDisposer = attachKeyboardNavigation({
      target: platform.keyboardTarget,
      onCommand: (command) => activeNavigation.navigate({ type: command }),
      onError: report,
      surface: "speaker",
    });

    const runtime: ViewerRuntime = Object.freeze({
      container: options.container,
      getPosition: store.getSnapshot,
      navigate,
      reportError: report,
      signal: lifetime.signal,
      surface: "speaker",
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
      destroy: () => destroyWithReason(destroyedReason("speaker view")),
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

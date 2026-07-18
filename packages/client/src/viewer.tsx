/// <reference types="react/canary" />

import {
  DreverRenderModeProvider,
  MDXRenderer,
  SlideStateProvider,
  type MDXComponents,
  type MDXContent,
  type DreverRenderMode,
  type ResolvedSlideState,
  type SlideIdentity,
} from "@drever/core";
import type { CanvasDefinition } from "@drever/schema";
import {
  startTransition,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
  type ReactElement,
} from "react";
import { CanvasViewport } from "./canvas.tsx";
import { DreverClientError } from "./client-error.ts";
import type { DeckPosition, PresentationStore } from "./presentation-state.ts";
import {
  startScopedViewTransition,
  type ReactTransitionRequest,
  type ReactTransitionScheduler,
  type ScopedViewTransition,
} from "./view-transition.ts";
import { scheduleStableMountNotification } from "./viewer-lifecycle.ts";

export type ViewerProps = Readonly<{
  Content: MDXContent;
  canvas?: CanvasDefinition;
  manageFocus?: boolean;
  onPositionCommitted?: (position: DeckPosition) => void;
  position: DeckPosition;
  reducedMotion?: boolean;
  registry?: MDXComponents;
  renderMode?: DreverRenderMode;
}>;

const samePosition = (left: DeckPosition, right: DeckPosition): boolean =>
  left.slideId === right.slideId &&
  left.slideIndex === right.slideIndex &&
  left.step === right.step;

export const resolveSlideState = (
  position: DeckPosition,
  slide: SlideIdentity,
): ResolvedSlideState => {
  const identified = slide.id !== undefined || slide.index !== undefined;
  const idMatches = slide.id === undefined || slide.id === position.slideId;
  const indexMatches = slide.index === undefined || slide.index === position.slideIndex;
  const active = identified && idMatches && indexMatches;
  return Object.freeze({ active, currentStep: active ? position.step : 0 });
};

/** A controlled React presentation surface. Navigation is owned by createViewer. */
export const Viewer = (props: ViewerProps): ReactElement => <ViewerSurface {...props} />;

type ViewerSurfaceProps = ViewerProps &
  Readonly<{
    canvasRef?: Ref<HTMLDivElement>;
  }>;

const ViewerSurface = ({
  Content,
  canvas,
  canvasRef,
  manageFocus = true,
  onPositionCommitted,
  position,
  registry,
  renderMode = "audience",
}: ViewerSurfaceProps): ReactElement => {
  const deckRef = useRef<HTMLDivElement>(null);
  const previousSlideRef = useRef(position.slideIndex);
  const resolver = useCallback(
    (slide: SlideIdentity): ResolvedSlideState => resolveSlideState(position, slide),
    [position],
  );

  useLayoutEffect(() => {
    if (!manageFocus) {
      return;
    }
    const deck = deckRef.current;
    if (deck === null) {
      return;
    }
    const activeElement = deck.ownerDocument.activeElement;
    const focusBecameHidden =
      activeElement !== null &&
      deck.contains(activeElement) &&
      activeElement.closest("[inert], [aria-hidden='true']") !== null;
    if (previousSlideRef.current !== position.slideIndex || focusBecameHidden) {
      const activeSlide = deck.querySelector<HTMLElement>(
        '[data-drever-slide][data-slide-state="active"]',
      );
      activeSlide?.focus({ preventScroll: true });
    }
    previousSlideRef.current = position.slideIndex;
  }, [manageFocus, position.slideIndex, position.step]);

  useLayoutEffect(() => {
    onPositionCommitted?.(position);
  }, [onPositionCommitted, position]);

  return (
    <CanvasViewport
      {...(canvas === undefined ? {} : { canvas })}
      {...(canvasRef === undefined ? {} : { canvasRef })}
    >
      <div
        className="drever-deck"
        data-drever-deck=""
        data-drever-render-mode={renderMode}
        ref={deckRef}
      >
        <DreverRenderModeProvider mode={renderMode}>
          <SlideStateProvider resolver={resolver}>
            <MDXRenderer Content={Content} {...(registry === undefined ? {} : { registry })} />
          </SlideStateProvider>
        </DreverRenderModeProvider>
      </div>
    </CanvasViewport>
  );
};

export type ViewerTransitionChannel = Readonly<{
  attach(scheduler: ReactTransitionScheduler): () => void;
  close(error: unknown): void;
  schedule: ReactTransitionScheduler;
}>;

export const createViewerTransitionChannel = (): ViewerTransitionChannel => {
  let closed = false;
  let closeReason: unknown;
  let scheduler: ReactTransitionScheduler | undefined;
  const requests = new Set<ReactTransitionRequest>();

  const schedule = (request: ReactTransitionRequest): void => {
    if (closed) {
      throw closeReason;
    }
    if (scheduler === undefined) {
      throw new DreverClientError(
        "DREVER_CLIENT_VIEWER_NOT_READY",
        "The React viewer is not ready to commit a navigation.",
      );
    }

    let wrapped: ReactTransitionRequest;
    const settle = (callback: () => void): void => {
      if (!requests.delete(wrapped)) {
        return;
      }
      callback();
    };
    wrapped = Object.freeze({
      ...request,
      complete: () => settle(request.complete),
      fail: (error) => settle(() => request.fail(error)),
    });
    requests.add(wrapped);
    try {
      scheduler(wrapped);
    } catch (error) {
      requests.delete(wrapped);
      throw error;
    }
  };

  return Object.freeze({
    attach(nextScheduler) {
      if (closed) {
        throw closeReason;
      }
      if (scheduler !== undefined) {
        throw new DreverClientError(
          "DREVER_CLIENT_VIEWER_ALREADY_MOUNTED",
          "A transition channel can only be attached to one React viewer.",
        );
      }
      scheduler = nextScheduler;
      return () => {
        if (scheduler === nextScheduler) {
          scheduler = undefined;
        }
      };
    },
    close(error) {
      if (closed) {
        return;
      }
      closed = true;
      closeReason =
        error ??
        new DreverClientError(
          "DREVER_CLIENT_VIEWER_CLOSED",
          "The React viewer transition channel is closed.",
        );
      scheduler = undefined;
      for (const request of requests) {
        request.fail(closeReason);
      }
    },
    schedule,
  });
};

export type ViewerHostProps = Omit<ViewerProps, "onPositionCommitted" | "position"> &
  Readonly<{
    onError(error: unknown): void;
    onMounted(): void;
    store: PresentationStore;
    transitions: ViewerTransitionChannel;
  }>;

type PendingTransition = {
  removeAbortListener(): void;
  request: ReactTransitionRequest;
  rejectUpdate?(error: unknown): void;
  resolveUpdate?(): void;
  transition?: ScopedViewTransition;
};

/** @internal Imperative bridge between Navigation interception and React commits. */
export const ViewerHost = ({
  onError,
  onMounted,
  store,
  transitions,
  ...viewerProps
}: ViewerHostProps): ReactElement => {
  const [position, setPosition] = useState(store.getSnapshot);
  const reducedMotion = viewerProps.reducedMotion ?? false;
  const canvasRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<PendingTransition | undefined>(undefined);

  useLayoutEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const next = store.getSnapshot();
      setPosition((current) => (samePosition(current, next) ? current : next));
    });
    const detach = transitions.attach((request) => {
      if (request.signal.aborted) {
        request.fail(request.signal.reason);
        return;
      }

      const previous = pendingRef.current;
      previous?.removeAbortListener();
      const superseded = new DreverClientError(
        "DREVER_CLIENT_NAVIGATION_SUPERSEDED",
        "A newer presentation navigation superseded the pending React commit.",
      );
      previous?.transition?.skipTransition();
      previous?.rejectUpdate?.(superseded);
      previous?.request.fail(superseded);

      const onAbort = (): void => {
        const pending = pendingRef.current;
        if (pending?.request !== request) {
          return;
        }
        pendingRef.current = undefined;
        pending.transition?.skipTransition();
        pending.rejectUpdate?.(request.signal.reason);
        request.fail(request.signal.reason);
        startTransition(() => setPosition(store.getSnapshot()));
      };
      request.signal.addEventListener("abort", onAbort, { once: true });
      const pending: PendingTransition = {
        removeAbortListener: () => request.signal.removeEventListener("abort", onAbort),
        request,
      };
      pendingRef.current = pending;

      try {
        if (reducedMotion) {
          startTransition(() => setPosition(request.change.to));
          return;
        }

        const canvas = canvasRef.current;
        if (canvas === null) {
          throw new DreverClientError(
            "DREVER_CLIENT_VIEWER_NOT_READY",
            "The viewer canvas is not ready to start a scoped transition.",
          );
        }
        const transition = startScopedViewTransition(
          canvas,
          request.transitionType,
          () =>
            new Promise<void>((resolve, reject) => {
              if (pendingRef.current !== pending || request.signal.aborted) {
                reject(request.signal.reason ?? superseded);
                return;
              }
              pending.resolveUpdate = resolve;
              pending.rejectUpdate = reject;
              startTransition(() => setPosition(request.change.to));
            }),
        );
        pending.transition = transition;
        void transition.finished.catch(() => undefined);
        void transition.updateCallbackDone.catch((error: unknown) => {
          if (pendingRef.current !== pending) {
            return;
          }
          pendingRef.current = undefined;
          pending.removeAbortListener();
          request.fail(error);
          onError(error);
        });
      } catch (error) {
        if (pendingRef.current === pending) {
          pendingRef.current = undefined;
        }
        pending.removeAbortListener();
        request.fail(error);
        onError(error);
      }
    });
    const cancelMountNotification = scheduleStableMountNotification(onMounted);

    return () => {
      cancelMountNotification();
      detach();
      unsubscribe();
      const pending = pendingRef.current;
      pendingRef.current = undefined;
      if (pending !== undefined) {
        pending.removeAbortListener();
        pending.transition?.skipTransition();
        const unmounted = new DreverClientError(
          "DREVER_CLIENT_VIEWER_UNMOUNTED",
          "The React viewer unmounted before navigation committed.",
        );
        pending.rejectUpdate?.(unmounted);
        pending.request.fail(unmounted);
      }
    };
  }, [onError, onMounted, reducedMotion, store, transitions]);

  const completeCommit = useCallback(
    (committed: DeckPosition): void => {
      const pending = pendingRef.current;
      if (pending === undefined || !samePosition(pending.request.change.to, committed)) {
        return;
      }

      pendingRef.current = undefined;
      pending.removeAbortListener();
      if (pending.request.signal.aborted) {
        pending.transition?.skipTransition();
        pending.rejectUpdate?.(pending.request.signal.reason);
        pending.request.fail(pending.request.signal.reason);
        startTransition(() => setPosition(store.getSnapshot()));
        return;
      }

      store.commit(pending.request.change.to);
      pending.resolveUpdate?.();
      pending.request.complete();
    },
    [store],
  );

  return (
    <ViewerSurface
      {...viewerProps}
      canvasRef={canvasRef}
      onPositionCommitted={completeCommit}
      position={position}
    />
  );
};

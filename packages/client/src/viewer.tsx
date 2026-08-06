/// <reference types="react/canary" />

import type { SlideManifest } from "@drever/schema";
import {
  startTransition,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { flushSync } from "react-dom";
import { AudienceControls } from "./audience-controls.tsx";
import { DEFAULT_CANVAS } from "./canvas.tsx";
import { DreverClientError, isAbortError } from "./client-error.ts";
import type { PresentationCommit, PresentationNavigationIntent } from "./navigation.ts";
import type { PresentationFocusAppearance } from "./presentation-focus.ts";
import type { PresentationFocusStore } from "./presentation-focus-store.ts";
import type {
  DeckCommand,
  DeckPosition,
  PresentationChange,
  PresentationStateMachine,
  PresentationStore,
} from "./presentation-state.ts";
import {
  resolveLocalSlideTransition,
  setLocalSlideTransitionMode,
  startPresentationViewTransition,
  type PresentationViewTransition,
} from "./view-transition.ts";
import { scheduleStableMountNotification } from "./viewer-lifecycle.ts";
import { ViewerSurface, type ViewerProps } from "./viewer-surface.tsx";

export { Viewer, resolveSlideState } from "./viewer-surface.tsx";
export type { ViewerProps } from "./viewer-surface.tsx";

const samePosition = (left: DeckPosition, right: DeckPosition): boolean =>
  left.slideId === right.slideId &&
  left.slideIndex === right.slideIndex &&
  left.step === right.step;

/** Shows the most complete authored state in a slide overview thumbnail. */
export const resolveSlidePreviewPosition = (slide: SlideManifest): DeckPosition =>
  Object.freeze({
    slideId: slide.id,
    slideIndex: slide.index,
    step: slide.stepStops.at(-1) ?? 0,
  });

export type ViewerCommitRegistrar = (commit: PresentationCommit) => () => void;

export type ViewerHostProps = Omit<ViewerProps, "manifest" | "onPositionCommitted" | "position"> &
  Readonly<{
    focusTools?: PresentationFocusAppearance;
    machine: PresentationStateMachine;
    onCopyShareURL(position: DeckPosition): Promise<void>;
    onError(error: unknown): void;
    onMounted(): void;
    onNavigate(command: DeckCommand, intent?: PresentationNavigationIntent): void | Promise<void>;
    onOpenDocument(): void;
    onOpenSpeaker(): void;
    registerCommit: ViewerCommitRegistrar;
    remoteFocus: PresentationFocusStore;
    store: PresentationStore;
  }>;

type PendingCommit = {
  change: PresentationChange;
  reject(error: unknown): void;
  rejectUpdate?(error: unknown): void;
  removeAbortListener(): void;
  resolve(): void;
  resolveUpdate?(): void;
  signal: AbortSignal;
  transition?: PresentationViewTransition;
};

const navigationAbortReason = (signal: AbortSignal): unknown =>
  signal.reason ?? new DOMException("The presentation navigation was aborted.", "AbortError");

const supersededNavigation = (): DOMException =>
  new DOMException("A newer presentation navigation superseded the pending commit.", "AbortError");

/** @internal Owns the React state commit that unblocks Navigation interception. */
export const ViewerHost = ({
  focusTools,
  machine,
  onCopyShareURL,
  onError,
  onMounted,
  onNavigate,
  onOpenDocument,
  onOpenSpeaker,
  registerCommit,
  remoteFocus,
  store,
  ...viewerProps
}: ViewerHostProps): ReactElement => {
  const [position, setPosition] = useState(store.getSnapshot);
  const [controlsHiddenForNavigation, setControlsHiddenForNavigation] = useState(false);
  const reducedMotion = viewerProps.reducedMotion ?? false;
  const canvasRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<PendingCommit | undefined>(undefined);
  const revealControlsForPointerIntent = useCallback(
    () => setControlsHiddenForNavigation(false),
    [],
  );

  useLayoutEffect(() => {
    return store.subscribe(() => {
      const next = store.getSnapshot();
      setPosition((current) => (samePosition(current, next) ? current : next));
    });
  }, [store]);

  const commit = useCallback<PresentationCommit>(
    (change, signal, options) => {
      if (signal.aborted) {
        return Promise.reject(navigationAbortReason(signal));
      }

      return new Promise<void>((resolve, reject) => {
        const previous = pendingRef.current;
        if (previous !== undefined) {
          pendingRef.current = undefined;
          previous.removeAbortListener();
          const superseded = supersededNavigation();
          previous.transition?.skipTransition();
          previous.rejectUpdate?.(superseded);
          previous.reject(superseded);
        }

        let pending: PendingCommit;
        const onAbort = (): void => {
          if (pendingRef.current !== pending) {
            return;
          }
          pendingRef.current = undefined;
          pending.removeAbortListener();
          const reason = navigationAbortReason(signal);
          pending.transition?.skipTransition();
          const deck = deckRef.current;
          if (deck !== null) {
            setLocalSlideTransitionMode(deck, undefined);
          }
          pending.rejectUpdate?.(reason);
          reject(reason);
          setPosition(store.getSnapshot());
        };
        pending = {
          change,
          reject,
          removeAbortListener: () => signal.removeEventListener("abort", onAbort),
          resolve,
          signal,
        };
        pendingRef.current = pending;
        signal.addEventListener("abort", onAbort, { once: true });

        const changesSlide = change.from.slideIndex !== change.to.slideIndex;
        const deck = deckRef.current;
        if (changesSlide && options?.preserveControls !== true) {
          flushSync(() => setControlsHiddenForNavigation(true));
        }
        if (reducedMotion || !changesSlide || options?.skipViewTransition === true) {
          if (deck !== null) {
            setLocalSlideTransitionMode(deck, undefined);
          }
          setPosition(change.to);
          return;
        }

        if (deck === null) {
          pendingRef.current = undefined;
          pending.removeAbortListener();
          reject(
            new DreverClientError(
              "DREVER_CLIENT_VIEWER_NOT_READY",
              "The presentation deck is not ready to start a View Transition.",
            ),
          );
          return;
        }

        const localTransitionFrom = resolveLocalSlideTransition(deck, change);
        setLocalSlideTransitionMode(deck, localTransitionFrom);
        if (localTransitionFrom !== undefined) {
          setPosition(change.to);
          return;
        }

        try {
          const transition = startPresentationViewTransition(
            deck.ownerDocument,
            change.transitionType,
            () =>
              new Promise<void>((resolveUpdate, rejectUpdate) => {
                if (pendingRef.current !== pending || signal.aborted) {
                  rejectUpdate(
                    signal.aborted ? navigationAbortReason(signal) : supersededNavigation(),
                  );
                  return;
                }
                pending.resolveUpdate = resolveUpdate;
                pending.rejectUpdate = rejectUpdate;
                startTransition(() => setPosition(change.to));
              }),
          );
          pending.transition = transition;
          void transition.ready.catch((error: unknown) => {
            if (isAbortError(error)) {
              return;
            }
            onError(
              new DreverClientError(
                "DREVER_CLIENT_VIEW_TRANSITION_INVALID",
                "The document View Transition could not capture the authored motion identities.",
                { cause: error },
              ),
            );
          });
          void transition.finished.catch(() => undefined);
          void transition.updateCallbackDone.catch((error: unknown) => {
            if (pendingRef.current !== pending) {
              return;
            }
            pendingRef.current = undefined;
            pending.removeAbortListener();
            reject(error);
            onError(error);
          });
        } catch (error) {
          pendingRef.current = undefined;
          pending.removeAbortListener();
          reject(error);
          onError(error);
        }
      });
    },
    [onError, reducedMotion, store],
  );

  useLayoutEffect(() => {
    const unregister = registerCommit(commit);
    return () => {
      unregister();
      const pending = pendingRef.current;
      pendingRef.current = undefined;
      if (pending === undefined) {
        return;
      }
      pending.removeAbortListener();
      pending.transition?.skipTransition();
      const unmounted = new DreverClientError(
        "DREVER_CLIENT_VIEWER_UNMOUNTED",
        "The React viewer unmounted before navigation committed.",
      );
      pending.rejectUpdate?.(unmounted);
      pending.reject(unmounted);
    };
  }, [commit, registerCommit]);

  useLayoutEffect(() => scheduleStableMountNotification(onMounted), [onMounted]);

  const completeCommit = useCallback(
    (committed: DeckPosition): void => {
      const pending = pendingRef.current;
      if (pending === undefined || !samePosition(pending.change.to, committed)) {
        return;
      }

      pendingRef.current = undefined;
      pending.removeAbortListener();
      if (pending.signal.aborted) {
        const reason = navigationAbortReason(pending.signal);
        pending.transition?.skipTransition();
        const deck = deckRef.current;
        if (deck !== null) {
          setLocalSlideTransitionMode(deck, undefined);
        }
        pending.rejectUpdate?.(reason);
        pending.reject(reason);
        setPosition(store.getSnapshot());
        return;
      }

      store.commit(pending.change.to);
      pending.resolveUpdate?.();
      pending.resolve();
    },
    [store],
  );

  return (
    <>
      <ViewerSurface
        {...viewerProps}
        canvasRef={canvasRef}
        deckRef={deckRef}
        manifest={machine.manifest}
        onRenderError={onError}
        onPositionCommitted={completeCommit}
        position={position}
      />
      <AudienceControls
        canvas={viewerProps.canvas ?? DEFAULT_CANVAS}
        canvasRef={canvasRef}
        deckRef={deckRef}
        {...(focusTools === undefined ? {} : { focusTools })}
        hiddenForNavigation={controlsHiddenForNavigation}
        manifest={machine.manifest}
        onCopyShareURL={onCopyShareURL}
        onError={onError}
        onNavigate={onNavigate}
        onOpenDocument={onOpenDocument}
        onOpenSpeaker={onOpenSpeaker}
        onPointerIntent={revealControlsForPointerIntent}
        position={position}
        remoteFocus={remoteFocus}
        renderSlidePreview={(slide) => (
          <ViewerSurface
            {...viewerProps}
            idPrefix={`drever-overview-slide-${slide.index + 1}`}
            manageFocus={false}
            manifest={machine.manifest}
            onRenderError={onError}
            position={resolveSlidePreviewPosition(slide)}
            reducedMotion={true}
            renderMode="export"
          />
        )}
      />
    </>
  );
};

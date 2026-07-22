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
import type { CanvasDefinition, DeckManifest } from "@drever/schema";
import {
  startTransition,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
  type ReactElement,
} from "react";
import { AudienceControls } from "./audience-controls.tsx";
import { CanvasViewport, DEFAULT_CANVAS } from "./canvas.tsx";
import { DreverClientError, isAbortError } from "./client-error.ts";
import type { PresentationCommit } from "./navigation.ts";
import type { PresentationFocusAppearance } from "./presentation-focus.ts";
import type { PresentationFocusStore } from "./presentation-focus-store.ts";
import type {
  DeckCommand,
  DeckPosition,
  PresentationChange,
  PresentationStateMachine,
  PresentationStore,
} from "./presentation-state.ts";
import { PresentationStage, type StageComponents } from "./stage.tsx";
import { startScopedViewTransition, type ScopedViewTransition } from "./view-transition.ts";
import { scheduleStableMountNotification } from "./viewer-lifecycle.ts";

export type ViewerProps = Readonly<{
  Content: MDXContent;
  canvas?: CanvasDefinition;
  manifest: DeckManifest;
  manageFocus?: boolean;
  onPositionCommitted?: (position: DeckPosition) => void;
  position: DeckPosition;
  reducedMotion?: boolean;
  registry?: MDXComponents;
  renderMode?: DreverRenderMode;
  stage?: StageComponents;
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
    canvasRef?: RefObject<HTMLDivElement | null>;
    deckRef?: RefObject<HTMLDivElement | null>;
  }>;

const ViewerSurface = ({
  Content,
  canvas,
  canvasRef,
  deckRef: providedDeckRef,
  manageFocus = true,
  onPositionCommitted,
  manifest,
  position,
  reducedMotion = false,
  registry,
  renderMode = "audience",
  stage,
}: ViewerSurfaceProps): ReactElement => {
  const localDeckRef = useRef<HTMLDivElement>(null);
  const deckRef = providedDeckRef ?? localDeckRef;
  const previousSlideRef = useRef(position.slideIndex);
  const resolver = useCallback(
    (slide: SlideIdentity): ResolvedSlideState => resolveSlideState(position, slide),
    [position],
  );
  const resolvedCanvas = canvas ?? DEFAULT_CANVAS;

  useLayoutEffect(() => {
    if (!manageFocus) {
      return;
    }
    const deck = deckRef.current;
    if (deck === null) {
      return;
    }
    const activeElement = deck.ownerDocument.activeElement;
    const slideChanged = previousSlideRef.current !== position.slideIndex;
    const presentationOwnedFocus =
      activeElement === null ||
      activeElement === deck.ownerDocument.body ||
      deck.contains(activeElement);
    const focusBecameHidden =
      activeElement !== null &&
      deck.contains(activeElement) &&
      activeElement.closest("[inert], [aria-hidden='true']") !== null;
    if ((slideChanged && presentationOwnedFocus) || focusBecameHidden) {
      const activeSlide = deck.querySelector<HTMLElement>(
        `[data-drever-slide][data-slide-index="${position.slideIndex}"]`,
      );
      activeSlide?.focus({ preventScroll: true });
    }
    previousSlideRef.current = position.slideIndex;
  }, [manageFocus, position.slideIndex, position.step]);

  useLayoutEffect(() => {
    onPositionCommitted?.(position);
  }, [onPositionCommitted, position]);

  return (
    <CanvasViewport canvas={resolvedCanvas} {...(canvasRef === undefined ? {} : { canvasRef })}>
      <DreverRenderModeProvider mode={renderMode}>
        <PresentationStage
          canvas={resolvedCanvas}
          manifest={manifest}
          position={position}
          reducedMotion={reducedMotion}
          renderMode={renderMode}
          {...(stage === undefined ? {} : { stage })}
        >
          <div
            className="drever-deck"
            data-drever-deck=""
            data-drever-reduced-motion={reducedMotion ? "" : undefined}
            data-drever-render-mode={renderMode}
            ref={deckRef}
          >
            <SlideStateProvider resolver={resolver}>
              <MDXRenderer Content={Content} {...(registry === undefined ? {} : { registry })} />
            </SlideStateProvider>
          </div>
        </PresentationStage>
      </DreverRenderModeProvider>
    </CanvasViewport>
  );
};

export type ViewerCommitRegistrar = (commit: PresentationCommit) => () => void;

export type ViewerHostProps = Omit<ViewerProps, "manifest" | "onPositionCommitted" | "position"> &
  Readonly<{
    focusTools?: PresentationFocusAppearance;
    machine: PresentationStateMachine;
    onCopyShareURL(position: DeckPosition): Promise<void>;
    onError(error: unknown): void;
    onMounted(): void;
    onNavigate(command: DeckCommand): void | Promise<void>;
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
  transition?: ScopedViewTransition;
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
  const reducedMotion = viewerProps.reducedMotion ?? false;
  const canvasRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<PendingCommit | undefined>(undefined);

  useLayoutEffect(() => {
    return store.subscribe(() => {
      const next = store.getSnapshot();
      setPosition((current) => (samePosition(current, next) ? current : next));
    });
  }, [store]);

  const commit = useCallback<PresentationCommit>(
    (change, signal) => {
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
        if (reducedMotion || !changesSlide) {
          setPosition(change.to);
          return;
        }

        const deck = deckRef.current;
        if (deck === null) {
          pendingRef.current = undefined;
          pending.removeAbortListener();
          reject(
            new DreverClientError(
              "DREVER_CLIENT_VIEWER_NOT_READY",
              "The presentation deck is not ready to start a scoped View Transition.",
            ),
          );
          return;
        }

        try {
          const transition = startScopedViewTransition(
            deck,
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
                "The deck View Transition could not capture the authored motion identities.",
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
        onPositionCommitted={completeCommit}
        position={position}
      />
      <AudienceControls
        canvas={viewerProps.canvas ?? DEFAULT_CANVAS}
        canvasRef={canvasRef}
        deckRef={deckRef}
        {...(focusTools === undefined ? {} : { focusTools })}
        manifest={machine.manifest}
        onCopyShareURL={onCopyShareURL}
        onError={onError}
        onNavigate={onNavigate}
        onOpenDocument={onOpenDocument}
        onOpenSpeaker={onOpenSpeaker}
        position={position}
        remoteFocus={remoteFocus}
      />
    </>
  );
};

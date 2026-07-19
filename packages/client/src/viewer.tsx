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
  addTransitionType,
  startTransition,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
  type ReactElement,
} from "react";
import { AudienceControls } from "./audience-controls.tsx";
import { CanvasViewport } from "./canvas.tsx";
import { DreverClientError } from "./client-error.ts";
import type { PresentationCommit } from "./navigation.ts";
import type {
  DeckCommand,
  DeckPosition,
  PresentationChange,
  PresentationStateMachine,
  PresentationStore,
} from "./presentation-state.ts";
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
    deckRef?: RefObject<HTMLDivElement | null>;
  }>;

const ViewerSurface = ({
  Content,
  canvas,
  deckRef: providedDeckRef,
  manageFocus = true,
  onPositionCommitted,
  position,
  reducedMotion = false,
  registry,
  renderMode = "audience",
}: ViewerSurfaceProps): ReactElement => {
  const localDeckRef = useRef<HTMLDivElement>(null);
  const deckRef = providedDeckRef ?? localDeckRef;
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
    <CanvasViewport {...(canvas === undefined ? {} : { canvas })}>
      <div
        className="drever-deck"
        data-drever-deck=""
        data-drever-reduced-motion={reducedMotion ? "" : undefined}
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

export type ViewerCommitRegistrar = (commit: PresentationCommit) => () => void;

export type ViewerHostProps = Omit<ViewerProps, "onPositionCommitted" | "position"> &
  Readonly<{
    machine: PresentationStateMachine;
    onCopyShareURL(position: DeckPosition): Promise<void>;
    onError(error: unknown): void;
    onMounted(): void;
    onNavigate(command: DeckCommand): void | Promise<void>;
    onOpenDocument(): void;
    onOpenSpeaker(): void;
    registerCommit: ViewerCommitRegistrar;
    store: PresentationStore;
  }>;

type PendingCommit = {
  change: PresentationChange;
  reject(error: unknown): void;
  removeAbortListener(): void;
  resolve(): void;
  signal: AbortSignal;
};

const navigationAbortReason = (signal: AbortSignal): unknown =>
  signal.reason ?? new DOMException("The presentation navigation was aborted.", "AbortError");

const supersededNavigation = (): DOMException =>
  new DOMException("A newer presentation navigation superseded the pending commit.", "AbortError");

/** @internal Owns the React state commit that unblocks Navigation interception. */
export const ViewerHost = ({
  machine,
  onCopyShareURL,
  onError,
  onMounted,
  onNavigate,
  onOpenDocument,
  onOpenSpeaker,
  registerCommit,
  store,
  ...viewerProps
}: ViewerHostProps): ReactElement => {
  const [position, setPosition] = useState(store.getSnapshot);
  const reducedMotion = viewerProps.reducedMotion ?? false;
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
          previous.reject(supersededNavigation());
        }

        let pending: PendingCommit;
        const onAbort = (): void => {
          if (pendingRef.current !== pending) {
            return;
          }
          pendingRef.current = undefined;
          pending.removeAbortListener();
          reject(navigationAbortReason(signal));
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
        startTransition(() => {
          addTransitionType(change.transitionType);
          setPosition(change.to);
        });
      });
    },
    [reducedMotion, store],
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
      pending.reject(
        new DreverClientError(
          "DREVER_CLIENT_VIEWER_UNMOUNTED",
          "The React viewer unmounted before navigation committed.",
        ),
      );
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
        pending.reject(navigationAbortReason(pending.signal));
        setPosition(store.getSnapshot());
        return;
      }

      store.commit(pending.change.to);
      pending.resolve();
    },
    [store],
  );

  return (
    <>
      <ViewerSurface
        {...viewerProps}
        deckRef={deckRef}
        onPositionCommitted={completeCommit}
        position={position}
      />
      <AudienceControls
        deckRef={deckRef}
        manifest={machine.manifest}
        onCopyShareURL={onCopyShareURL}
        onError={onError}
        onNavigate={onNavigate}
        onOpenDocument={onOpenDocument}
        onOpenSpeaker={onOpenSpeaker}
        position={position}
      />
    </>
  );
};

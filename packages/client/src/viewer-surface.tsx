/// <reference types="react/canary" />

import {
  DreverRenderModeProvider,
  MDXRenderer,
  SlideRenderBoundaryProvider,
  SlideStateProvider,
  type DreverRenderMode,
  type MDXComponents,
  type MDXContent,
  type ResolvedSlideState,
  type SlideIdentity,
  type SlideRenderBoundaryProps,
} from "@drever/core";
import {
  type CanvasDefinition,
  type DeckManifest,
  type PlannedTheme,
  type SlideManifest,
} from "@drever/schema";
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  type ErrorInfo,
  type ReactElement,
  type RefObject,
} from "react";
import { CanvasViewport, DEFAULT_CANVAS } from "./canvas.tsx";
import { DreverClientError } from "./client-error.ts";
import type { DeckPosition } from "./presentation-state.ts";
import { RenderErrorBoundary } from "./render-error-boundary.tsx";
import { PresentationStage, type StageComponents } from "./stage.tsx";

const showRenderErrorDetails =
  (import.meta as ImportMeta & Readonly<{ hot?: unknown }>).hot !== undefined;

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
  theme?: PlannedTheme;
}>;

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

export type ViewerSurfaceProps = ViewerProps &
  Readonly<{
    canvasRef?: RefObject<HTMLDivElement | null>;
    deckRef?: RefObject<HTMLDivElement | null>;
    idPrefix?: string;
    onRenderError?: (error: unknown) => void;
  }>;

type RenderFailureScope = "deck" | "slide";

const errorDetail = (error: unknown): string => {
  if (!(error instanceof Error)) return String(error);
  return error.stack ?? `${error.name}: ${error.message}`;
};

const renderFailureError = (
  error: Error,
  info: ErrorInfo,
  scope: RenderFailureScope,
  slide: SlideManifest | undefined,
): DreverClientError =>
  new DreverClientError(
    scope === "slide" ? "DREVER_CLIENT_SLIDE_RENDER_FAILED" : "DREVER_CLIENT_DECK_RENDER_FAILED",
    scope === "slide"
      ? `Slide ${(slide?.index ?? 0) + 1} could not render.`
      : "The authored deck could not render the current slide.",
    {
      cause: error,
      details: {
        scope,
        ...(slide === undefined
          ? {}
          : {
              slideId: slide.id,
              slideIndex: slide.index,
              ...(slide.title === undefined ? {} : { slideTitle: slide.title }),
            }),
        ...(typeof info.componentStack === "string" ? { componentStack: info.componentStack } : {}),
      },
    },
  );

export const ViewerRenderFailure = ({
  error,
  showDetails,
  slide,
}: Readonly<{
  error: unknown;
  showDetails: boolean;
  slide?: SlideManifest;
}>): ReactElement => (
  <div className="drever-render-failure" data-drever-render-failure="" role="alert">
    <span>Render paused</span>
    <strong>
      {showDetails
        ? `Draft slide ${(slide?.index ?? 0) + 1} could not render`
        : "This slide could not render"}
    </strong>
    {slide?.title === undefined ? null : <p>{slide.title}</p>}
    <p>
      {showDetails
        ? "The viewer is still running, and the agent can continue repairing this draft."
        : "The presentation can continue after this slide is repaired."}
    </p>
    {showDetails ? <pre>{errorDetail(error)}</pre> : null}
  </div>
);

const slideFor = (
  manifest: DeckManifest,
  identity: Readonly<{ id?: string; index?: number }>,
): SlideManifest | undefined =>
  identity.index === undefined
    ? manifest.slides.find(({ id }) => id === identity.id)
    : manifest.slides[identity.index];

const createSlideRenderBoundary = (
  Content: MDXContent,
  manifest: DeckManifest,
  onRenderError: ((error: unknown) => void) | undefined,
): ((props: SlideRenderBoundaryProps) => ReactElement) => {
  const SlideRenderBoundary = ({ children, id, index }: SlideRenderBoundaryProps): ReactElement => {
    const slide = slideFor(manifest, {
      ...(id === undefined ? {} : { id }),
      ...(index === undefined ? {} : { index }),
    });
    return (
      <RenderErrorBoundary
        fallback={(error) => (
          <ViewerRenderFailure
            error={error}
            showDetails={showRenderErrorDetails}
            {...(slide === undefined ? {} : { slide })}
          />
        )}
        onError={(error, info) => onRenderError?.(renderFailureError(error, info, "slide", slide))}
        resetKeys={[Content]}
      >
        {children}
      </RenderErrorBoundary>
    );
  };
  return SlideRenderBoundary;
};

/** @internal Shared presentation surface without audience controls. */
export const ViewerSurface = ({
  Content,
  canvas,
  canvasRef,
  deckRef: providedDeckRef,
  idPrefix,
  manageFocus = true,
  onRenderError,
  onPositionCommitted,
  manifest,
  position,
  reducedMotion = false,
  registry,
  renderMode = "audience",
  stage,
  theme,
}: ViewerSurfaceProps): ReactElement => {
  const localDeckRef = useRef<HTMLDivElement>(null);
  const deckRef = providedDeckRef ?? localDeckRef;
  const previousSlideRef = useRef(position.slideIndex);
  const resolver = useCallback(
    (slide: SlideIdentity): ResolvedSlideState => resolveSlideState(position, slide),
    [position],
  );
  const resolvedCanvas = canvas ?? DEFAULT_CANVAS;
  const slideRenderBoundary = useMemo(
    () => createSlideRenderBoundary(Content, manifest, onRenderError),
    [Content, manifest, onRenderError],
  );
  const currentSlide = manifest.slides[position.slideIndex];

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
    <CanvasViewport
      canvas={resolvedCanvas}
      {...(canvasRef === undefined ? {} : { canvasRef })}
      {...(theme === undefined ? {} : { theme })}
    >
      <DreverRenderModeProvider mode={renderMode} {...(idPrefix === undefined ? {} : { idPrefix })}>
        <RenderErrorBoundary
          fallback={(error) => (
            <ViewerRenderFailure
              error={error}
              showDetails={showRenderErrorDetails}
              {...(currentSlide === undefined ? {} : { slide: currentSlide })}
            />
          )}
          onError={(error, info) =>
            onRenderError?.(renderFailureError(error, info, "deck", currentSlide))
          }
          resetKeys={[Content, position.slideId, position.slideIndex, position.step]}
        >
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
              <RenderErrorBoundary
                fallback={(error) => (
                  <ViewerRenderFailure
                    error={error}
                    showDetails={showRenderErrorDetails}
                    {...(currentSlide === undefined ? {} : { slide: currentSlide })}
                  />
                )}
                onError={(error, info) =>
                  onRenderError?.(renderFailureError(error, info, "deck", currentSlide))
                }
                resetKeys={[Content, position.slideId, position.slideIndex, position.step]}
              >
                <SlideRenderBoundaryProvider boundary={slideRenderBoundary}>
                  <SlideStateProvider resolver={resolver}>
                    <MDXRenderer
                      Content={Content}
                      {...(registry === undefined ? {} : { registry })}
                    />
                  </SlideStateProvider>
                </SlideRenderBoundaryProvider>
              </RenderErrorBoundary>
            </div>
          </PresentationStage>
        </RenderErrorBoundary>
      </DreverRenderModeProvider>
    </CanvasViewport>
  );
};

/// <reference types="react/canary" />

import {
  DreverRenderModeProvider,
  MDXRenderer,
  SlideStateProvider,
  type DreverRenderMode,
  type MDXComponents,
  type MDXContent,
  type ResolvedSlideState,
  type SlideIdentity,
} from "@drever/core";
import type { CanvasDefinition, DeckManifest } from "@drever/schema";
import { useCallback, useLayoutEffect, useRef, type ReactElement, type RefObject } from "react";
import { CanvasViewport, DEFAULT_CANVAS } from "./canvas.tsx";
import type { DeckPosition } from "./presentation-state.ts";
import { PresentationStage, type StageComponents } from "./stage.tsx";

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
  }>;

/** @internal Shared presentation surface without audience controls. */
export const ViewerSurface = ({
  Content,
  canvas,
  canvasRef,
  deckRef: providedDeckRef,
  idPrefix,
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
      <DreverRenderModeProvider mode={renderMode} {...(idPrefix === undefined ? {} : { idPrefix })}>
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

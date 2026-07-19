import type { DreverRenderMode } from "@drever/core";
import type { CanvasDefinition, DeckManifest } from "@drever/schema";
import {
  createContext,
  useContext,
  useMemo,
  type ComponentType,
  type PropsWithChildren,
  type ReactElement,
} from "react";
import { DreverClientError } from "./client-error.ts";
import type { DeckPosition } from "./presentation-state.ts";

export type StageLayerProps = Readonly<{
  canvas: CanvasDefinition;
  manifest: DeckManifest;
  position: DeckPosition;
  reducedMotion: boolean;
  renderMode: DreverRenderMode;
}>;

export type StageLayerComponent = ComponentType<StageLayerProps>;

export type StageComponents = Readonly<{
  background?: StageLayerComponent;
  foreground?: StageLayerComponent;
}>;

const StageContext = createContext<StageLayerProps | undefined>(undefined);

/** Reads the current presentation state from a global stage component. */
export const useStage = (): StageLayerProps => {
  const stage = useContext(StageContext);
  if (stage === undefined) {
    throw new DreverClientError(
      "DREVER_CLIENT_STAGE_CONTEXT_MISSING",
      "useStage must be called inside a Drever presentation stage.",
    );
  }
  return stage;
};

export type PresentationStageProps = PropsWithChildren<
  StageLayerProps &
    Readonly<{
      stage?: StageComponents;
    }>
>;

/** Keeps global canvas decoration outside the per-slide transition boundary. */
export const PresentationStage = ({
  canvas,
  children,
  manifest,
  position,
  reducedMotion,
  renderMode,
  stage,
}: PresentationStageProps): ReactElement => {
  const value = useMemo<StageLayerProps>(
    () => Object.freeze({ canvas, manifest, position, reducedMotion, renderMode }),
    [canvas, manifest, position, reducedMotion, renderMode],
  );
  const Background = stage?.background;
  const Foreground = stage?.foreground;

  return (
    <StageContext.Provider value={value}>
      <div
        className="drever-stage"
        data-current-step={position.step}
        data-drever-reduced-motion={reducedMotion ? "" : undefined}
        data-drever-render-mode={renderMode}
        data-drever-stage=""
        data-page-number={position.slideIndex + 1}
        data-slide-count={manifest.slides.length}
        data-slide-id={position.slideId}
        data-slide-index={position.slideIndex}
      >
        <div
          aria-hidden="true"
          className="drever-stage__background"
          data-drever-stage-layer="background"
          inert
        >
          {Background === undefined ? null : <Background {...value} />}
        </div>
        <div className="drever-stage__content" data-drever-stage-layer="content">
          {children}
        </div>
        <div className="drever-stage__foreground" data-drever-stage-layer="foreground">
          {Foreground === undefined ? null : <Foreground {...value} />}
        </div>
      </div>
    </StageContext.Provider>
  );
};

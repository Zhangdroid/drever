import type { StageLayerProps } from "drever";
import type { ReactElement } from "react";
import { SplineCommunityScene } from "./SplineCommunityScene.tsx";
import { SplineScene, type SplineSceneMode, type SplineSceneVariant } from "./SplineScene.tsx";

const CLONER_SCENE = "https://prod.spline.design/fJ2ptJKzT-sDkpfO/scene.splinecode";
const FOLLOW_SCENE = "https://prod.spline.design/PBQQBw8bfXDhBo7w/scene.splinecode";
const PARTICLE_NEBULA_SCENE =
  "https://app.spline.design/file/d868b3ee-e678-4278-851d-57cbd8f10e7c?view=preview";

type StageState = Readonly<{
  description: string;
  label: string;
  mode: SplineSceneMode;
  scene: string;
  variant: SplineSceneVariant;
}>;

const stageStates: Readonly<Record<number, StageState>> = {
  0: {
    description: "An official Spline cloner study used as a spatial atmosphere",
    label: "A field of softly lit repeated 3D forms",
    mode: "opening",
    scene: CLONER_SCENE,
    variant: "cloner",
  },
  1: {
    description: "The same cloner study turned to make its repeated structure legible",
    label: "A field of softly lit repeated 3D forms",
    mode: "evidence",
    scene: CLONER_SCENE,
    variant: "cloner",
  },
  2: {
    description: "The same cloner study receding behind the explanation",
    label: "A quiet field of softly lit repeated 3D forms",
    mode: "context",
    scene: CLONER_SCENE,
    variant: "cloner",
  },
  3: {
    description: "An official Spline Follow study used as one gently moving focal object",
    label: "A softly lit abstract 3D object in slow motion",
    mode: "object",
    scene: FOLLOW_SCENE,
    variant: "object",
  },
};

const hiddenState: StageState = {
  description: "The spatial scene has yielded to the closing statement",
  label: "No active spatial scene",
  mode: "hidden",
  scene: CLONER_SCENE,
  variant: "cloner",
};

export default function SpatialStoriesBackground({
  position,
  reducedMotion,
}: StageLayerProps): ReactElement {
  if (position.slideIndex === 4) {
    return (
      <div className="spatial-stage" data-mode="ambient" data-variant="ambient">
        <SplineCommunityScene
          className="spatial-stage__scene"
          description="The CC0 Particle Nebula study from Spline Community used as a quiet ambient environment"
          reducedMotion={reducedMotion}
          src={PARTICLE_NEBULA_SCENE}
        />
      </div>
    );
  }

  const state = stageStates[position.slideIndex] ?? hiddenState;

  return (
    <div className="spatial-stage" data-mode={state.mode} data-variant={state.variant}>
      <SplineScene
        className="spatial-stage__scene"
        description={state.description}
        label={state.label}
        mode={state.mode}
        reducedMotion={reducedMotion}
        scene={state.scene}
        variant={state.variant}
      />
    </div>
  );
}

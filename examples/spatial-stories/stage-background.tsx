import type { StageLayerProps } from "drever";
import type { ReactElement } from "react";
import { SplineScene } from "./SplineScene.tsx";

const CLONER_SCENE = "https://prod.spline.design/fJ2ptJKzT-sDkpfO/scene.splinecode";
const stageModes = ["opening", "evidence", "context", "interaction"] as const;

export default function SpatialStoriesBackground({
  position,
  reducedMotion,
}: StageLayerProps): ReactElement {
  const mode = stageModes[position.slideIndex] ?? "hidden";

  return (
    <div className="spatial-stage" data-mode={mode}>
      <SplineScene
        className="spatial-stage__scene"
        description="An official Spline cloner study that turns through four narrative roles"
        label="A field of softly lit repeated 3D forms"
        mode={mode}
        reducedMotion={reducedMotion}
        scene={CLONER_SCENE}
      />
    </div>
  );
}

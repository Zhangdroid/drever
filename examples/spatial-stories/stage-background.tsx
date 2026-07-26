import type { StageLayerProps } from "drever";
import type { ReactElement } from "react";
import { SplineScene } from "./SplineScene.tsx";

const CLONER_SCENE = "https://prod.spline.design/fJ2ptJKzT-sDkpfO/scene.splinecode";
const stageModes = ["opening", "evidence", "context"] as const;

export default function SpatialStoriesBackground({
  position,
  reducedMotion,
}: StageLayerProps): ReactElement {
  const mode = stageModes[position.slideIndex] ?? "hidden";
  const visible = mode !== "hidden";

  return (
    <div className="spatial-stage" data-mode={mode}>
      <SplineScene
        active={visible}
        background="#0c0d12"
        className="spatial-stage__scene"
        description="An official Spline cloner study used as a persistent spatial stage"
        eventsTarget="global"
        label="A field of softly lit repeated 3D forms"
        poster="cloner"
        reducedMotion={reducedMotion}
        scene={CLONER_SCENE}
      />
    </div>
  );
}

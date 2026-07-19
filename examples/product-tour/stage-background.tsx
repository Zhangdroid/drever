import type { StageLayerProps } from "drever";
import type { ReactElement } from "react";

const sceneFor = (slideIndex: number): "opening" | "system" | "motion" => {
  if (slideIndex < 5) return "opening";
  if (slideIndex < 11) return "system";
  return "motion";
};

export default function ProductTourBackground({ position }: StageLayerProps): ReactElement {
  return (
    <div
      className="tour-stage-background"
      data-scene={sceneFor(position.slideIndex)}
      data-testid="tour-stage-background"
    >
      <span />
    </div>
  );
}

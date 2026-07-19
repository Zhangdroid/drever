import type { StageLayerProps } from "drever";
import type { ReactElement } from "react";

const sceneFor = (slideIndex: number): "opening" | "system" | "motion" | "closing" => {
  if (slideIndex < 3) return "opening";
  if (slideIndex < 10) return "system";
  if (slideIndex < 13) return "motion";
  return "closing";
};

export default function ProductTourBackground({ position }: StageLayerProps): ReactElement {
  return (
    <div
      className="tour-stage-background"
      data-scene={sceneFor(position.slideIndex)}
      data-slide-number={position.slideIndex + 1}
      data-testid="tour-stage-background"
    >
      <span />
    </div>
  );
}

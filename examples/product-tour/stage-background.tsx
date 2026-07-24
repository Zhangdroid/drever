import { useAudienceSignal } from "./audience-signal.js";
import type { StageLayerProps } from "drever";
import type { ReactElement } from "react";

const scene = (slideIndex: number): string => {
  if (slideIndex === 0) return "opening";
  if (slideIndex < 3) return "shape";
  if (slideIndex === 3) return "room";
  if (slideIndex < 9) return "evidence";
  if (slideIndex < 11) return "continuity";
  return "closing";
};

export default function ProductTourBackground({ position }: StageLayerProps): ReactElement {
  const signal = useAudienceSignal();

  return (
    <div
      className="tour-stage-background"
      data-scene={scene(position.slideIndex)}
      data-signal={signal ?? "idle"}
      data-testid="tour-stage-background"
    >
      <span className="tour-stage-background__wash" />
      <span className="tour-stage-background__orbit tour-stage-background__orbit--one" />
      <span className="tour-stage-background__orbit tour-stage-background__orbit--two" />
      <span className="tour-stage-background__pulse" />
    </div>
  );
}

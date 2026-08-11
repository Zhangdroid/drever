import { useAudienceSignal } from "./audience-signal.js";
import type { StageLayerProps } from "drever";
import type { ReactElement } from "react";

const scene = (slideIndex: number, slideCount: number): string => {
  if (slideIndex === 0) return "opening";
  if (slideIndex === slideCount - 1) return "closing";
  if (slideIndex < 5) return "shape";
  if (slideIndex < 7) return "room";
  return "continuity";
};

export default function ProductTourBackground({
  manifest,
  position,
}: StageLayerProps): ReactElement {
  const signal = useAudienceSignal();

  return (
    <div
      className="tour-stage-background"
      data-scene={scene(position.slideIndex, manifest.slides.length)}
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

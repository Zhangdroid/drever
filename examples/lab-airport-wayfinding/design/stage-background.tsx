import type { StageLayerProps } from "drever";

export default function WayfindingStage({ position }: StageLayerProps) {
  const zone =
    position.slideIndex === 0
      ? "opening"
      : position.slideIndex >= 14
        ? "close"
        : position.slideIndex >= 12
          ? "action"
          : "core";

  return (
    <div className={`wayfinding-stage wayfinding-stage--${zone}`}>
      <div className="wayfinding-stage__grid" />
      <div className="wayfinding-stage__route" />
      <div className="wayfinding-stage__index">
        {String(position.slideIndex + 1).padStart(2, "0")} / 15
      </div>
    </div>
  );
}

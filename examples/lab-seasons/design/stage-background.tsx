import type { StageLayerProps } from "drever";

export default function SeasonsStage({ position }: StageLayerProps) {
  const chapter =
    position.slideIndex >= 13 ? "resolve" : position.slideIndex >= 5 ? "mechanism" : "test";

  return (
    <div className="season-stage" data-chapter={chapter}>
      <div className="season-stage__atmosphere" />
      <div className="season-stage__starfield" />
      <div className="season-stage__arc" />
    </div>
  );
}

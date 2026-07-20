import type { StageLayerProps } from "drever";
import type { ReactElement } from "react";

const page = (value: number): string => String(value).padStart(2, "0");

const chapter = (slideIndex: number): string => {
  if (slideIndex < 3) return "01 · The room";
  if (slideIndex < 7) return "02 · The story";
  if (slideIndex < 10) return "03 · After the room";
  if (slideIndex < 13) return "04 · One story";
  return "05 · Begin";
};

export default function ProductTourForeground({
  manifest,
  position,
}: StageLayerProps): ReactElement {
  return (
    <div aria-hidden="true" className="tour-stage-foreground">
      <span>Drever · {chapter(position.slideIndex)}</span>
      <span data-testid="tour-stage-page-number">
        {page(position.slideIndex + 1)} / {page(manifest.slides.length)}
      </span>
    </div>
  );
}

import type { StageLayerProps } from "drever";
import type { ReactElement } from "react";

const page = (value: number): string => String(value).padStart(2, "0");

export default function ProductTourForeground({
  manifest,
  position,
}: StageLayerProps): ReactElement {
  return (
    <div aria-hidden="true" className="tour-stage-foreground">
      <span>Drever · Product tour</span>
      <span data-testid="tour-stage-page-number">
        {page(position.slideIndex + 1)} / {page(manifest.slides.length)}
      </span>
    </div>
  );
}

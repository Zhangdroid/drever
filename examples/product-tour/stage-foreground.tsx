import type { StageLayerProps } from "drever";
import type { ReactElement } from "react";

const page = (value: number): string => String(value).padStart(2, "0");

const chapter = (slideIndex: number): string => {
  if (slideIndex < 5) return "01 · Create";
  if (slideIndex < 7) return "02 · Direct";
  if (slideIndex < 8) return "03 · Carry";
  return "04 · Begin";
};

const signalPosition = (slideIndex: number, slideCount: number): string => {
  if (slideIndex === 0 || slideIndex === slideCount - 1) return "hidden";
  return "frame";
};

export default function ProductTourForeground({
  manifest,
  position,
}: StageLayerProps): ReactElement {
  return (
    <div
      aria-hidden="true"
      className="tour-stage-foreground"
      data-signal-position={signalPosition(position.slideIndex, manifest.slides.length)}
    >
      <span className="tour-stage-foreground__signal" data-testid="tour-stage-signal">
        <i />
      </span>
      <div className="tour-stage-foreground__footer">
        <span>Drever · {chapter(position.slideIndex)}</span>
        <span data-testid="tour-stage-page-number">
          {page(position.slideIndex + 1)} / {page(manifest.slides.length)}
        </span>
      </div>
    </div>
  );
}

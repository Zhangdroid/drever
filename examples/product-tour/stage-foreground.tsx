import type { StageLayerProps } from "drever";
import type { ReactElement } from "react";

const page = (value: number): string => String(value).padStart(2, "0");

const chapter = (slideIndex: number): string => {
  if (slideIndex < 2) return "01 · Start";
  if (slideIndex < 5) return "02 · Direct";
  if (slideIndex < 8) return "03 · Present & share";
  if (slideIndex < 10) return "04 · One story";
  return "05 · Begin";
};

export default function ProductTourForeground({
  manifest,
  position,
}: StageLayerProps): ReactElement {
  const edgeSignal =
    position.slideIndex === 0 || position.slideIndex === manifest.slides.length - 1;
  const storyState =
    position.slideIndex === 8 ? "source" : position.slideIndex === 9 ? "result" : undefined;

  return (
    <div
      aria-hidden="true"
      className="tour-stage-foreground"
      data-signal-position={edgeSignal ? "edge" : "frame"}
    >
      <span className="tour-stage-foreground__signal" data-testid="tour-stage-signal" />
      {storyState === undefined ? null : (
        <div
          className="tour-stage-foreground__story"
          data-story-state={storyState}
          data-testid="tour-stage-story"
        >
          <span>One story,</span>
          <span className="tour-stage-foreground__story-slot">
            <strong data-story-copy="source">made once.</strong>
            <strong data-story-copy="result">alive everywhere.</strong>
          </span>
        </div>
      )}
      <div className="tour-stage-foreground__footer">
        <span>Drever · {chapter(position.slideIndex)}</span>
        <span data-testid="tour-stage-page-number">
          {page(position.slideIndex + 1)} / {page(manifest.slides.length)}
        </span>
      </div>
    </div>
  );
}

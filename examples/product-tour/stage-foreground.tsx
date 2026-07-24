import type { StageLayerProps } from "drever";
import type { ReactElement } from "react";

const page = (value: number): string => String(value).padStart(2, "0");

const chapter = (slideIndex: number): string => {
  if (slideIndex < 3) return "01 · Shape";
  if (slideIndex < 6) return "02 · Direct";
  if (slideIndex < 9) return "03 · Carry";
  if (slideIndex < 11) return "04 · One story";
  return "05 · Begin";
};

const signalPosition = (slideIndex: number, slideCount: number): string => {
  if (slideIndex === 0 || slideIndex === slideCount - 1) return "edge";
  if (slideIndex === 3 || slideIndex === 4) return "room";
  return "frame";
};

export default function ProductTourForeground({
  manifest,
  position,
}: StageLayerProps): ReactElement {
  const storyState =
    position.slideIndex === 9 ? "source" : position.slideIndex === 10 ? "result" : undefined;

  return (
    <div
      aria-hidden="true"
      className="tour-stage-foreground"
      data-signal-position={signalPosition(position.slideIndex, manifest.slides.length)}
    >
      <span className="tour-stage-foreground__signal" data-testid="tour-stage-signal">
        <i />
      </span>
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

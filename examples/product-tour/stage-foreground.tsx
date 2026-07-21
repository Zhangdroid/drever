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
  const edgeSignal =
    position.slideIndex === 0 || position.slideIndex === manifest.slides.length - 1;
  const storyState =
    position.slideIndex === 11 ? "source" : position.slideIndex === 12 ? "result" : undefined;

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

import type { StageLayerProps } from "drever";
import type { ReactElement } from "react";

const pad = (value: number): string => String(value).padStart(2, "0");

export default function CoreFixtureForeground({
  manifest,
  position,
  renderMode,
}: StageLayerProps): ReactElement {
  return (
    <div
      aria-hidden="true"
      className="fixture-stage-foreground"
      data-render-mode={renderMode}
      data-testid="e2e-stage-foreground"
    >
      <span data-testid="e2e-stage-page-number">
        {pad(position.slideIndex + 1)} / {pad(manifest.slides.length)}
      </span>
    </div>
  );
}

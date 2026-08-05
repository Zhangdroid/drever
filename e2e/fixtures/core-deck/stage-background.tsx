import type { StageLayerProps } from "drever";
import type { ReactElement } from "react";

export default function CoreFixtureBackground({
  position,
  renderMode,
}: StageLayerProps): ReactElement {
  return (
    <div
      className="fixture-stage-background"
      data-render-mode={renderMode}
      data-slide-index={position.slideIndex}
      data-step={position.step}
      data-testid="e2e-stage-background"
    />
  );
}

import { AmbientStage, type AmbientStageState } from "@drever/scenes";
import type { StageLayerProps } from "drever";
import type { ReactElement } from "react";

const states: readonly AmbientStageState[] = [
  "gather",
  "gather",
  "focus",
  "focus",
  "resolve",
];

export default function RoomScenesBackground({
  position,
  reducedMotion,
}: StageLayerProps): ReactElement {
  const state = states[position.slideIndex] ?? "quiet";

  return (
    <AmbientStage
      accent="#c8f460"
      accentAlt="#8e7dff"
      energy={position.slideIndex === 0 ? 0.62 : 0.32}
      reducedMotion={reducedMotion}
      state={state}
    />
  );
}

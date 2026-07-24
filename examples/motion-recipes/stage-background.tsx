import type { StageLayerProps } from "drever";
import type { ReactElement } from "react";
import { SubjectNetwork } from "./MotionArtifacts.tsx";

const NETWORK_HERO_SLIDE = 9;
const NETWORK_CONTEXT_SLIDE = 10;

export default function MotionRecipesBackground({ position }: StageLayerProps): ReactElement {
  const visible =
    position.slideIndex === NETWORK_HERO_SLIDE || position.slideIndex === NETWORK_CONTEXT_SLIDE;
  const mode = position.slideIndex >= NETWORK_CONTEXT_SLIDE ? "context" : "hero";

  return (
    <div className="motion-stage-network" data-visible={visible ? "" : undefined}>
      <SubjectNetwork mode={mode} />
    </div>
  );
}

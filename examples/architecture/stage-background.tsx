import type { StageLayerProps } from "drever";
import type { ReactElement } from "react";

type ArchitectureScene = "closing" | "contract" | "delivery" | "opening" | "pipeline" | "proof";

const sceneFor = (slideIndex: number, slideCount: number): ArchitectureScene => {
  if (slideIndex === 0) return "opening";
  if (slideIndex === slideCount - 1) return "closing";
  if (slideIndex < 3) return "contract";
  if (slideIndex < 5) return "pipeline";
  if (slideIndex < 8) return "delivery";
  return "proof";
};

export default function ArchitectureStageBackground({
  manifest,
  position,
  reducedMotion,
}: StageLayerProps): ReactElement {
  return (
    <div
      className="arch-stage-background"
      data-reduced-motion={reducedMotion ? "" : undefined}
      data-scene={sceneFor(position.slideIndex, manifest.slides.length)}
      data-testid="architecture-stage-background"
    >
      <span className="arch-stage-background__wash" />
      <svg aria-hidden="true" className="arch-stage-background__topology" viewBox="0 0 1600 900">
        <g className="arch-stage-background__graph">
          <path
            className="arch-stage-background__edge arch-stage-background__edge--spine"
            d="M 136 716 C 332 694 420 580 584 530 C 786 468 832 342 1022 312 C 1190 286 1292 214 1460 170"
          />
          <path className="arch-stage-background__edge" d="M 584 530 C 724 596 854 662 1058 716" />
          <path
            className="arch-stage-background__edge"
            d="M 1022 312 C 1148 362 1272 414 1432 470"
          />
          <path
            className="arch-stage-background__edge arch-stage-background__edge--return"
            d="M 1058 716 C 1230 680 1362 590 1432 470"
          />
          <g className="arch-stage-background__nodes">
            <circle cx="136" cy="716" r="8" />
            <circle cx="584" cy="530" r="11" />
            <circle cx="1022" cy="312" r="11" />
            <circle cx="1058" cy="716" r="8" />
            <circle cx="1432" cy="470" r="8" />
            <circle cx="1460" cy="170" r="8" />
          </g>
          <circle className="arch-stage-background__signal" cx="0" cy="0" r="8" />
        </g>
      </svg>
    </div>
  );
}

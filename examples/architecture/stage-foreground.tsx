import type { StageLayerProps } from "drever";
import type { ReactElement } from "react";

const chapterFor = (slideIndex: number, slideCount: number): string => {
  if (slideIndex === 0 || slideIndex === slideCount - 1) return "System";
  if (slideIndex < 4) return "Contract";
  if (slideIndex < 5) return "Compile";
  if (slideIndex < 7) return "Extend";
  if (slideIndex < 10) return "Deliver";
  return "Prove";
};

const page = (value: number): string => String(value).padStart(2, "0");

export default function ArchitectureStageForeground({
  manifest,
  position,
}: StageLayerProps): ReactElement {
  return (
    <div aria-hidden="true" className="arch-stage-foreground">
      <span className="arch-stage-foreground__chapter">
        Drever architecture
        <i />
        {chapterFor(position.slideIndex, manifest.slides.length)}
      </span>
      <span className="arch-stage-foreground__page" data-testid="architecture-stage-page">
        {page(position.slideIndex + 1)}
        <i>/</i>
        {page(manifest.slides.length)}
      </span>
    </div>
  );
}

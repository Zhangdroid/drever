import type { MDXComponents, MDXContent } from "@drever/core";
import type { CanvasDefinition, DeckManifest, PlannedTheme } from "@drever/schema";
import type { ReactElement } from "react";
import { resolveSlidePreviewPosition } from "./slide-preview.ts";
import type { StageComponents } from "./stage.tsx";
import { ViewerSurface } from "./viewer-surface.tsx";

export type StudioThumbnailProps = Readonly<{
  Content: MDXContent;
  canvas?: CanvasDefinition;
  manifest: DeckManifest;
  onRenderError?: (error: unknown) => void;
  registry?: MDXComponents;
  slideIndex: number;
  stage?: StageComponents;
  theme?: PlannedTheme;
}>;

/** @internal Renders one fully revealed slide without presentation runtime side effects. */
export const StudioThumbnail = ({
  Content,
  canvas,
  manifest,
  onRenderError,
  registry,
  slideIndex,
  stage,
  theme,
}: StudioThumbnailProps): ReactElement => {
  const slide = manifest.slides[slideIndex];
  if (slide === undefined) {
    throw new RangeError(`Drever cannot render thumbnail slide ${String(slideIndex + 1)}.`);
  }

  return (
    <ViewerSurface
      Content={Content}
      {...(canvas === undefined ? {} : { canvas })}
      idPrefix={`drever-studio-thumbnail-${slideIndex + 1}`}
      manageFocus={false}
      manifest={manifest}
      {...(onRenderError === undefined ? {} : { onRenderError })}
      position={resolveSlidePreviewPosition(slide)}
      reducedMotion
      {...(registry === undefined ? {} : { registry })}
      renderMode="export"
      {...(stage === undefined ? {} : { stage })}
      {...(theme === undefined ? {} : { theme })}
    />
  );
};

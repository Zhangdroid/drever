import type { SlideManifest } from "@drever/schema";
import type { DeckPosition } from "./presentation-state.ts";

/** Shows the most complete authored state in a slide overview thumbnail. */
export const resolveSlidePreviewPosition = (slide: SlideManifest): DeckPosition =>
  Object.freeze({
    slideId: slide.id,
    slideIndex: slide.index,
    step: slide.stepStops.at(-1) ?? 0,
  });

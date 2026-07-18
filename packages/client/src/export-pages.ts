import type { DeckManifest } from "@drever/schema";
import type { DeckPosition } from "./presentation-state.ts";

export type ExportPage = DeckPosition;

export type ExportPagePlanOptions = Readonly<{
  includeSteps?: boolean;
}>;

/** Plans stable PDF pages from authored Step stops rather than dense numeric ranges. */
export const planExportPages = (
  manifest: DeckManifest,
  { includeSteps = false }: ExportPagePlanOptions = {},
): readonly ExportPage[] =>
  Object.freeze(
    manifest.slides.flatMap((slide) => {
      const steps = includeSteps ? [0, ...slide.stepStops] : [slide.stepStops.at(-1) ?? 0];
      return steps.map((step) =>
        Object.freeze({ slideId: slide.id, slideIndex: slide.index, step }),
      );
    }),
  );

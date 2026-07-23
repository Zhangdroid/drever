import type { SourceRange } from "./source.ts";

export const DREVER_CURRENT_POSITION_VERSION = 2 as const;

export type DreverCurrentSurface = "audience" | "speaker";

export type DreverCurrentSelection = Readonly<{
  sourceRange: SourceRange;
  tag: string;
  text: string;
}>;

export type DreverCurrentPosition = Readonly<{
  version: typeof DREVER_CURRENT_POSITION_VERSION;
  sourcePath: string;
  surface: DreverCurrentSurface;
  route: string;
  position: Readonly<{
    slideId: string;
    slideIndex: number;
    step: number;
  }>;
  selection?: DreverCurrentSelection;
}>;

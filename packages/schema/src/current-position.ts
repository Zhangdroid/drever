export const DREVER_CURRENT_POSITION_VERSION = 1 as const;

export type DreverCurrentSurface = "audience" | "speaker";

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
}>;

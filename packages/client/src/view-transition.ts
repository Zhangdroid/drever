import type { PresentationTransitionType } from "./presentation-state.ts";

export const PRESENTATION_TRANSITION_TYPES = Object.freeze([
  "drever-step-forward",
  "drever-step-backward",
  "drever-slide-forward",
  "drever-slide-backward",
  "drever-jump-forward",
  "drever-jump-backward",
] as const satisfies readonly PresentationTransitionType[]);

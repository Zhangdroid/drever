import type { PresentationTransitionType } from "./presentation-state.ts";

export const PRESENTATION_TRANSITION_TYPES = Object.freeze([
  "drever-step-forward",
  "drever-step-backward",
  "drever-slide-forward",
  "drever-slide-backward",
  "drever-jump-forward",
  "drever-jump-backward",
] as const satisfies readonly PresentationTransitionType[]);

export type ScopedViewTransition = Readonly<{
  finished: Promise<void>;
  ready: Promise<void>;
  skipTransition(): void;
  updateCallbackDone: Promise<void>;
}>;

type ScopedViewTransitionRoot = HTMLElement &
  Readonly<{
    startViewTransition(options: {
      types: PresentationTransitionType[];
      update(): Promise<void>;
    }): ScopedViewTransition;
  }>;

/** Starts a typed View Transition whose snapshots are limited to one presentation surface. */
export const startScopedViewTransition = (
  root: HTMLElement,
  transitionType: PresentationTransitionType,
  update: () => Promise<void>,
): ScopedViewTransition =>
  (root as ScopedViewTransitionRoot).startViewTransition({
    types: [transitionType],
    update,
  });

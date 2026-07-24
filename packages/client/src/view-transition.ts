import type { PresentationChange, PresentationTransitionType } from "./presentation-state.ts";

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

type TransitionRoot = Pick<HTMLElement, "querySelector" | "removeAttribute" | "setAttribute">;
export type LocalSlideTransitionOrigin = "next" | "previous";

type ScopedViewTransitionRoot = HTMLElement &
  Readonly<{
    startViewTransition(options: {
      types: PresentationTransitionType[];
      update(): Promise<void>;
    }): ScopedViewTransition;
  }>;

const adjacentTransitionOrigin = (
  change: PresentationChange,
): LocalSlideTransitionOrigin | undefined => {
  if (change.to.slideIndex === change.from.slideIndex + 1) {
    return "previous";
  }
  if (change.to.slideIndex === change.from.slideIndex - 1) {
    return "next";
  }
};

/** @internal Resolves which adjacent origin assigns this Slide entry to live authored CSS. */
export const resolveLocalSlideTransition = (
  root: Pick<TransitionRoot, "querySelector">,
  change: PresentationChange,
): LocalSlideTransitionOrigin | undefined => {
  const from = adjacentTransitionOrigin(change);
  if (
    from === undefined ||
    root.querySelector(
      `[data-drever-slide][data-slide-index="${change.to.slideIndex}"]` +
        `[data-drever-slide-transition-from-${from}="local"]`,
    ) === null
  ) {
    return;
  }
  return from;
};

/** @internal Exposes the current live-DOM handoff to authored CSS. */
export const setLocalSlideTransitionMode = (
  root: Pick<TransitionRoot, "removeAttribute" | "setAttribute">,
  from: LocalSlideTransitionOrigin | undefined,
): void => {
  if (from !== undefined) {
    root.setAttribute("data-drever-transition-from", from);
    root.setAttribute("data-drever-transition-mode", "local");
  } else {
    root.removeAttribute("data-drever-transition-from");
    root.removeAttribute("data-drever-transition-mode");
  }
};

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

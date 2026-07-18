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

export type ScopedViewTransitionOptions = Readonly<{
  types: PresentationTransitionType[];
  update(): Promise<void>;
}>;

export type ScopedViewTransitionRoot = HTMLElement &
  Readonly<{
    startViewTransition(options: ScopedViewTransitionOptions): ScopedViewTransition;
  }>;

export type ReactTransitionRequest = Readonly<{
  change: PresentationChange;
  complete(): void;
  fail(error: unknown): void;
  signal: AbortSignal;
  transitionType: PresentationTransitionType;
}>;

export type ReactTransitionScheduler = (request: ReactTransitionRequest) => void;

export type ReactTransitionBridge = Readonly<{
  commit(change: PresentationChange, signal: AbortSignal): Promise<void>;
}>;

export const startScopedViewTransition = (
  root: HTMLElement,
  transitionType: PresentationTransitionType,
  update: () => Promise<void>,
): ScopedViewTransition =>
  (root as ScopedViewTransitionRoot).startViewTransition({
    types: [transitionType],
    update,
  });

const abortReason = (signal: AbortSignal): unknown =>
  signal.reason ?? new DOMException("The presentation navigation was superseded.", "AbortError");

export const createReactTransitionBridge = (
  schedule: ReactTransitionScheduler,
): ReactTransitionBridge =>
  Object.freeze({
    commit(change, signal) {
      if (signal.aborted) {
        return Promise.reject(abortReason(signal));
      }

      return new Promise<void>((resolve, reject) => {
        let settled = false;
        const settle = (callback: () => void): void => {
          if (settled) {
            return;
          }
          settled = true;
          signal.removeEventListener("abort", onAbort);
          callback();
        };
        const onAbort = (): void => settle(() => reject(abortReason(signal)));
        signal.addEventListener("abort", onAbort, { once: true });

        try {
          schedule(
            Object.freeze({
              change,
              signal,
              transitionType: change.transitionType,
              complete: () => settle(resolve),
              fail: (error) => settle(() => reject(error)),
            }),
          );
        } catch (error) {
          settle(() => reject(error));
        }
      });
    },
  });

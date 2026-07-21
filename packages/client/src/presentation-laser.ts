import type { NormalizedCanvasPoint } from "./presentation-focus.ts";
import type { DeckPosition } from "./presentation-state.ts";

export type PresentationLaserSignal = Readonly<{
  point: NormalizedCanvasPoint;
  position: DeckPosition;
}>;

export type PresentationLaserStore = Readonly<{
  getSnapshot(): PresentationLaserSignal | undefined;
  set(signal?: PresentationLaserSignal): void;
  subscribe(listener: () => void): () => void;
}>;

const snapshotSignal = (signal: PresentationLaserSignal): PresentationLaserSignal =>
  Object.freeze({
    point: Object.freeze({ x: signal.point.x, y: signal.point.y }),
    position: Object.freeze({
      slideId: signal.position.slideId,
      slideIndex: signal.position.slideIndex,
      step: signal.position.step,
    }),
  });

/** Owns the latest session-local presenter laser point without involving deck state. */
export const createPresentationLaserStore = (): PresentationLaserStore => {
  const listeners = new Set<() => void>();
  let snapshot: PresentationLaserSignal | undefined;

  return Object.freeze({
    getSnapshot: () => snapshot,
    set(signal) {
      if (signal === undefined) {
        if (snapshot === undefined) {
          return;
        }
        snapshot = undefined;
      } else {
        snapshot = snapshotSignal(signal);
      }
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
};

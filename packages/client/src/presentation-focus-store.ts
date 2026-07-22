import type { DeckPosition } from "./presentation-state.ts";
import {
  createPresentationFocusState,
  reducePresentationFocus,
  snapshotPresentationFocusAction,
  snapshotPresentationFocusState,
  type PresentationFocusAction,
  type PresentationFocusState,
  type PresentationFocusTool,
} from "./presentation-focus.ts";

export type PresentationFocusStore = Readonly<{
  dispatch(action: PresentationFocusAction): void;
  getSnapshot(): PresentationFocusState;
  replace(state: PresentationFocusState): void;
  subscribe(listener: () => void): () => void;
}>;

const isRepeatedLaserHeartbeat = (
  state: PresentationFocusState,
  action: PresentationFocusAction,
  next: PresentationFocusState,
): boolean => action.type === "move" && state.tool === "laser" && next === state;

/** Owns one immutable focus-tools session outside the React render tree. */
export const createPresentationFocusStore = (
  position: DeckPosition,
  tool: PresentationFocusTool = "laser",
): PresentationFocusStore => {
  const listeners = new Set<() => void>();
  let snapshot = createPresentationFocusState(position, tool);

  const publish = (next: PresentationFocusState, force = false): void => {
    if (next === snapshot && !force) {
      return;
    }
    snapshot = next === snapshot ? snapshotPresentationFocusState(next) : next;
    for (const listener of listeners) {
      listener();
    }
  };

  return Object.freeze({
    dispatch(input) {
      const action = snapshotPresentationFocusAction(input);
      const next = reducePresentationFocus(snapshot, action);
      publish(next, isRepeatedLaserHeartbeat(snapshot, action, next));
    },
    getSnapshot: () => snapshot,
    replace(input) {
      publish(snapshotPresentationFocusState(input));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
};

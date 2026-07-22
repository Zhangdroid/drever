import { describe, expect, it, vi } from "vite-plus/test";
import {
  createPresentationFocusStore,
  type PresentationFocusStore,
} from "./presentation-focus-store.ts";
import type { PresentationFocusAction, PresentationFocusState } from "./presentation-focus.ts";

const intro = { slideId: "intro", slideIndex: 0, step: 0 } as const;

const expectDeeplyFrozen = (state: PresentationFocusState): void => {
  expect(Object.isFrozen(state)).toBe(true);
  expect(Object.isFrozen(state.position)).toBe(true);
  expect(Object.isFrozen(state.strokes)).toBe(true);
  expect(state.strokes.every(Object.isFrozen)).toBe(true);
  expect(state.strokes.every((stroke) => Object.isFrozen(stroke.points))).toBe(true);
  expect(state.strokes.every((stroke) => stroke.points.every(Object.isFrozen))).toBe(true);
  if (state.activeStroke !== undefined) {
    expect(Object.isFrozen(state.activeStroke)).toBe(true);
    expect(Object.isFrozen(state.activeStroke.points)).toBe(true);
    expect(state.activeStroke.points.every(Object.isFrozen)).toBe(true);
  }
  if (state.laser !== undefined) {
    expect(Object.isFrozen(state.laser)).toBe(true);
  }
};

describe("presentation focus store", () => {
  it("owns immutable reducer state and ignores ordinary no-op actions", () => {
    const store = createPresentationFocusStore(intro, "pen");
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const begin: { point: { x: number; y: number }; type: "begin" } = {
      point: { x: 0.1, y: 0.2 },
      type: "begin",
    };

    store.dispatch(begin);
    begin.point.x = 0.9;
    store.dispatch({ point: { x: 0.4, y: 0.5 }, type: "end" });

    const snapshot = store.getSnapshot();
    expect(snapshot.strokes).toEqual([
      {
        id: "focus-0",
        points: [
          { x: 0.1, y: 0.2 },
          { x: 0.4, y: 0.5 },
        ],
        tool: "pen",
      },
    ]);
    expectDeeplyFrozen(snapshot);
    expect(Object.isFrozen(store)).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);

    store.dispatch({ tool: "pen", type: "selectTool" });
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    store.dispatch({ type: "clear" });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().strokes).toEqual([]);
  });

  it("publishes a fresh snapshot for a repeated Laser heartbeat", () => {
    const store = createPresentationFocusStore(intro);
    const listener = vi.fn();
    store.subscribe(listener);
    const heartbeat = { point: { x: 0.25, y: 0.75 }, type: "move" } as const;

    store.dispatch(heartbeat);
    const first = store.getSnapshot();
    store.dispatch(heartbeat);
    const second = store.getSnapshot();

    expect(second).not.toBe(first);
    expect(second).toEqual(first);
    expect(second.laser).toEqual({ x: 0.25, y: 0.75 });
    expect(listener).toHaveBeenCalledTimes(2);
    expectDeeplyFrozen(second);

    store.dispatch({ type: "clear" });
    store.dispatch({ type: "clear" });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("validates and deeply snapshots replacement state before publishing it", () => {
    const store = createPresentationFocusStore(intro);
    const listener = vi.fn();
    store.subscribe(listener);
    const replacement = {
      activeStroke: {
        id: "focus-1",
        points: [{ x: 0.6, y: 0.7 }],
        tool: "highlighter" as const,
      },
      nextStrokeId: 2,
      position: { slideId: "intro", slideIndex: 0, step: 2 },
      strokes: [
        {
          id: "focus-0",
          points: [
            { x: 0.1, y: 0.2 },
            { x: 0.3, y: 0.4 },
          ],
          tool: "pen" as const,
        },
      ],
      tool: "highlighter" as const,
    };

    store.replace(replacement);
    replacement.position.step = 99;
    replacement.strokes[0]!.points[0]!.x = 0.9;
    replacement.activeStroke.points[0]!.y = 0.1;

    const snapshot = store.getSnapshot();
    expect(snapshot).toMatchObject({
      activeStroke: { id: "focus-1", points: [{ x: 0.6, y: 0.7 }] },
      position: { slideId: "intro", slideIndex: 0, step: 2 },
      strokes: [
        {
          id: "focus-0",
          points: [
            { x: 0.1, y: 0.2 },
            { x: 0.3, y: 0.4 },
          ],
        },
      ],
      tool: "highlighter",
    });
    expectDeeplyFrozen(snapshot);
    expect(listener).toHaveBeenCalledOnce();

    expect(() =>
      store.replace({
        ...replacement,
        activeStroke: { ...replacement.activeStroke, id: "focus-0" },
      }),
    ).toThrowError(expect.objectContaining({ code: "DREVER_CLIENT_FOCUS_STATE_INVALID" }));
    expect(store.getSnapshot()).toBe(snapshot);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("rejects malformed actions without changing or notifying the session", () => {
    const store: PresentationFocusStore = createPresentationFocusStore(intro, "pen");
    const listener = vi.fn();
    store.subscribe(listener);
    const snapshot = store.getSnapshot();

    expect(() =>
      store.dispatch({ type: "teleport" } as unknown as PresentationFocusAction),
    ).toThrowError(expect.objectContaining({ code: "DREVER_CLIENT_FOCUS_ACTION_INVALID" }));
    expect(() => store.dispatch({ type: "move" } as PresentationFocusAction)).toThrowError(
      expect.objectContaining({ code: "DREVER_CLIENT_FOCUS_ACTION_INVALID" }),
    );
    expect(() => store.dispatch({ point: { x: Number.NaN, y: 0.5 }, type: "move" })).toThrowError(
      expect.objectContaining({ code: "DREVER_CLIENT_FOCUS_POINT_INVALID" }),
    );
    expect(() =>
      store.dispatch({
        position: { slideId: "", slideIndex: 0, step: 0 },
        type: "commitPosition",
      }),
    ).toThrowError(expect.objectContaining({ code: "DREVER_CLIENT_FOCUS_POSITION_INVALID" }));

    expect(store.getSnapshot()).toBe(snapshot);
    expect(listener).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vite-plus/test";
import type { DeckPosition } from "./presentation-state.ts";
import {
  createPresentationFocusState,
  normalizeCanvasPoint,
  projectCanvasPoint,
  reducePresentationFocus,
  type NormalizedCanvasPoint,
  type PresentationFocusState,
  type PresentationFocusTool,
} from "./presentation-focus.ts";

const position = (slideId: string, slideIndex: number, step = 0): DeckPosition => ({
  slideId,
  slideIndex,
  step,
});

const point = (x: number, y: number): NormalizedCanvasPoint => ({ x, y });

const selectTool = (
  state: PresentationFocusState,
  tool: PresentationFocusTool,
): PresentationFocusState => reducePresentationFocus(state, { tool, type: "selectTool" });

const draw = (
  state: PresentationFocusState,
  start: NormalizedCanvasPoint,
  end: NormalizedCanvasPoint,
): PresentationFocusState => {
  const active = reducePresentationFocus(state, { point: start, type: "begin" });
  return reducePresentationFocus(active, { point: end, type: "end" });
};

describe("presentation focus tools", () => {
  it("normalizes clipped viewport coordinates and projects them into an SVG viewBox", () => {
    const center = normalizeCanvasPoint(
      { x: 110, y: 70 },
      { height: 100, left: 10, top: 20, width: 200 },
    );

    expect(center).toEqual({ x: 0.5, y: 0.5 });
    expect(Object.isFrozen(center)).toBe(true);
    expect(
      normalizeCanvasPoint({ x: -500, y: 500 }, { height: 100, left: 10, top: 20, width: 200 }),
    ).toEqual({ x: 0, y: 1 });
    expect(projectCanvasPoint(center, { height: 1080, width: 1920 })).toEqual({
      x: 960,
      y: 540,
    });

    expect(() =>
      normalizeCanvasPoint({ x: 0, y: 0 }, { height: 0, left: 0, top: 0, width: 100 }),
    ).toThrowError(expect.objectContaining({ code: "DREVER_CLIENT_FOCUS_BOUNDS_INVALID" }));
    expect(() => projectCanvasPoint(center, { height: 1080, width: 0 })).toThrowError(
      expect.objectContaining({ code: "DREVER_CLIENT_FOCUS_CANVAS_INVALID" }),
    );
  });

  it("builds immutable Pen and Highlighter paths without mutating earlier snapshots", () => {
    const initial = createPresentationFocusState(position("intro", 0), "pen");
    const sourcePoint = { x: 0.1, y: 0.2 };
    const begun = reducePresentationFocus(initial, { point: sourcePoint, type: "begin" });
    sourcePoint.x = 0.9;
    const moved = reducePresentationFocus(begun, { point: point(0.4, 0.5), type: "move" });
    const duplicate = reducePresentationFocus(moved, {
      point: point(0.4, 0.5),
      type: "move",
    });
    const pen = reducePresentationFocus(duplicate, { point: point(0.8, 0.7), type: "end" });
    const highlighted = draw(selectTool(pen, "highlighter"), point(0.2, 0.8), point(0.7, 0.8));

    expect(initial).not.toHaveProperty("activeStroke");
    expect(begun.activeStroke?.points).toEqual([{ x: 0.1, y: 0.2 }]);
    expect(duplicate).toBe(moved);
    expect(highlighted.strokes).toEqual([
      {
        id: "focus-0",
        points: [
          { x: 0.1, y: 0.2 },
          { x: 0.4, y: 0.5 },
          { x: 0.8, y: 0.7 },
        ],
        tool: "pen",
      },
      {
        id: "focus-1",
        points: [
          { x: 0.2, y: 0.8 },
          { x: 0.7, y: 0.8 },
        ],
        tool: "highlighter",
      },
    ]);
    expect(Object.isFrozen(highlighted)).toBe(true);
    expect(Object.isFrozen(highlighted.strokes)).toBe(true);
    expect(highlighted.strokes.every(Object.isFrozen)).toBe(true);
    expect(highlighted.strokes.every((stroke) => Object.isFrozen(stroke.points))).toBe(true);
    expect(highlighted.strokes.every((stroke) => stroke.points.every(Object.isFrozen))).toBe(true);
  });

  it("keeps the Laser ephemeral and outside the undo history", () => {
    const ink = draw(
      createPresentationFocusState(position("intro", 0), "pen"),
      point(0.1, 0.1),
      point(0.3, 0.3),
    );
    const laserState = reducePresentationFocus(selectTool(ink, "laser"), {
      point: point(0.75, 0.25),
      type: "move",
    });

    expect(laserState).toMatchObject({
      laser: { x: 0.75, y: 0.25 },
      nextStrokeId: 1,
      strokes: [{ id: "focus-0", tool: "pen" }],
    });

    const undone = reducePresentationFocus(laserState, { type: "undo" });
    expect(undone.strokes).toEqual([]);
    expect(undone.laser).toEqual({ x: 0.75, y: 0.25 });
    expect(undone.nextStrokeId).toBe(1);

    const hidden = reducePresentationFocus(undone, { type: "end" });
    expect(hidden).not.toHaveProperty("laser");
    expect(reducePresentationFocus(hidden, { type: "undo" })).toBe(hidden);
  });

  it("undoes an active path before history and clears every visible focus mark", () => {
    const first = draw(
      createPresentationFocusState(position("intro", 0), "pen"),
      point(0.1, 0.1),
      point(0.2, 0.2),
    );
    const second = draw(first, point(0.3, 0.3), point(0.4, 0.4));
    const active = reducePresentationFocus(second, { point: point(0.5, 0.5), type: "begin" });
    const canceled = reducePresentationFocus(active, { type: "undo" });

    expect(canceled).not.toHaveProperty("activeStroke");
    expect(canceled.strokes).toHaveLength(2);

    const undone = reducePresentationFocus(canceled, { type: "undo" });
    expect(undone.strokes.map((stroke) => stroke.id)).toEqual(["focus-0"]);
    const marked = reducePresentationFocus(selectTool(undone, "laser"), {
      point: point(0.9, 0.1),
      type: "move",
    });
    const cleared = reducePresentationFocus(marked, { type: "clear" });
    expect(cleared.strokes).toEqual([]);
    expect(cleared).not.toHaveProperty("laser");
    expect(cleared.nextStrokeId).toBe(3);
    expect(reducePresentationFocus(cleared, { type: "clear" })).toBe(cleared);
  });

  it("preserves completed strokes across Steps and clears them when the slide changes", () => {
    const sourcePosition = { slideId: "intro", slideIndex: 0, step: 0 };
    let state = draw(
      createPresentationFocusState(sourcePosition, "pen"),
      point(0.1, 0.2),
      point(0.3, 0.4),
    );
    sourcePosition.step = 99;
    expect(state.position.step).toBe(0);

    const strokeHistory = state.strokes;
    state = reducePresentationFocus(state, {
      position: position("intro", 0, 2),
      type: "commitPosition",
    });
    expect(state.position).toEqual(position("intro", 0, 2));
    expect(state.strokes).toBe(strokeHistory);

    state = reducePresentationFocus(state, { point: point(0.8, 0.2), type: "begin" });
    const nextStep = reducePresentationFocus(state, {
      position: position("intro", 0, 5),
      type: "commitPosition",
    });
    expect(nextStep).not.toHaveProperty("activeStroke");
    expect(nextStep.strokes).toBe(strokeHistory);

    const nextSlide = reducePresentationFocus(nextStep, {
      position: position("details", 1),
      type: "commitPosition",
    });
    expect(nextSlide).toMatchObject({
      nextStrokeId: 2,
      position: position("details", 1),
      strokes: [],
      tool: "pen",
    });
    expect(Object.isFrozen(nextSlide.position)).toBe(true);
  });

  it("fails fast when a reducer receives a point outside the normalized contract", () => {
    const state = createPresentationFocusState(position("intro", 0), "pen");
    expect(() =>
      reducePresentationFocus(state, { point: point(1.01, 0.5), type: "begin" }),
    ).toThrowError(expect.objectContaining({ code: "DREVER_CLIENT_FOCUS_POINT_INVALID" }));
  });
});

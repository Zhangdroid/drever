import type { CanvasDefinition } from "@drever/schema";
import { DreverClientError } from "./client-error.ts";
import type { DeckPosition } from "./presentation-state.ts";

export type NormalizedCanvasPoint = Readonly<{
  x: number;
  y: number;
}>;

export type CanvasBounds = Readonly<{
  height: number;
  left: number;
  top: number;
  width: number;
}>;

export type CanvasSpacePoint = Readonly<{
  x: number;
  y: number;
}>;

export type ViewportPoint = Readonly<{
  x: number;
  y: number;
}>;

export type PresentationFocusTool = "highlighter" | "laser" | "pen";
export type PresentationInkTool = Exclude<PresentationFocusTool, "laser">;

export type PresentationFocusStroke = Readonly<{
  id: string;
  points: readonly NormalizedCanvasPoint[];
  tool: PresentationInkTool;
}>;

export type PresentationFocusState = Readonly<{
  activeStroke?: PresentationFocusStroke;
  laser?: NormalizedCanvasPoint;
  nextStrokeId: number;
  position: DeckPosition;
  strokes: readonly PresentationFocusStroke[];
  tool: PresentationFocusTool;
}>;

export type PresentationFocusAction =
  | Readonly<{ point: NormalizedCanvasPoint; type: "begin" }>
  | Readonly<{ type: "cancel" }>
  | Readonly<{ type: "clear" }>
  | Readonly<{ point?: NormalizedCanvasPoint; type: "end" }>
  | Readonly<{ point: NormalizedCanvasPoint; type: "move" }>
  | Readonly<{ position: DeckPosition; type: "commitPosition" }>
  | Readonly<{ tool: PresentationFocusTool; type: "selectTool" }>
  | Readonly<{ type: "undo" }>;

type FocusStateInput = Readonly<{
  activeStroke: PresentationFocusStroke | undefined;
  laser: NormalizedCanvasPoint | undefined;
  nextStrokeId: number;
  position: DeckPosition;
  strokes: readonly PresentationFocusStroke[];
  tool: PresentationFocusTool;
}>;

const EMPTY_STROKES: readonly PresentationFocusStroke[] = Object.freeze([]);

const fail = (code: string, message: string): never => {
  throw new DreverClientError(code, message);
};

const snapshotPosition = (position: DeckPosition): DeckPosition => {
  if (
    typeof position.slideId !== "string" ||
    position.slideId.length === 0 ||
    !Number.isSafeInteger(position.slideIndex) ||
    position.slideIndex < 0 ||
    !Number.isSafeInteger(position.step) ||
    position.step < 0
  ) {
    return fail(
      "DREVER_CLIENT_FOCUS_POSITION_INVALID",
      "A focus-tools position must contain a slide id, non-negative slide index, and non-negative Step.",
    );
  }
  return Object.freeze({
    slideId: position.slideId,
    slideIndex: position.slideIndex,
    step: position.step,
  });
};

const snapshotTool = (tool: PresentationFocusTool): PresentationFocusTool => {
  if (tool !== "laser" && tool !== "pen" && tool !== "highlighter") {
    return fail(
      "DREVER_CLIENT_FOCUS_TOOL_INVALID",
      'A focus tool must be "laser", "pen", or "highlighter".',
    );
  }
  return tool;
};

const snapshotPoint = (point: NormalizedCanvasPoint): NormalizedCanvasPoint => {
  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    point.x < 0 ||
    point.x > 1 ||
    point.y < 0 ||
    point.y > 1
  ) {
    return fail(
      "DREVER_CLIENT_FOCUS_POINT_INVALID",
      "A normalized canvas point must contain finite x and y values between zero and one.",
    );
  }
  return Object.freeze({ x: point.x, y: point.y });
};

const snapshotState = ({
  activeStroke,
  laser,
  nextStrokeId,
  position,
  strokes,
  tool,
}: FocusStateInput): PresentationFocusState =>
  Object.freeze({
    ...(activeStroke === undefined ? {} : { activeStroke }),
    ...(laser === undefined ? {} : { laser }),
    nextStrokeId,
    position,
    strokes,
    tool,
  });

const samePoint = (left: NormalizedCanvasPoint, right: NormalizedCanvasPoint): boolean =>
  left.x === right.x && left.y === right.y;

const appendPoint = (
  stroke: PresentationFocusStroke,
  input: NormalizedCanvasPoint,
): PresentationFocusStroke => {
  const point = snapshotPoint(input);
  const previous = stroke.points.at(-1) as NormalizedCanvasPoint;
  if (samePoint(previous, point)) {
    return stroke;
  }
  return Object.freeze({
    ...stroke,
    points: Object.freeze([...stroke.points, point]),
  });
};

const inkTool = (tool: PresentationFocusTool): PresentationInkTool =>
  tool === "laser"
    ? fail("DREVER_CLIENT_FOCUS_TOOL_INVALID", "A laser cannot create a persistent stroke.")
    : tool;

const beginStroke = (
  tool: PresentationFocusTool,
  id: number,
  point: NormalizedCanvasPoint,
): PresentationFocusStroke =>
  Object.freeze({
    id: `focus-${id}`,
    points: Object.freeze([snapshotPoint(point)]),
    tool: inkTool(tool),
  });

const validBounds = (bounds: CanvasBounds): boolean =>
  Number.isFinite(bounds.left) &&
  Number.isFinite(bounds.top) &&
  Number.isFinite(bounds.width) &&
  bounds.width > 0 &&
  Number.isFinite(bounds.height) &&
  bounds.height > 0;

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

/** Converts a viewport coordinate to a clipped, immutable canvas-relative point. */
export const normalizeCanvasPoint = (
  point: ViewportPoint,
  bounds: CanvasBounds,
): NormalizedCanvasPoint => {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !validBounds(bounds)) {
    return fail(
      "DREVER_CLIENT_FOCUS_BOUNDS_INVALID",
      "Canvas coordinates require finite viewport values and positive finite bounds.",
    );
  }
  return snapshotPoint({
    x: clamp((point.x - bounds.left) / bounds.width),
    y: clamp((point.y - bounds.top) / bounds.height),
  });
};

/** Projects a normalized point into the logical coordinate space used by an SVG viewBox. */
export const projectCanvasPoint = (
  input: NormalizedCanvasPoint,
  canvas: CanvasDefinition,
): CanvasSpacePoint => {
  const point = snapshotPoint(input);
  if (
    !Number.isFinite(canvas.width) ||
    canvas.width <= 0 ||
    !Number.isFinite(canvas.height) ||
    canvas.height <= 0
  ) {
    return fail(
      "DREVER_CLIENT_FOCUS_CANVAS_INVALID",
      "Projecting a focus point requires a positive finite canvas size.",
    );
  }
  return Object.freeze({ x: point.x * canvas.width, y: point.y * canvas.height });
};

export const createPresentationFocusState = (
  position: DeckPosition,
  tool: PresentationFocusTool = "laser",
): PresentationFocusState =>
  snapshotState({
    activeStroke: undefined,
    laser: undefined,
    nextStrokeId: 0,
    position: snapshotPosition(position),
    strokes: EMPTY_STROKES,
    tool: snapshotTool(tool),
  });

/** Applies one focus-tools interaction without mutating the current session snapshot. */
export const reducePresentationFocus = (
  state: PresentationFocusState,
  action: PresentationFocusAction,
): PresentationFocusState => {
  switch (action.type) {
    case "selectTool": {
      const tool = snapshotTool(action.tool);
      if (state.tool === tool && state.activeStroke === undefined && state.laser === undefined) {
        return state;
      }
      return snapshotState({
        activeStroke: undefined,
        laser: undefined,
        nextStrokeId: state.nextStrokeId,
        position: state.position,
        strokes: state.strokes,
        tool,
      });
    }
    case "begin": {
      if (state.tool === "laser") {
        return snapshotState({
          activeStroke: undefined,
          laser: snapshotPoint(action.point),
          nextStrokeId: state.nextStrokeId,
          position: state.position,
          strokes: state.strokes,
          tool: state.tool,
        });
      }
      if (state.activeStroke !== undefined) {
        return state;
      }
      return snapshotState({
        activeStroke: beginStroke(state.tool, state.nextStrokeId, action.point),
        laser: undefined,
        nextStrokeId: state.nextStrokeId + 1,
        position: state.position,
        strokes: state.strokes,
        tool: state.tool,
      });
    }
    case "move": {
      if (state.tool === "laser") {
        const laser = snapshotPoint(action.point);
        if (state.laser !== undefined && samePoint(state.laser, laser)) {
          return state;
        }
        return snapshotState({
          activeStroke: undefined,
          laser,
          nextStrokeId: state.nextStrokeId,
          position: state.position,
          strokes: state.strokes,
          tool: state.tool,
        });
      }
      if (state.activeStroke === undefined) {
        return state;
      }
      const activeStroke = appendPoint(state.activeStroke, action.point);
      if (activeStroke === state.activeStroke) {
        return state;
      }
      return snapshotState({
        activeStroke,
        laser: undefined,
        nextStrokeId: state.nextStrokeId,
        position: state.position,
        strokes: state.strokes,
        tool: state.tool,
      });
    }
    case "end": {
      if (state.tool === "laser") {
        if (state.laser === undefined) {
          return state;
        }
        return snapshotState({
          activeStroke: undefined,
          laser: undefined,
          nextStrokeId: state.nextStrokeId,
          position: state.position,
          strokes: state.strokes,
          tool: state.tool,
        });
      }
      if (state.activeStroke === undefined) {
        return state;
      }
      const completed =
        action.point === undefined
          ? state.activeStroke
          : appendPoint(state.activeStroke, action.point);
      return snapshotState({
        activeStroke: undefined,
        laser: undefined,
        nextStrokeId: state.nextStrokeId,
        position: state.position,
        strokes: Object.freeze([...state.strokes, completed]),
        tool: state.tool,
      });
    }
    case "cancel": {
      if (state.activeStroke === undefined && state.laser === undefined) {
        return state;
      }
      return snapshotState({
        activeStroke: undefined,
        laser: undefined,
        nextStrokeId: state.nextStrokeId,
        position: state.position,
        strokes: state.strokes,
        tool: state.tool,
      });
    }
    case "undo": {
      if (state.activeStroke !== undefined) {
        return snapshotState({
          activeStroke: undefined,
          laser: state.laser,
          nextStrokeId: state.nextStrokeId,
          position: state.position,
          strokes: state.strokes,
          tool: state.tool,
        });
      }
      if (state.strokes.length === 0) {
        return state;
      }
      return snapshotState({
        activeStroke: undefined,
        laser: state.laser,
        nextStrokeId: state.nextStrokeId,
        position: state.position,
        strokes: Object.freeze(state.strokes.slice(0, -1)),
        tool: state.tool,
      });
    }
    case "clear": {
      if (
        state.activeStroke === undefined &&
        state.laser === undefined &&
        state.strokes.length === 0
      ) {
        return state;
      }
      return snapshotState({
        activeStroke: undefined,
        laser: undefined,
        nextStrokeId: state.nextStrokeId,
        position: state.position,
        strokes: EMPTY_STROKES,
        tool: state.tool,
      });
    }
    case "commitPosition": {
      const position = snapshotPosition(action.position);
      if (
        state.position.slideId === position.slideId &&
        state.position.slideIndex === position.slideIndex &&
        state.position.step === position.step
      ) {
        return state;
      }
      const changedSlide =
        state.position.slideId !== position.slideId ||
        state.position.slideIndex !== position.slideIndex;
      return snapshotState({
        activeStroke: undefined,
        laser: undefined,
        nextStrokeId: state.nextStrokeId,
        position,
        strokes: changedSlide ? EMPTY_STROKES : state.strokes,
        tool: state.tool,
      });
    }
  }
};

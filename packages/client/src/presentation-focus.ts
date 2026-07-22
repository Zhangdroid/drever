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

export type PresentationFocusAppearance = Readonly<{
  highlighter?: Readonly<{
    color?: string;
    opacity?: number;
    width?: number;
  }>;
  laser?: Readonly<{
    color?: string;
  }>;
  pen?: Readonly<{
    color?: string;
    width?: number;
  }>;
}>;

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

export const focusToolForKey = (key: string): PresentationFocusTool | undefined => {
  switch (key.toLowerCase()) {
    case "h":
      return "highlighter";
    case "i":
      return "pen";
    case "l":
      return "laser";
    default:
      return undefined;
  }
};

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

const snapshotPosition = (position: unknown): DeckPosition => {
  if (
    typeof position !== "object" ||
    position === null ||
    !("slideId" in position) ||
    !("slideIndex" in position) ||
    !("step" in position) ||
    typeof position.slideId !== "string" ||
    position.slideId.length === 0 ||
    typeof position.slideIndex !== "number" ||
    !Number.isSafeInteger(position.slideIndex) ||
    position.slideIndex < 0 ||
    typeof position.step !== "number" ||
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

const snapshotTool = (tool: unknown): PresentationFocusTool => {
  if (tool !== "laser" && tool !== "pen" && tool !== "highlighter") {
    return fail(
      "DREVER_CLIENT_FOCUS_TOOL_INVALID",
      'A focus tool must be "laser", "pen", or "highlighter".',
    );
  }
  return tool;
};

const snapshotPoint = (point: unknown): NormalizedCanvasPoint => {
  if (
    typeof point !== "object" ||
    point === null ||
    !("x" in point) ||
    !("y" in point) ||
    typeof point.x !== "number" ||
    typeof point.y !== "number" ||
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

const snapshotStroke = (stroke: unknown): PresentationFocusStroke => {
  if (
    typeof stroke !== "object" ||
    stroke === null ||
    !("id" in stroke) ||
    !("points" in stroke) ||
    !("tool" in stroke) ||
    typeof stroke.id !== "string" ||
    !/^focus-(?:0|[1-9]\d*)$/u.test(stroke.id) ||
    !Array.isArray(stroke.points) ||
    stroke.points.length === 0 ||
    (stroke.tool !== "pen" && stroke.tool !== "highlighter")
  ) {
    return fail(
      "DREVER_CLIENT_FOCUS_STROKE_INVALID",
      "A focus stroke must contain a generated id, at least one normalized point, and an ink tool.",
    );
  }
  return Object.freeze({
    id: stroke.id,
    points: Object.freeze(stroke.points.map(snapshotPoint)),
    tool: stroke.tool,
  });
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

/** Validates and deeply snapshots focus state received across an external boundary. */
export const snapshotPresentationFocusState = (input: unknown): PresentationFocusState => {
  if (
    typeof input !== "object" ||
    input === null ||
    !("nextStrokeId" in input) ||
    !("position" in input) ||
    !("strokes" in input) ||
    !("tool" in input) ||
    !Number.isSafeInteger(input.nextStrokeId) ||
    (input.nextStrokeId as number) < 0 ||
    !Array.isArray(input.strokes)
  ) {
    return fail(
      "DREVER_CLIENT_FOCUS_STATE_INVALID",
      "Focus state must contain a position, tool, stroke list, and non-negative next stroke id.",
    );
  }

  const tool = snapshotTool(input.tool);
  const strokes = input.strokes.map(snapshotStroke);
  const activeStroke =
    "activeStroke" in input && input.activeStroke !== undefined
      ? snapshotStroke(input.activeStroke)
      : undefined;
  const laser =
    "laser" in input && input.laser !== undefined ? snapshotPoint(input.laser) : undefined;
  const ids = new Set(strokes.map(({ id }) => id));
  if (activeStroke !== undefined && ids.has(activeStroke.id)) {
    return fail(
      "DREVER_CLIENT_FOCUS_STATE_INVALID",
      "Active and completed focus strokes must have distinct ids.",
    );
  }
  if (ids.size !== strokes.length) {
    return fail(
      "DREVER_CLIENT_FOCUS_STATE_INVALID",
      "Completed focus strokes must have distinct ids.",
    );
  }
  const nextStrokeId = input.nextStrokeId as number;
  const allocatedStrokes = activeStroke === undefined ? strokes : [...strokes, activeStroke];
  if (
    allocatedStrokes.some(
      ({ id }) => Number.parseInt(id.slice("focus-".length), 10) >= nextStrokeId,
    )
  ) {
    return fail(
      "DREVER_CLIENT_FOCUS_STATE_INVALID",
      "Every allocated focus stroke id must precede the next stroke id.",
    );
  }
  if (activeStroke !== undefined && (tool === "laser" || activeStroke.tool !== tool)) {
    return fail(
      "DREVER_CLIENT_FOCUS_STATE_INVALID",
      "An active focus stroke must use the selected ink tool.",
    );
  }
  if (laser !== undefined && tool !== "laser") {
    return fail(
      "DREVER_CLIENT_FOCUS_STATE_INVALID",
      "A transient laser point requires the Laser tool to be selected.",
    );
  }

  return snapshotState({
    activeStroke,
    laser,
    nextStrokeId,
    position: snapshotPosition(input.position),
    strokes: Object.freeze(strokes),
    tool,
  });
};

/** Validates and snapshots one reducer action received across an external boundary. */
export const snapshotPresentationFocusAction = (input: unknown): PresentationFocusAction => {
  if (typeof input !== "object" || input === null || !("type" in input)) {
    return fail("DREVER_CLIENT_FOCUS_ACTION_INVALID", "A focus action must contain a type.");
  }
  switch (input.type) {
    case "begin":
    case "move":
      if (!("point" in input)) {
        return fail(
          "DREVER_CLIENT_FOCUS_ACTION_INVALID",
          `The ${input.type} focus action requires a normalized point.`,
        );
      }
      return Object.freeze({ point: snapshotPoint(input.point), type: input.type });
    case "cancel":
    case "clear":
    case "undo":
      return Object.freeze({ type: input.type });
    case "commitPosition":
      if (!("position" in input)) {
        return fail(
          "DREVER_CLIENT_FOCUS_ACTION_INVALID",
          "The commitPosition focus action requires a position.",
        );
      }
      return Object.freeze({ position: snapshotPosition(input.position), type: input.type });
    case "end":
      return Object.freeze({
        ...(!("point" in input) || input.point === undefined
          ? {}
          : { point: snapshotPoint(input.point) }),
        type: input.type,
      });
    case "selectTool":
      if (!("tool" in input)) {
        return fail(
          "DREVER_CLIENT_FOCUS_ACTION_INVALID",
          "The selectTool focus action requires a tool.",
        );
      }
      return Object.freeze({ tool: snapshotTool(input.tool), type: input.type });
    default:
      return fail(
        "DREVER_CLIENT_FOCUS_ACTION_INVALID",
        `Unknown focus action type ${String(input.type)}.`,
      );
  }
};

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

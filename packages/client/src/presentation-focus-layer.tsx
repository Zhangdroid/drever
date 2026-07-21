/// <reference types="react/canary" />

import type { CanvasDefinition } from "@drever/schema";
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from "react";
import type { DeckPosition } from "./presentation-state.ts";
import {
  normalizeCanvasPoint,
  projectCanvasPoint,
  type NormalizedCanvasPoint,
  type PresentationFocusAction,
  type PresentationFocusState,
  type PresentationFocusStroke,
} from "./presentation-focus.ts";

export type PresentationFocusLayerProps = Readonly<{
  active: boolean;
  canvas: CanvasDefinition;
  dispatch: Dispatch<PresentationFocusAction>;
  position: DeckPosition;
  remoteLaser?: NormalizedCanvasPoint;
  state: PresentationFocusState;
}>;

const sameSlide = (left: DeckPosition, right: DeckPosition): boolean =>
  left.slideId === right.slideId && left.slideIndex === right.slideIndex;

const samePosition = (left: DeckPosition, right: DeckPosition): boolean =>
  sameSlide(left, right) && left.step === right.step;

const formatCoordinate = (value: number): string => String(Number(value.toFixed(3)));

/** Creates a deterministic SVG path in the authored canvas coordinate space. */
export const createPresentationFocusPath = (
  stroke: PresentationFocusStroke,
  canvas: CanvasDefinition,
): string => {
  const commands = stroke.points.map((point, index) => {
    const projected = projectCanvasPoint(point, canvas);
    return `${index === 0 ? "M" : "L"} ${formatCoordinate(projected.x)} ${formatCoordinate(projected.y)}`;
  });
  const first = commands[0];
  if (commands.length === 1 && first !== undefined) {
    commands.push(first.replace(/^M/u, "L"));
  }
  return commands.join(" ");
};

const pointFromEvent = (
  event: ReactPointerEvent<SVGSVGElement>,
): ReturnType<typeof normalizeCanvasPoint> => {
  const bounds = event.currentTarget.getBoundingClientRect();
  return normalizeCanvasPoint(
    { x: event.clientX, y: event.clientY },
    { height: bounds.height, left: bounds.left, top: bounds.top, width: bounds.width },
  );
};

const Stroke = memo(
  ({
    canvas,
    stroke,
  }: Readonly<{
    canvas: CanvasDefinition;
    stroke: PresentationFocusStroke;
  }>): ReactElement => (
    <path
      className={`drever-presentation-focus__stroke drever-presentation-focus__stroke--${stroke.tool}`}
      d={createPresentationFocusPath(stroke, canvas)}
      data-drever-focus-stroke={stroke.id}
      data-focus-tool={stroke.tool}
    />
  ),
);

/** Pointer, touch, and stylus layer kept outside the deck View Transition boundary. */
export const PresentationFocusLayer = ({
  active,
  canvas,
  dispatch,
  position,
  remoteLaser,
  state,
}: PresentationFocusLayerProps): ReactElement => {
  const pointerRef = useRef<number | undefined>(undefined);
  const frameRef = useRef<number | undefined>(undefined);
  const frameWindowRef = useRef<Window | undefined>(undefined);
  const pendingPointRef = useRef<NormalizedCanvasPoint | undefined>(undefined);
  const showSlideMarks = sameSlide(state.position, position);
  const showTransientMarks = samePosition(state.position, position);
  const strokes = showSlideMarks ? state.strokes : [];
  const activeStroke = showTransientMarks ? state.activeStroke : undefined;
  const laser = showTransientMarks ? state.laser : undefined;
  const visibleLaser = laser ?? remoteLaser;
  const laserPoint =
    visibleLaser === undefined ? undefined : projectCanvasPoint(visibleLaser, canvas);

  const cancelScheduledMove = useCallback((): void => {
    if (frameRef.current !== undefined) {
      frameWindowRef.current?.cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = undefined;
    frameWindowRef.current = undefined;
    pendingPointRef.current = undefined;
  }, []);

  const scheduleMove = useCallback(
    (point: NormalizedCanvasPoint, window: Window): void => {
      pendingPointRef.current = point;
      if (frameRef.current !== undefined) {
        return;
      }
      frameWindowRef.current = window;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = undefined;
        frameWindowRef.current = undefined;
        const pending = pendingPointRef.current;
        pendingPointRef.current = undefined;
        if (pending !== undefined) {
          dispatch({ point: pending, type: "move" });
        }
      });
    },
    [dispatch],
  );

  useEffect(() => cancelScheduledMove, [cancelScheduledMove]);

  useEffect(() => {
    pointerRef.current = undefined;
    cancelScheduledMove();
  }, [active, cancelScheduledMove, state.tool]);

  const releasePointer = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (pointerRef.current === event.pointerId) {
      pointerRef.current = undefined;
    }
  };

  return (
    <svg
      aria-hidden="true"
      className="drever-presentation-focus"
      data-active={active ? "" : undefined}
      data-drever-focus-layer=""
      data-focus-tool={state.tool}
      focusable="false"
      onLostPointerCapture={(event) => {
        if (pointerRef.current !== event.pointerId) {
          return;
        }
        cancelScheduledMove();
        pointerRef.current = undefined;
        dispatch({ type: "cancel" });
      }}
      onPointerCancel={(event) => {
        if (pointerRef.current !== event.pointerId) {
          return;
        }
        cancelScheduledMove();
        releasePointer(event);
        dispatch({ type: "cancel" });
      }}
      onPointerDown={(event) => {
        const trackedPointer = pointerRef.current;
        if (
          !active ||
          !event.isPrimary ||
          event.button !== 0 ||
          (state.tool === "laser"
            ? trackedPointer !== undefined && trackedPointer !== event.pointerId
            : trackedPointer !== undefined)
        ) {
          return;
        }
        event.preventDefault();
        pointerRef.current = event.pointerId;
        if (state.tool !== "laser") {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        dispatch({ point: pointFromEvent(event), type: "begin" });
      }}
      onPointerLeave={(event) => {
        if (
          active &&
          event.isPrimary &&
          state.tool === "laser" &&
          pointerRef.current === event.pointerId
        ) {
          cancelScheduledMove();
          pointerRef.current = undefined;
          dispatch({ type: "end" });
        }
      }}
      onPointerMove={(event) => {
        if (!active || !event.isPrimary) {
          return;
        }
        if (state.tool === "laser") {
          if (pointerRef.current === undefined) {
            pointerRef.current = event.pointerId;
          } else if (pointerRef.current !== event.pointerId) {
            return;
          }
        } else if (pointerRef.current !== event.pointerId) {
          return;
        }
        const window = event.currentTarget.ownerDocument.defaultView;
        if (window !== null) {
          scheduleMove(pointFromEvent(event), window);
        }
      }}
      onPointerUp={(event) => {
        if (!active || pointerRef.current !== event.pointerId) {
          return;
        }
        event.preventDefault();
        const point = state.tool === "laser" ? undefined : pointFromEvent(event);
        cancelScheduledMove();
        releasePointer(event);
        dispatch({ ...(point === undefined ? {} : { point }), type: "end" });
      }}
      preserveAspectRatio="none"
      viewBox={`0 0 ${canvas.width} ${canvas.height}`}
    >
      {strokes.map((stroke) => (
        <Stroke canvas={canvas} key={stroke.id} stroke={stroke} />
      ))}
      {activeStroke === undefined ? null : <Stroke canvas={canvas} stroke={activeStroke} />}
      {laserPoint === undefined ? null : (
        <g className="drever-presentation-focus__laser" data-drever-focus-laser="">
          <circle cx={laserPoint.x} cy={laserPoint.y} r="26" />
          <circle cx={laserPoint.x} cy={laserPoint.y} r="11" />
          <circle cx={laserPoint.x} cy={laserPoint.y} r="3.5" />
        </g>
      )}
    </svg>
  );
};

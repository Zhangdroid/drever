/// <reference types="react/canary" />

import type { CanvasDefinition } from "@drever/schema";
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
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
  type PresentationFocusAppearance,
  type PresentationFocusState,
  type PresentationFocusStroke,
} from "./presentation-focus.ts";

export type PresentationFocusLayerProps = Readonly<{
  active: boolean;
  appearance?: PresentationFocusAppearance;
  canvas: CanvasDefinition;
  dispatch: Dispatch<PresentationFocusAction>;
  onInteractionChange?: (interacting: boolean) => void;
  position: DeckPosition;
  remoteState?: PresentationFocusState;
  state: PresentationFocusState;
}>;

const sameSlide = (left: DeckPosition, right: DeckPosition): boolean =>
  left.slideId === right.slideId && left.slideIndex === right.slideIndex;

const samePosition = (left: DeckPosition, right: DeckPosition): boolean =>
  sameSlide(left, right) && left.step === right.step;

const formatCoordinate = (value: number): string => String(Number(value.toFixed(3)));

type PresentationFocusStyle = CSSProperties & {
  "--drever-focus-highlighter-color"?: string;
  "--drever-focus-highlighter-opacity"?: number;
  "--drever-focus-highlighter-width"?: string;
  "--drever-focus-laser-color"?: string;
  "--drever-focus-pen-color"?: string;
  "--drever-focus-pen-width"?: string;
};

const focusStyle = (
  appearance: PresentationFocusAppearance | undefined,
): PresentationFocusStyle | undefined => {
  if (appearance === undefined) {
    return;
  }
  const style: PresentationFocusStyle = {};
  if (appearance.pen?.color !== undefined) {
    style["--drever-focus-pen-color"] = appearance.pen.color;
  }
  if (appearance.pen?.width !== undefined) {
    style["--drever-focus-pen-width"] = `${appearance.pen.width}px`;
  }
  if (appearance.highlighter?.color !== undefined) {
    style["--drever-focus-highlighter-color"] = appearance.highlighter.color;
  }
  if (appearance.highlighter?.opacity !== undefined) {
    style["--drever-focus-highlighter-opacity"] = appearance.highlighter.opacity;
  }
  if (appearance.highlighter?.width !== undefined) {
    style["--drever-focus-highlighter-width"] = `${appearance.highlighter.width}px`;
  }
  if (appearance.laser?.color !== undefined) {
    style["--drever-focus-laser-color"] = appearance.laser.color;
  }
  return Object.keys(style).length === 0 ? undefined : style;
};

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
    source,
    stroke,
  }: Readonly<{
    canvas: CanvasDefinition;
    source: "local" | "speaker";
    stroke: PresentationFocusStroke;
  }>): ReactElement => (
    <path
      className={`drever-presentation-focus__stroke drever-presentation-focus__stroke--${stroke.tool}`}
      d={createPresentationFocusPath(stroke, canvas)}
      data-drever-focus-stroke={stroke.id}
      data-focus-source={source}
      data-focus-tool={stroke.tool}
    />
  ),
);

/** Pointer, touch, and stylus layer kept outside deck content and named only when visible. */
export const PresentationFocusLayer = ({
  active,
  appearance,
  canvas,
  dispatch,
  onInteractionChange,
  position,
  remoteState,
  state,
}: PresentationFocusLayerProps): ReactElement => {
  const pointerRef = useRef<number | undefined>(undefined);
  const interactionRef = useRef(false);
  const frameRef = useRef<number | undefined>(undefined);
  const frameWindowRef = useRef<Window | undefined>(undefined);
  const pendingPointRef = useRef<NormalizedCanvasPoint | undefined>(undefined);
  const showSlideMarks = sameSlide(state.position, position);
  const showTransientMarks = samePosition(state.position, position);
  const strokes = showSlideMarks ? state.strokes : [];
  const activeStroke = showTransientMarks ? state.activeStroke : undefined;
  const laser = showTransientMarks ? state.laser : undefined;
  const showRemoteSlideMarks =
    remoteState !== undefined && sameSlide(remoteState.position, position);
  const showRemoteTransientMarks =
    remoteState !== undefined && samePosition(remoteState.position, position);
  const remoteStrokes = showRemoteSlideMarks ? remoteState.strokes : [];
  const remoteActiveStroke = showRemoteTransientMarks ? remoteState.activeStroke : undefined;
  const visibleLaser = laser ?? (showRemoteTransientMarks ? remoteState.laser : undefined);
  const laserPoint =
    visibleLaser === undefined ? undefined : projectCanvasPoint(visibleLaser, canvas);
  const style = focusStyle(appearance);

  const setInteracting = useCallback(
    (interacting: boolean): void => {
      if (interactionRef.current === interacting) {
        return;
      }
      interactionRef.current = interacting;
      onInteractionChange?.(interacting);
    },
    [onInteractionChange],
  );

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

  useEffect(
    () => () => {
      cancelScheduledMove();
      setInteracting(false);
    },
    [cancelScheduledMove, setInteracting],
  );

  useEffect(() => {
    pointerRef.current = undefined;
    cancelScheduledMove();
    setInteracting(false);
  }, [active, cancelScheduledMove, setInteracting, state.tool]);

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
        setInteracting(false);
        dispatch({ type: "end" });
      }}
      onPointerCancel={(event) => {
        if (pointerRef.current !== event.pointerId) {
          return;
        }
        cancelScheduledMove();
        pointerRef.current = undefined;
        setInteracting(false);
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
        setInteracting(true);
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
          setInteracting(false);
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
            setInteracting(true);
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
        pointerRef.current = undefined;
        dispatch({ ...(point === undefined ? {} : { point }), type: "end" });
        setInteracting(false);
      }}
      preserveAspectRatio="none"
      {...(style === undefined ? {} : { style })}
      viewBox={`0 0 ${canvas.width} ${canvas.height}`}
    >
      {remoteStrokes.map((stroke) => (
        <Stroke canvas={canvas} key={`speaker-${stroke.id}`} source="speaker" stroke={stroke} />
      ))}
      {remoteActiveStroke === undefined ? null : (
        <Stroke canvas={canvas} source="speaker" stroke={remoteActiveStroke} />
      )}
      {strokes.map((stroke) => (
        <Stroke canvas={canvas} key={stroke.id} source="local" stroke={stroke} />
      ))}
      {activeStroke === undefined ? null : (
        <Stroke canvas={canvas} source="local" stroke={activeStroke} />
      )}
      {laserPoint === undefined ? null : (
        <g className="drever-presentation-focus__laser" data-drever-focus-laser="">
          <circle
            className="drever-presentation-focus__laser-halo"
            cx={laserPoint.x}
            cy={laserPoint.y}
            r="12"
          />
          <circle
            className="drever-presentation-focus__laser-core"
            cx={laserPoint.x}
            cy={laserPoint.y}
            r="4.25"
          />
        </g>
      )}
    </svg>
  );
};

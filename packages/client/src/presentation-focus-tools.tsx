/// <reference types="react/canary" />

import type { CanvasDefinition } from "@drever/schema";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type RefObject,
  type SVGProps,
} from "react";
import { createPortal } from "react-dom";
import { acceptsPresentationShortcut } from "./keyboard.ts";
import type { DeckPosition } from "./presentation-state.ts";
import { PresentationFocusLayer } from "./presentation-focus-layer.tsx";
import {
  createPresentationFocusState,
  reducePresentationFocus,
  type PresentationFocusTool,
} from "./presentation-focus.ts";
import type { PresentationLaserStore } from "./presentation-laser.ts";

export type PresentationFocusToolsProps = Readonly<{
  canvas: CanvasDefinition;
  canvasRef: RefObject<HTMLDivElement | null>;
  position: DeckPosition;
  remoteLaser: PresentationLaserStore;
}>;

const REMOTE_LASER_EXPIRY_MS = 1_500;

const Icon = ({ children, ...props }: SVGProps<SVGSVGElement>): ReactElement => (
  <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18" {...props}>
    {children}
  </svg>
);

const FocusIcon = (): ReactElement => (
  <Icon>
    <circle cx="12" cy="12" r="2.6" fill="currentColor" />
    <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="M12 2v3M12 19v3M2 12h3M19 12h3"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.6"
    />
  </Icon>
);

const LaserIcon = (): ReactElement => (
  <Icon>
    <circle cx="12" cy="12" r="3" fill="currentColor" />
    <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" />
  </Icon>
);

const PenIcon = (): ReactElement => (
  <Icon>
    <path
      d="m5 19 1.2-4.4L15.8 5a2.1 2.1 0 0 1 3 3l-9.6 9.6L5 19Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.6"
    />
    <path d="m14.4 6.4 3.2 3.2" stroke="currentColor" strokeWidth="1.6" />
  </Icon>
);

const HighlighterIcon = (): ReactElement => (
  <Icon>
    <path
      d="m7 15 8.8-10 3.2 3.2L9 17H7v-2Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.6"
    />
    <path d="M5 20h14M11 13l3 3" stroke="currentColor" strokeWidth="1.6" />
  </Icon>
);

const UndoIcon = (): ReactElement => (
  <Icon>
    <path
      d="M9 7 5 11l4 4M6 11h7a5 5 0 0 1 5 5v1"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
  </Icon>
);

const ClearIcon = (): ReactElement => (
  <Icon>
    <path
      d="M5 7h14M9 7V4h6v3m2 0-1 13H8L7 7m3 4v5m4-5v5"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
    />
  </Icon>
);

const CloseIcon = (): ReactElement => (
  <Icon>
    <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </Icon>
);

const isUnmodifiedShortcut = (event: ReactKeyboardEvent): boolean =>
  !event.altKey && !event.ctrlKey && !event.metaKey && !event.nativeEvent.isComposing;

/** Owns the high-frequency focus state without reconciling the presentation or command bar. */
export const PresentationFocusTools = ({
  canvas,
  canvasRef,
  position,
  remoteLaser,
}: PresentationFocusToolsProps): ReactElement => {
  const toolbarId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const laserRef = useRef<HTMLButtonElement>(null);
  const penRef = useRef<HTMLButtonElement>(null);
  const highlighterRef = useRef<HTMLButtonElement>(null);
  const [active, setActive] = useState(false);
  const [state, dispatch] = useReducer(
    reducePresentationFocus,
    position,
    createPresentationFocusState,
  );
  const remoteLaserSignal = useSyncExternalStore(
    remoteLaser.subscribe,
    remoteLaser.getSnapshot,
    remoteLaser.getSnapshot,
  );
  const wasActiveRef = useRef(false);

  useEffect(() => {
    if (remoteLaserSignal === undefined) {
      return;
    }
    const window = canvasRef.current?.ownerDocument.defaultView;
    if (window === null || window === undefined) {
      return;
    }
    const timeout = window.setTimeout(() => {
      if (remoteLaser.getSnapshot() === remoteLaserSignal) {
        remoteLaser.set();
      }
    }, REMOTE_LASER_EXPIRY_MS);
    return () => window.clearTimeout(timeout);
  }, [canvasRef, remoteLaser, remoteLaserSignal]);

  useLayoutEffect(() => {
    dispatch({ position, type: "commitPosition" });
  }, [position]);

  const activate = useCallback((tool: PresentationFocusTool): void => {
    dispatch({ tool, type: "selectTool" });
    setActive(true);
  }, []);

  const deactivate = useCallback((): void => {
    setActive(false);
    dispatch({ type: "cancel" });
  }, []);

  const toggleLaser = useCallback((): void => {
    if (active && state.tool === "laser") {
      deactivate();
    } else {
      activate("laser");
    }
  }, [activate, active, deactivate, state.tool]);

  useLayoutEffect(() => {
    if (active) {
      ({ highlighter: highlighterRef, laser: laserRef, pen: penRef })[state.tool].current?.focus();
    } else if (wasActiveRef.current) {
      launcherRef.current?.focus();
    }
    wasActiveRef.current = active;
  }, [active, state.tool]);

  useEffect(() => {
    const document = canvasRef.current?.ownerDocument;
    if (document === undefined) {
      return;
    }
    const listener = (event: KeyboardEvent): void => {
      const Element = document.defaultView?.Element;
      const targetsDialog =
        Element !== undefined &&
        event.target instanceof Element &&
        event.target.closest("dialog") !== null;
      if (event.key === "Escape" && active && !targetsDialog) {
        event.preventDefault();
        deactivate();
        return;
      }
      if (event.key.toLowerCase() !== "l" || !acceptsPresentationShortcut(event)) {
        return;
      }
      event.preventDefault();
      toggleLaser();
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [active, canvasRef, deactivate, toggleLaser]);

  const handleToolbarKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      deactivate();
      return;
    }
    if (event.key.toLowerCase() === "l" && isUnmodifiedShortcut(event) && !event.repeat) {
      event.preventDefault();
      event.stopPropagation();
      toggleLaser();
      return;
    }
    const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : undefined;
    if (direction === undefined) {
      return;
    }
    const buttons = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
    ];
    const current = buttons.indexOf(event.target as HTMLButtonElement);
    const next = buttons.at((current + direction + buttons.length) % buttons.length);
    if (next !== undefined) {
      event.preventDefault();
      next.focus();
    }
  };

  const canClear =
    state.activeStroke !== undefined || state.laser !== undefined || state.strokes.length > 0;
  const canUndo = state.activeStroke !== undefined || state.strokes.length > 0;
  const remoteLaserPoint =
    remoteLaserSignal?.position.slideId === position.slideId &&
    remoteLaserSignal.position.slideIndex === position.slideIndex &&
    remoteLaserSignal.position.step === position.step
      ? remoteLaserSignal.point
      : undefined;

  return (
    <>
      {canvasRef.current === null
        ? null
        : createPortal(
            <PresentationFocusLayer
              active={active}
              canvas={canvas}
              dispatch={dispatch}
              position={position}
              {...(remoteLaserPoint === undefined ? {} : { remoteLaser: remoteLaserPoint })}
              state={state}
            />,
            canvasRef.current,
          )}
      <button
        aria-controls={toolbarId}
        aria-expanded={active}
        aria-label={active ? "Close focus tools" : "Open focus tools"}
        aria-pressed={active}
        onClick={() => (active ? deactivate() : activate(state.tool))}
        onKeyDown={(event) => {
          if (event.key.toLowerCase() !== "l" || !isUnmodifiedShortcut(event) || event.repeat) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          toggleLaser();
        }}
        ref={launcherRef}
        title="Focus tools (L for Laser)"
        type="button"
      >
        <FocusIcon />
      </button>
      {active ? (
        <div
          aria-label="Focus tools"
          className="drever-audience-focus-tools"
          data-drever-focus-tools=""
          id={toolbarId}
          onKeyDown={handleToolbarKeyDown}
          role="toolbar"
        >
          <button
            aria-label="Use laser pointer"
            aria-pressed={state.tool === "laser"}
            onClick={() => activate("laser")}
            ref={laserRef}
            title="Laser pointer (L)"
            type="button"
          >
            <LaserIcon />
            <span>Laser</span>
          </button>
          <button
            aria-label="Use pen"
            aria-pressed={state.tool === "pen"}
            onClick={() => activate("pen")}
            ref={penRef}
            title="Pen"
            type="button"
          >
            <PenIcon />
            <span>Pen</span>
          </button>
          <button
            aria-label="Use highlighter"
            aria-pressed={state.tool === "highlighter"}
            onClick={() => activate("highlighter")}
            ref={highlighterRef}
            title="Highlighter"
            type="button"
          >
            <HighlighterIcon />
            <span>Highlight</span>
          </button>
          <span aria-hidden="true" className="drever-audience-controls__divider" />
          <button
            aria-label="Undo focus stroke"
            disabled={!canUndo}
            onClick={() => dispatch({ type: "undo" })}
            title="Undo"
            type="button"
          >
            <UndoIcon />
          </button>
          <button
            aria-label="Clear focus marks"
            disabled={!canClear}
            onClick={() => dispatch({ type: "clear" })}
            title="Clear"
            type="button"
          >
            <ClearIcon />
          </button>
          <button
            aria-label="Close focus tools"
            onClick={deactivate}
            title="Close focus tools (Escape)"
            type="button"
          >
            <CloseIcon />
          </button>
        </div>
      ) : null}
    </>
  );
};

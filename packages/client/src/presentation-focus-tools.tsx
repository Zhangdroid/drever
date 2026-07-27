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
} from "react";
import { createPortal } from "react-dom";
import { acceptsPresentationShortcut } from "./keyboard.ts";
import {
  ClearIcon,
  CloseIcon,
  FocusIcon,
  HighlighterIcon,
  LaserIcon,
  PenIcon,
  UndoIcon,
} from "./presentation-icons.tsx";
import type { DeckPosition } from "./presentation-state.ts";
import { PresentationFocusLayer } from "./presentation-focus-layer.tsx";
import {
  createPresentationFocusState,
  focusToolForKey,
  reducePresentationFocus,
  type PresentationFocusAppearance,
  type PresentationFocusTool,
} from "./presentation-focus.ts";
import type { PresentationFocusStore } from "./presentation-focus-store.ts";

export type PresentationFocusToolsProps = Readonly<{
  appearance?: PresentationFocusAppearance;
  canvas: CanvasDefinition;
  canvasRef: RefObject<HTMLDivElement | null>;
  onInteractionChange?: (interacting: boolean) => void;
  onPaletteOpenChange?: (open: boolean) => void;
  position: DeckPosition;
  remoteFocus: PresentationFocusStore;
}>;

const REMOTE_LASER_EXPIRY_MS = 1_500;

const isUnmodifiedShortcut = (event: ReactKeyboardEvent): boolean =>
  !event.altKey && !event.ctrlKey && !event.metaKey && !event.nativeEvent.isComposing;

/** Owns the high-frequency focus state without reconciling the presentation or command bar. */
export const PresentationFocusTools = ({
  appearance,
  canvas,
  canvasRef,
  onInteractionChange,
  onPaletteOpenChange,
  position,
  remoteFocus,
}: PresentationFocusToolsProps): ReactElement => {
  const toolbarId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const laserRef = useRef<HTMLButtonElement>(null);
  const penRef = useRef<HTMLButtonElement>(null);
  const highlighterRef = useRef<HTMLButtonElement>(null);
  const [active, setActive] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [state, dispatch] = useReducer(
    reducePresentationFocus,
    position,
    createPresentationFocusState,
  );
  const remoteFocusState = useSyncExternalStore(
    remoteFocus.subscribe,
    remoteFocus.getSnapshot,
    remoteFocus.getSnapshot,
  );
  const wasActiveRef = useRef(false);

  useEffect(() => {
    if (remoteFocusState.laser === undefined) {
      return;
    }
    const window = canvasRef.current?.ownerDocument.defaultView;
    if (window === null || window === undefined) {
      return;
    }
    const timeout = window.setTimeout(() => {
      if (remoteFocus.getSnapshot() === remoteFocusState) {
        remoteFocus.dispatch({ type: "cancel" });
      }
    }, REMOTE_LASER_EXPIRY_MS);
    return () => window.clearTimeout(timeout);
  }, [canvasRef, remoteFocus, remoteFocusState]);

  useLayoutEffect(() => {
    dispatch({ position, type: "commitPosition" });
  }, [position]);

  const updatePalette = useCallback(
    (open: boolean): void => {
      setPaletteOpen(open);
      onPaletteOpenChange?.(open);
    },
    [onPaletteOpenChange],
  );

  useEffect(
    () => () => {
      onPaletteOpenChange?.(false);
    },
    [onPaletteOpenChange],
  );

  const selectTool = useCallback(
    (tool: PresentationFocusTool): void => {
      dispatch({ tool, type: "selectTool" });
      setActive(true);
      updatePalette(false);
    },
    [updatePalette],
  );

  const deactivate = useCallback((): void => {
    setActive(false);
    updatePalette(false);
    dispatch({ type: "cancel" });
    onInteractionChange?.(false);
  }, [onInteractionChange, updatePalette]);

  const togglePalette = useCallback((): void => {
    updatePalette(!paletteOpen);
  }, [paletteOpen, updatePalette]);

  const toggleTool = useCallback(
    (tool: PresentationFocusTool): void => {
      if (active && state.tool === tool) {
        deactivate();
      } else {
        selectTool(tool);
      }
    },
    [active, deactivate, selectTool, state.tool],
  );

  useLayoutEffect(() => {
    if (paletteOpen) {
      ({ highlighter: highlighterRef, laser: laserRef, pen: penRef })[state.tool].current?.focus();
    } else if (!active && wasActiveRef.current) {
      launcherRef.current?.focus();
    }
    wasActiveRef.current = active;
  }, [active, paletteOpen, state.tool]);

  const handleInteractionChange = useCallback(
    (interacting: boolean): void => {
      if (interacting) {
        updatePalette(false);
      }
      onInteractionChange?.(interacting);
    },
    [onInteractionChange, updatePalette],
  );

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
      if (event.key === "Escape" && paletteOpen && !targetsDialog) {
        event.preventDefault();
        updatePalette(false);
        launcherRef.current?.focus();
        return;
      }
      if (event.key === "Escape" && active && !targetsDialog) {
        event.preventDefault();
        deactivate();
        return;
      }
      const tool = focusToolForKey(event.key);
      if (tool === undefined || event.repeat || !acceptsPresentationShortcut(event)) {
        return;
      }
      event.preventDefault();
      toggleTool(tool);
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [active, canvasRef, deactivate, paletteOpen, toggleTool, updatePalette]);

  const handleToolbarKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      updatePalette(false);
      launcherRef.current?.focus();
      return;
    }
    const tool = focusToolForKey(event.key);
    if (tool !== undefined && isUnmodifiedShortcut(event) && !event.repeat) {
      event.preventDefault();
      event.stopPropagation();
      toggleTool(tool);
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
  return (
    <>
      {canvasRef.current === null
        ? null
        : createPortal(
            <PresentationFocusLayer
              active={active && !paletteOpen}
              {...(appearance === undefined ? {} : { appearance })}
              canvas={canvas}
              dispatch={dispatch}
              onInteractionChange={handleInteractionChange}
              position={position}
              remoteState={remoteFocusState}
              state={state}
            />,
            canvasRef.current,
          )}
      <div
        className="drever-audience-focus-anchor"
        data-palette-open={paletteOpen ? "" : undefined}
        dir="ltr"
        lang="en"
      >
        <button
          aria-controls={toolbarId}
          aria-expanded={paletteOpen}
          aria-keyshortcuts="L I H"
          aria-label={paletteOpen ? "Close focus tool picker" : "Open focus tools"}
          aria-pressed={active}
          data-drever-tooltip="Focus tools"
          onClick={togglePalette}
          onKeyDown={(event) => {
            if (event.key === "Escape" && active && !paletteOpen) {
              event.preventDefault();
              event.stopPropagation();
              deactivate();
              return;
            }
            const tool = focusToolForKey(event.key);
            if (tool === undefined || !isUnmodifiedShortcut(event) || event.repeat) {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            toggleTool(tool);
          }}
          ref={launcherRef}
          type="button"
        >
          <FocusIcon />
        </button>
        {paletteOpen ? (
          <div
            aria-label="Focus tools"
            className="drever-audience-focus-tools"
            data-drever-focus-tools=""
            id={toolbarId}
            onKeyDown={handleToolbarKeyDown}
            role="toolbar"
          >
            <button
              aria-keyshortcuts="L"
              aria-label="Use laser pointer"
              aria-pressed={active && state.tool === "laser"}
              data-drever-tooltip="Laser · L"
              onClick={() => toggleTool("laser")}
              ref={laserRef}
              type="button"
            >
              <LaserIcon />
            </button>
            <button
              aria-keyshortcuts="I"
              aria-label="Use pen"
              aria-pressed={active && state.tool === "pen"}
              data-drever-tooltip="Pen · I"
              onClick={() => toggleTool("pen")}
              ref={penRef}
              type="button"
            >
              <PenIcon />
            </button>
            <button
              aria-keyshortcuts="H"
              aria-label="Use highlighter"
              aria-pressed={active && state.tool === "highlighter"}
              data-drever-tooltip="Highlighter · H"
              onClick={() => toggleTool("highlighter")}
              ref={highlighterRef}
              type="button"
            >
              <HighlighterIcon />
            </button>
            <span aria-hidden="true" className="drever-audience-controls__divider" />
            <button
              aria-label="Undo focus stroke"
              data-drever-tooltip="Undo"
              disabled={!canUndo}
              onClick={() => dispatch({ type: "undo" })}
              type="button"
            >
              <UndoIcon />
            </button>
            <button
              aria-label="Clear focus marks"
              data-drever-tooltip="Clear"
              disabled={!canClear}
              onClick={() => dispatch({ type: "clear" })}
              type="button"
            >
              <ClearIcon />
            </button>
            <button
              aria-label="Close focus tools"
              data-drever-tooltip="Close · Esc"
              onClick={deactivate}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
};

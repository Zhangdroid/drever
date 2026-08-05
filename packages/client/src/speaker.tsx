import type { DreverRenderMode, MDXComponents, MDXContent } from "@drever/core";
import type { CanvasDefinition, DeckManifest, PlannedTheme, SlideManifest } from "@drever/schema";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from "react";
import { CanvasViewport, DEFAULT_CANVAS } from "./canvas.tsx";
import { acceptsPresentationShortcut } from "./keyboard.ts";
import { PresentationFocusLayer } from "./presentation-focus-layer.tsx";
import {
  focusToolForKey,
  type PresentationFocusAction,
  type PresentationFocusAppearance,
  type PresentationFocusTool,
} from "./presentation-focus.ts";
import type { PresentationFocusStore } from "./presentation-focus-store.ts";
import {
  AudienceIcon,
  ClearIcon,
  CloseIcon,
  ClockIcon,
  HighlighterIcon,
  LaserIcon,
  NextIcon,
  OverviewIcon,
  PauseIcon,
  PenIcon,
  PlayIcon,
  PreviousIcon,
  ResetIcon,
  UndoIcon,
} from "./presentation-icons.tsx";
import type {
  DeckCommand,
  DeckPosition,
  PresentationStateMachine,
  PresentationStore,
} from "./presentation-state.ts";
import { resolveRehearsalPace, type RehearsalPace, type RehearsalStore } from "./rehearsal.ts";
import type { StageComponents } from "./stage.tsx";
import { Viewer } from "./viewer-surface.tsx";

export type SpeakerProps = Readonly<{
  Content: MDXContent;
  canvas?: CanvasDefinition;
  focus: PresentationFocusStore;
  focusTools?: PresentationFocusAppearance;
  machine: PresentationStateMachine;
  manifest: DeckManifest;
  onFocus(action: PresentationFocusAction): void;
  onNavigate(command: DeckCommand): void | Promise<void>;
  onOpenAudience(): void;
  rehearsal: RehearsalStore;
  registry?: MDXComponents;
  stage?: StageComponents;
  store: PresentationStore;
  theme?: PlannedTheme;
}>;

export const formatSpeakerElapsedTime = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
};

export const nextSpeakerPosition = (
  machine: PresentationStateMachine,
  position: DeckPosition,
): DeckPosition | undefined => machine.transition(position, { type: "next" })?.to;

const positionLabel = (position: DeckPosition): string =>
  `Slide ${position.slideIndex + 1}${position.step === 0 ? "" : ` · Step ${position.step}`}`;

const slideTitle = (slide: SlideManifest): string => slide.title ?? `Slide ${slide.index + 1}`;

export const filterSpeakerSlides = (
  manifest: DeckManifest,
  query: string,
): readonly SlideManifest[] => {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return manifest.slides;
  }
  return Object.freeze(
    manifest.slides.filter(
      (slide) =>
        String(slide.index + 1).includes(needle) ||
        slideTitle(slide).toLowerCase().includes(needle),
    ),
  );
};

const paceLabel = (pace: RehearsalPace): string =>
  ({ ahead: "Ahead", behind: "Behind", "on-pace": "On pace" })[pace];

const durationDateTime = (milliseconds: number): string =>
  `PT${Math.max(0, Math.floor(milliseconds / 1_000))}S`;

const targetMinutes = (milliseconds: number | undefined): string | number =>
  milliseconds === undefined ? "" : milliseconds / 60_000;

const RehearsalPanel = ({
  manifest,
  position,
  rehearsal,
}: Readonly<{
  manifest: DeckManifest;
  position: DeckPosition;
  rehearsal: RehearsalStore;
}>): ReactElement => {
  const snapshot = useSyncExternalStore(
    rehearsal.subscribe,
    rehearsal.getSnapshot,
    rehearsal.getSnapshot,
  );
  const overtime = snapshot.overtimeMs ?? 0;
  const targetValue = overtime > 0 ? overtime : snapshot.remainingMs;
  const targetLabel = overtime > 0 ? "Over" : "Remaining";
  const pace = resolveRehearsalPace(
    manifest,
    position,
    snapshot.elapsedMs,
    snapshot.targetDurationMs,
  );

  return (
    <div
      aria-labelledby="drever-speaker-rehearsal-label"
      className="drever-speaker__timer"
      data-drever-speaker-controls=""
      dir="ltr"
      role="group"
    >
      <span className="drever-visually-hidden" id="drever-speaker-rehearsal-label" lang="en">
        Rehearsal timer
      </span>
      <div className="drever-speaker__metric">
        <span lang="en">Elapsed</span>
        <time data-testid="rehearsal-elapsed" dateTime={durationDateTime(snapshot.elapsedMs)}>
          {formatSpeakerElapsedTime(snapshot.elapsedMs)}
        </time>
      </div>
      <div className="drever-speaker__metric drever-speaker__metric--slide">
        <span lang="en">Current slide</span>
        <time
          data-testid="rehearsal-current-slide"
          dateTime={durationDateTime(snapshot.currentSlideElapsedMs)}
        >
          {formatSpeakerElapsedTime(snapshot.currentSlideElapsedMs)}
        </time>
      </div>
      {targetValue === undefined ? null : (
        <div
          className="drever-speaker__metric drever-speaker__metric--target"
          data-rehearsal-pace={overtime > 0 ? "over" : "remaining"}
        >
          <span lang="en">{targetLabel}</span>
          <time data-testid="rehearsal-pace" dateTime={durationDateTime(targetValue)}>
            {formatSpeakerElapsedTime(targetValue)}
          </time>
        </div>
      )}
      {pace === undefined ? null : (
        <div
          className="drever-speaker__metric drever-speaker__metric--pace"
          data-rehearsal-status={pace}
        >
          <span lang="en">Pace</span>
          <output data-testid="rehearsal-status" lang="en">
            {paceLabel(pace)}
          </output>
        </div>
      )}
      <label className="drever-speaker__target">
        <span lang="en">Target min</span>
        <input
          aria-label="Target duration in minutes"
          data-testid="rehearsal-target"
          lang="en"
          min={Number.MIN_VALUE}
          onChange={(event) => {
            const minutes = event.currentTarget.valueAsNumber;
            rehearsal.setTargetDuration(
              Number.isFinite(minutes) && minutes > 0 ? minutes * 60_000 : undefined,
            );
          }}
          placeholder="—"
          step="any"
          type="number"
          value={targetMinutes(snapshot.targetDurationMs)}
        />
      </label>
      <details className="drever-speaker__timings" data-drever-keyboard="ignore">
        <summary aria-label="Open per-slide timing summary" lang="en">
          <ClockIcon />
          <span>Timings</span>
        </summary>
        <div className="drever-speaker__timings-popover" data-testid="rehearsal-timings">
          <strong lang="en">Per-slide timing</strong>
          <ol>
            {snapshot.slides.map((timing) => {
              const slide = manifest.slides[timing.slideIndex] as SlideManifest;
              return (
                <li
                  data-current={timing.slideId === snapshot.currentSlideId ? "" : undefined}
                  data-slide-id={timing.slideId}
                  key={timing.slideId}
                >
                  <span>
                    <strong dir="auto">
                      {slide.title ?? (
                        <span dir="ltr" lang="en">
                          Slide {timing.slideIndex + 1}
                        </span>
                      )}
                    </strong>
                    <small lang="en">
                      {timing.visits === 0
                        ? "Not visited"
                        : `${timing.visits} ${timing.visits === 1 ? "visit" : "visits"}`}
                    </small>
                  </span>
                  <time dateTime={durationDateTime(timing.elapsedMs)}>
                    {formatSpeakerElapsedTime(timing.elapsedMs)}
                  </time>
                </li>
              );
            })}
          </ol>
        </div>
      </details>
      <button
        className="drever-speaker__rehearsal-toggle"
        lang="en"
        onClick={rehearsal.toggle}
        type="button"
      >
        {snapshot.running ? <PauseIcon /> : <PlayIcon />}
        <span>{snapshot.running ? "Pause" : "Resume"}</span>
      </button>
      <button
        className="drever-speaker__rehearsal-reset"
        lang="en"
        onClick={rehearsal.reset}
        type="button"
      >
        <ResetIcon />
        <span>Reset</span>
      </button>
    </div>
  );
};

const LASER_HEARTBEAT_MS = 500;

const SpeakerFocusLayer = ({
  active,
  appearance,
  canvas,
  focus,
  onFocus,
  position,
}: Readonly<{
  active: boolean;
  appearance?: PresentationFocusAppearance;
  canvas: CanvasDefinition;
  focus: PresentationFocusStore;
  onFocus(action: PresentationFocusAction): void;
  position: DeckPosition;
}>): ReactElement => {
  const state = useSyncExternalStore(focus.subscribe, focus.getSnapshot, focus.getSnapshot);
  const viewportRef = useRef<HTMLDivElement>(null);

  const clear = useCallback((): void => {
    const current = focus.getSnapshot();
    if (current.activeStroke !== undefined || current.laser !== undefined) {
      onFocus({ type: "cancel" });
    }
  }, [focus, onFocus]);

  useEffect(() => {
    focus.dispatch({ position, type: "commitPosition" });
  }, [focus, position]);

  useEffect(() => {
    if (!active || state.tool !== "laser") {
      clear();
      return;
    }
    const window = viewportRef.current?.ownerDocument.defaultView;
    if (window === null || window === undefined) {
      return;
    }
    const document = window.document;
    const clearWhenHidden = (): void => {
      if (document.hidden) {
        clear();
      }
    };
    const heartbeat = window.setInterval(() => {
      const point = focus.getSnapshot().laser;
      if (point !== undefined) {
        onFocus({ point, type: "move" });
      }
    }, LASER_HEARTBEAT_MS);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clearWhenHidden);
    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clearWhenHidden);
      clear();
    };
  }, [active, clear, focus, onFocus, state.tool]);

  return (
    <div
      className="drever-speaker__focus-viewport"
      data-drever-speaker-focus-surface=""
      ref={viewportRef}
    >
      <CanvasViewport canvas={canvas}>
        <PresentationFocusLayer
          active={active}
          {...(appearance === undefined ? {} : { appearance })}
          canvas={canvas}
          dispatch={onFocus}
          position={position}
          state={state}
        />
      </CanvasViewport>
    </div>
  );
};

const Preview = ({
  Content,
  canvas,
  focus,
  focusActive,
  focusTools,
  label,
  manifest,
  onFocus,
  position,
  registry,
  renderMode,
  stage,
  testId,
  theme,
}: Readonly<{
  Content: MDXContent;
  canvas?: CanvasDefinition;
  focus?: PresentationFocusStore;
  focusActive?: boolean;
  focusTools?: PresentationFocusAppearance;
  label: string;
  manifest: DeckManifest;
  onFocus?(action: PresentationFocusAction): void;
  position: DeckPosition;
  registry?: MDXComponents;
  renderMode: DreverRenderMode;
  stage?: StageComponents;
  testId: string;
  theme?: PlannedTheme;
}>): ReactElement => {
  const resolvedCanvas = canvas ?? DEFAULT_CANVAS;
  return (
    <section
      aria-labelledby={`${testId}-label`}
      className="drever-speaker__preview"
      data-testid={testId}
    >
      <span className="drever-speaker__preview-label" dir="ltr" id={`${testId}-label`} lang="en">
        {label}
      </span>
      <div aria-hidden="true" className="drever-speaker__preview-surface" inert>
        <Viewer
          Content={Content}
          {...(canvas === undefined ? {} : { canvas })}
          manifest={manifest}
          manageFocus={false}
          position={position}
          reducedMotion
          {...(registry === undefined ? {} : { registry })}
          renderMode={renderMode}
          {...(stage === undefined ? {} : { stage })}
          {...(theme === undefined ? {} : { theme })}
        />
      </div>
      {focus === undefined || onFocus === undefined ? null : (
        <SpeakerFocusLayer
          active={focusActive ?? false}
          {...(focusTools === undefined ? {} : { appearance: focusTools })}
          canvas={resolvedCanvas}
          focus={focus}
          onFocus={onFocus}
          position={position}
        />
      )}
    </section>
  );
};

export const Speaker = ({
  Content,
  canvas,
  focus,
  focusTools,
  machine,
  manifest,
  onFocus,
  onNavigate,
  onOpenAudience,
  rehearsal,
  registry,
  stage,
  store,
  theme,
}: SpeakerProps): ReactElement => {
  const position = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const focusState = useSyncExternalStore(focus.subscribe, focus.getSnapshot, focus.getSnapshot);
  const navigatorDialogRef = useRef<HTMLDialogElement>(null);
  const navigatorSearchRef = useRef<HTMLInputElement>(null);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [navigatorQuery, setNavigatorQuery] = useState("");
  const [focusActive, setFocusActive] = useState(false);
  const speakerRef = useRef<HTMLDivElement>(null);
  const visibleSlides = useMemo(
    () => filterSpeakerSlides(manifest, navigatorQuery),
    [manifest, navigatorQuery],
  );
  const nextPosition = nextSpeakerPosition(machine, position);
  const slide = manifest.slides[position.slideIndex] as SlideManifest;
  const previousDisabled = machine.transition(position, { type: "previous" }) === undefined;
  const nextDisabled = nextPosition === undefined;
  const canClear =
    focusState.activeStroke !== undefined ||
    focusState.laser !== undefined ||
    focusState.strokes.length > 0;
  const canUndo = focusState.activeStroke !== undefined || focusState.strokes.length > 0;

  const deactivateFocus = useCallback((): void => {
    setFocusActive(false);
    onFocus({ type: "cancel" });
  }, [onFocus]);

  const toggleFocusTool = useCallback(
    (tool: PresentationFocusTool): void => {
      if (focusActive && focus.getSnapshot().tool === tool) {
        deactivateFocus();
        return;
      }
      onFocus({ tool, type: "selectTool" });
      setFocusActive(true);
    },
    [deactivateFocus, focus, focusActive, onFocus],
  );

  const handleFocusToolsKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const tool = focusToolForKey(event.key);
    if (
      tool === undefined ||
      event.repeat ||
      event.defaultPrevented ||
      event.nativeEvent.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    toggleFocusTool(tool);
  };

  useEffect(() => {
    const dialog = navigatorDialogRef.current;
    if (dialog === null) {
      return;
    }
    if (navigatorOpen) {
      if (!dialog.open) {
        dialog.showModal();
        navigatorSearchRef.current?.focus();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [navigatorOpen]);

  useEffect(() => {
    const document = speakerRef.current?.ownerDocument;
    if (document === undefined) {
      return;
    }
    const listener = (event: KeyboardEvent): void => {
      const Element = document.defaultView?.Element;
      const targetsDialog =
        Element !== undefined &&
        event.target instanceof Element &&
        event.target.closest("dialog") !== null;
      if (event.key === "Escape" && focusActive && !targetsDialog) {
        event.preventDefault();
        deactivateFocus();
        return;
      }
      const tool = focusToolForKey(event.key);
      if (tool === undefined || event.repeat || !acceptsPresentationShortcut(event)) {
        return;
      }
      event.preventDefault();
      toggleFocusTool(tool);
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [deactivateFocus, focusActive, toggleFocusTool]);

  const navigate = (command: DeckCommand): void => {
    void onNavigate(command);
  };
  const closeNavigator = (): void => setNavigatorOpen(false);
  const openNavigator = (): void => {
    setNavigatorQuery("");
    setNavigatorOpen(true);
  };
  const jumpToSlide = (target: SlideManifest): void => {
    closeNavigator();
    navigate({ type: "goTo", slideId: target.id });
  };

  return (
    <div className="drever-speaker" data-drever-speaker="" ref={speakerRef}>
      <header className="drever-speaker__header">
        <div className="drever-speaker__brand" dir="ltr" lang="en">
          <strong>Drever</strong>
          <span>Speaker view</span>
        </div>
        <RehearsalPanel manifest={manifest} position={position} rehearsal={rehearsal} />
      </header>

      <main className="drever-speaker__workspace">
        <Preview
          Content={Content}
          {...(canvas === undefined ? {} : { canvas })}
          focus={focus}
          focusActive={focusActive}
          {...(focusTools === undefined ? {} : { focusTools })}
          label={`Current · ${positionLabel(position)}`}
          manifest={manifest}
          onFocus={onFocus}
          position={position}
          {...(registry === undefined ? {} : { registry })}
          renderMode="speaker-current"
          {...(stage === undefined ? {} : { stage })}
          testId="speaker-current"
          {...(theme === undefined ? {} : { theme })}
        />
        {nextPosition === undefined ? (
          <section
            aria-labelledby="speaker-next-label"
            className="drever-speaker__preview drever-speaker__preview--end"
            dir="ltr"
            lang="en"
          >
            <span className="drever-speaker__preview-label" id="speaker-next-label">
              Next
            </span>
            <p>End of presentation</p>
          </section>
        ) : (
          <Preview
            Content={Content}
            {...(canvas === undefined ? {} : { canvas })}
            label={`Next · ${positionLabel(nextPosition)}`}
            manifest={manifest}
            position={nextPosition}
            {...(registry === undefined ? {} : { registry })}
            renderMode="speaker-next"
            {...(stage === undefined ? {} : { stage })}
            testId="speaker-next"
            {...(theme === undefined ? {} : { theme })}
          />
        )}

        <section className="drever-speaker__notes" aria-labelledby="speaker-notes-heading">
          <div className="drever-speaker__notes-heading" dir="ltr" lang="en">
            <span id="speaker-notes-heading">Notes</span>
            <small>{positionLabel(position)}</small>
          </div>
          <div className="drever-speaker__notes-body" data-testid="speaker-notes" tabIndex={0}>
            {slide.speakerNotes.length === 0 ? (
              <p className="drever-speaker__notes-empty" dir="ltr" lang="en">
                No speaker notes for this slide.
              </p>
            ) : (
              slide.speakerNotes.map((note, index) => <p key={index}>{note.plainText}</p>)
            )}
          </div>
        </section>
      </main>

      <footer
        className="drever-speaker__controls"
        data-drever-speaker-controls=""
        dir="ltr"
        lang="en"
      >
        <div className="drever-speaker__progress-group">
          <button
            aria-controls="drever-speaker-slide-dialog"
            aria-expanded={navigatorOpen}
            aria-haspopup="dialog"
            aria-label={`Browse slides, ${positionLabel(position)}, ${position.slideIndex + 1} of ${manifest.slides.length}`}
            className="drever-speaker__progress"
            onClick={openNavigator}
            type="button"
          >
            <OverviewIcon />
            <strong>{positionLabel(position)}</strong>
            <span>
              {position.slideIndex + 1} / {manifest.slides.length} · Browse slides
            </span>
          </button>
          <span
            aria-atomic="true"
            aria-live="polite"
            className="drever-visually-hidden"
            role="status"
          >
            {positionLabel(position)}, {position.slideIndex + 1} of {manifest.slides.length}
          </span>
        </div>
        <div className="drever-speaker__navigation">
          <button
            aria-label="Previous presentation state"
            disabled={previousDisabled}
            onClick={() => navigate({ type: "previous" })}
            type="button"
          >
            <PreviousIcon />
            <span>Previous</span>
          </button>
          <button
            aria-label="Next presentation state"
            className="drever-speaker__next"
            disabled={nextDisabled}
            onClick={() => navigate({ type: "next" })}
            type="button"
          >
            <span>Next</span>
            <NextIcon />
          </button>
        </div>
        <div className="drever-speaker__actions">
          <div
            aria-label="Audience focus tools"
            className="drever-speaker__focus-tools"
            onKeyDown={handleFocusToolsKeyDown}
            role="toolbar"
          >
            <button
              aria-keyshortcuts="L"
              aria-label="Use audience laser pointer"
              aria-pressed={focusActive && focusState.tool === "laser"}
              data-drever-tooltip="Laser · L"
              onClick={() => toggleFocusTool("laser")}
              type="button"
            >
              <LaserIcon />
            </button>
            <button
              aria-keyshortcuts="I"
              aria-label="Use audience pen"
              aria-pressed={focusActive && focusState.tool === "pen"}
              data-drever-tooltip="Pen · I"
              onClick={() => toggleFocusTool("pen")}
              type="button"
            >
              <PenIcon />
            </button>
            <button
              aria-keyshortcuts="H"
              aria-label="Use audience highlighter"
              aria-pressed={focusActive && focusState.tool === "highlighter"}
              data-drever-tooltip="Highlighter · H"
              onClick={() => toggleFocusTool("highlighter")}
              type="button"
            >
              <HighlighterIcon />
            </button>
            <span aria-hidden="true" className="drever-speaker__focus-divider" />
            <button
              aria-label="Undo audience focus stroke"
              data-drever-tooltip="Undo"
              disabled={!canUndo}
              onClick={() => onFocus({ type: "undo" })}
              type="button"
            >
              <UndoIcon />
            </button>
            <button
              aria-label="Clear audience focus marks"
              data-drever-tooltip="Clear"
              disabled={!canClear}
              onClick={() => onFocus({ type: "clear" })}
              type="button"
            >
              <ClearIcon />
            </button>
          </div>
          <button
            aria-label="Open audience"
            className="drever-speaker__audience"
            onClick={onOpenAudience}
            type="button"
          >
            <AudienceIcon />
            <span>Open audience</span>
          </button>
        </div>
      </footer>

      <dialog
        aria-labelledby="drever-speaker-slide-dialog-title"
        className="drever-speaker__slide-dialog"
        id="drever-speaker-slide-dialog"
        onCancel={closeNavigator}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeNavigator();
          }
        }}
        onClose={closeNavigator}
        ref={navigatorDialogRef}
      >
        <div className="drever-speaker__slide-dialog-content">
          <header dir="ltr" lang="en">
            <div>
              <span>Drever speaker</span>
              <h2 id="drever-speaker-slide-dialog-title">Jump to a slide</h2>
            </div>
            <button aria-label="Close slide navigator" onClick={closeNavigator} type="button">
              <CloseIcon />
            </button>
          </header>
          <label className="drever-speaker__slide-search" dir="ltr" lang="en">
            <span className="drever-visually-hidden">Find a slide</span>
            <input
              onChange={(event) => setNavigatorQuery(event.currentTarget.value)}
              placeholder="Find by title or number"
              ref={navigatorSearchRef}
              type="search"
              value={navigatorQuery}
            />
          </label>
          <p
            aria-atomic="true"
            aria-live="polite"
            className="drever-visually-hidden"
            dir="ltr"
            lang="en"
          >
            {visibleSlides.length === 0
              ? "No slides found."
              : `${visibleSlides.length} ${visibleSlides.length === 1 ? "slide" : "slides"} found.`}
          </p>
          <ol className="drever-speaker__slide-results">
            {visibleSlides.map((target) => (
              <li key={target.id}>
                <button
                  aria-current={target.index === position.slideIndex ? "page" : undefined}
                  onClick={() => jumpToSlide(target)}
                  type="button"
                >
                  <span aria-hidden="true">{String(target.index + 1).padStart(2, "0")}</span>
                  <strong aria-hidden="true" dir={target.title === undefined ? "ltr" : "auto"}>
                    {target.title ?? <span lang="en">Slide {target.index + 1}</span>}
                  </strong>
                  {target.index === position.slideIndex ? (
                    <small aria-hidden="true" dir="ltr" lang="en">
                      Current
                    </small>
                  ) : null}
                  <span className="drever-visually-hidden">
                    <span dir="ltr" lang="en">
                      Go to slide {target.index + 1}:{" "}
                    </span>
                    {target.title === undefined ? (
                      <span dir="ltr" lang="en">
                        Slide {target.index + 1}
                      </span>
                    ) : (
                      <span>{target.title}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
            {visibleSlides.length === 0 ? (
              <li className="drever-speaker__slide-empty" dir="ltr" lang="en">
                No slides match “{navigatorQuery}”.
              </li>
            ) : null}
          </ol>
        </div>
      </dialog>
    </div>
  );
};

export type SpeakerHostProps = SpeakerProps & Readonly<{ onMounted(): void }>;

export const SpeakerHost = ({ onMounted, ...props }: SpeakerHostProps): ReactElement => {
  useEffect(onMounted, [onMounted]);
  return <Speaker {...props} />;
};

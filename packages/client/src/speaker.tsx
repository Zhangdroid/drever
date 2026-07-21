import type { DreverRenderMode, MDXComponents, MDXContent } from "@drever/core";
import type { CanvasDefinition, DeckManifest, SlideManifest } from "@drever/schema";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type ReactElement,
} from "react";
import { CanvasViewport, DEFAULT_CANVAS } from "./canvas.tsx";
import { acceptsPresentationShortcut } from "./keyboard.ts";
import { PresentationFocusLayer } from "./presentation-focus-layer.tsx";
import {
  createPresentationFocusState,
  reducePresentationFocus,
  type NormalizedCanvasPoint,
  type PresentationFocusAction,
} from "./presentation-focus.ts";
import type {
  DeckCommand,
  DeckPosition,
  PresentationStateMachine,
  PresentationStore,
} from "./presentation-state.ts";
import { resolveRehearsalPace, type RehearsalPace, type RehearsalStore } from "./rehearsal.ts";
import type { StageComponents } from "./stage.tsx";
import { Viewer } from "./viewer.tsx";

export type SpeakerProps = Readonly<{
  Content: MDXContent;
  canvas?: CanvasDefinition;
  machine: PresentationStateMachine;
  manifest: DeckManifest;
  onLaser(point?: NormalizedCanvasPoint): void;
  onNavigate(command: DeckCommand): void | Promise<void>;
  onOpenAudience(): void;
  rehearsal: RehearsalStore;
  registry?: MDXComponents;
  stage?: StageComponents;
  store: PresentationStore;
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
      aria-label="Rehearsal timer"
      className="drever-speaker__timer"
      data-drever-speaker-controls=""
      role="group"
    >
      <div className="drever-speaker__metric">
        <span>Elapsed</span>
        <time data-testid="rehearsal-elapsed" dateTime={durationDateTime(snapshot.elapsedMs)}>
          {formatSpeakerElapsedTime(snapshot.elapsedMs)}
        </time>
      </div>
      <div className="drever-speaker__metric drever-speaker__metric--slide">
        <span>Current slide</span>
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
          <span>{targetLabel}</span>
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
          <span>Pace</span>
          <output data-testid="rehearsal-status">{paceLabel(pace)}</output>
        </div>
      )}
      <label className="drever-speaker__target">
        <span>Target min</span>
        <input
          aria-label="Target duration in minutes"
          data-testid="rehearsal-target"
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
        <summary aria-label="Open per-slide timing summary">Timings</summary>
        <div className="drever-speaker__timings-popover" data-testid="rehearsal-timings">
          <strong>Per-slide timing</strong>
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
                    <strong>{slide.title ?? `Slide ${timing.slideIndex + 1}`}</strong>
                    <small>
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
      <button onClick={rehearsal.toggle} type="button">
        {snapshot.running ? "Pause" : "Resume"}
      </button>
      <button onClick={rehearsal.reset} type="button">
        Reset
      </button>
    </div>
  );
};

const LASER_HEARTBEAT_MS = 500;

const SpeakerLaserLayer = ({
  active,
  canvas,
  onLaser,
  position,
}: Readonly<{
  active: boolean;
  canvas: CanvasDefinition;
  onLaser(point?: NormalizedCanvasPoint): void;
  position: DeckPosition;
}>): ReactElement => {
  const [state, dispatch] = useReducer(
    reducePresentationFocus,
    position,
    createPresentationFocusState,
  );
  const pointRef = useRef<NormalizedCanvasPoint | undefined>(undefined);
  const viewportRef = useRef<HTMLDivElement>(null);

  const clear = useCallback((): void => {
    dispatch({ type: "cancel" });
    if (pointRef.current !== undefined) {
      pointRef.current = undefined;
      onLaser();
    }
  }, [onLaser]);

  useEffect(() => {
    clear();
    dispatch({ position, type: "commitPosition" });
  }, [clear, position]);

  useEffect(() => {
    if (!active) {
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
      const point = pointRef.current;
      if (point !== undefined) {
        onLaser(point);
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
  }, [active, clear, onLaser]);

  const handleAction = useCallback<Dispatch<PresentationFocusAction>>(
    (action) => {
      dispatch(action);
      if (action.type === "begin" || action.type === "move") {
        pointRef.current = action.point;
        onLaser(action.point);
      } else if (action.type === "cancel" || action.type === "end") {
        clear();
      }
    },
    [clear, onLaser],
  );

  return (
    <div
      className="drever-speaker__laser-viewport"
      data-drever-speaker-laser-surface=""
      ref={viewportRef}
    >
      <CanvasViewport canvas={canvas}>
        <PresentationFocusLayer
          active={active}
          canvas={canvas}
          dispatch={handleAction}
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
  label,
  laserActive,
  manifest,
  onLaser,
  position,
  registry,
  renderMode,
  stage,
  testId,
}: Readonly<{
  Content: MDXContent;
  canvas?: CanvasDefinition;
  label: string;
  laserActive?: boolean;
  manifest: DeckManifest;
  onLaser?(point?: NormalizedCanvasPoint): void;
  position: DeckPosition;
  registry?: MDXComponents;
  renderMode: DreverRenderMode;
  stage?: StageComponents;
  testId: string;
}>): ReactElement => {
  const resolvedCanvas = canvas ?? DEFAULT_CANVAS;
  return (
    <section
      aria-labelledby={`${testId}-label`}
      className="drever-speaker__preview"
      data-testid={testId}
    >
      <span className="drever-speaker__preview-label" id={`${testId}-label`}>
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
        />
      </div>
      {onLaser === undefined ? null : (
        <SpeakerLaserLayer
          active={laserActive ?? false}
          canvas={resolvedCanvas}
          onLaser={onLaser}
          position={position}
        />
      )}
    </section>
  );
};

export const Speaker = ({
  Content,
  canvas,
  machine,
  manifest,
  onLaser,
  onNavigate,
  onOpenAudience,
  rehearsal,
  registry,
  stage,
  store,
}: SpeakerProps): ReactElement => {
  const position = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const navigatorDialogRef = useRef<HTMLDialogElement>(null);
  const navigatorSearchRef = useRef<HTMLInputElement>(null);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [navigatorQuery, setNavigatorQuery] = useState("");
  const [laserActive, setLaserActive] = useState(false);
  const speakerRef = useRef<HTMLDivElement>(null);
  const visibleSlides = useMemo(
    () => filterSpeakerSlides(manifest, navigatorQuery),
    [manifest, navigatorQuery],
  );
  const nextPosition = nextSpeakerPosition(machine, position);
  const slide = manifest.slides[position.slideIndex] as SlideManifest;
  const previousDisabled = machine.transition(position, { type: "previous" }) === undefined;
  const nextDisabled = nextPosition === undefined;

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
      if (event.key.toLowerCase() !== "l" || event.repeat || !acceptsPresentationShortcut(event)) {
        return;
      }
      event.preventDefault();
      setLaserActive((current) => !current);
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);

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
        <div className="drever-speaker__brand">
          <strong>Drever</strong>
          <span>Speaker view</span>
        </div>
        <RehearsalPanel manifest={manifest} position={position} rehearsal={rehearsal} />
      </header>

      <main className="drever-speaker__workspace">
        <Preview
          Content={Content}
          {...(canvas === undefined ? {} : { canvas })}
          label={`Current · ${positionLabel(position)}`}
          laserActive={laserActive}
          manifest={manifest}
          onLaser={onLaser}
          position={position}
          {...(registry === undefined ? {} : { registry })}
          renderMode="speaker-current"
          {...(stage === undefined ? {} : { stage })}
          testId="speaker-current"
        />
        {nextPosition === undefined ? (
          <section
            aria-labelledby="speaker-next-label"
            className="drever-speaker__preview drever-speaker__preview--end"
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
          />
        )}

        <section className="drever-speaker__notes" aria-labelledby="speaker-notes-heading">
          <div className="drever-speaker__notes-heading">
            <span id="speaker-notes-heading">Notes</span>
            <small>{positionLabel(position)}</small>
          </div>
          <div className="drever-speaker__notes-body" data-testid="speaker-notes" tabIndex={0}>
            {slide.speakerNotes.length === 0 ? (
              <p className="drever-speaker__notes-empty">No speaker notes for this slide.</p>
            ) : (
              slide.speakerNotes.map((note, index) => <p key={index}>{note.plainText}</p>)
            )}
          </div>
        </section>
      </main>

      <footer className="drever-speaker__controls" data-drever-speaker-controls="">
        <div className="drever-speaker__progress-group">
          <button
            aria-controls="drever-speaker-slide-dialog"
            aria-expanded={navigatorOpen}
            aria-haspopup="dialog"
            className="drever-speaker__progress"
            onClick={openNavigator}
            type="button"
          >
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
            ← Previous
          </button>
          <button
            aria-label="Next presentation state"
            className="drever-speaker__next"
            disabled={nextDisabled}
            onClick={() => navigate({ type: "next" })}
            type="button"
          >
            Next →
          </button>
        </div>
        <div className="drever-speaker__actions">
          <button
            aria-label={laserActive ? "Disable audience laser" : "Enable audience laser"}
            aria-pressed={laserActive}
            className="drever-speaker__laser-toggle"
            onClick={() => setLaserActive((current) => !current)}
            title="Audience laser (L)"
            type="button"
          >
            Laser
          </button>
          <button
            aria-label="Open audience"
            className="drever-speaker__audience"
            onClick={onOpenAudience}
            type="button"
          >
            <span>Open audience</span>
            <span aria-hidden="true">↗</span>
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
          <header>
            <div>
              <span>Drever speaker</span>
              <h2 id="drever-speaker-slide-dialog-title">Jump to a slide</h2>
            </div>
            <button aria-label="Close slide navigator" onClick={closeNavigator} type="button">
              ×
            </button>
          </header>
          <label className="drever-speaker__slide-search">
            <span className="drever-visually-hidden">Find a slide</span>
            <input
              onChange={(event) => setNavigatorQuery(event.currentTarget.value)}
              placeholder="Find by title or number"
              ref={navigatorSearchRef}
              type="search"
              value={navigatorQuery}
            />
          </label>
          <p aria-atomic="true" aria-live="polite" className="drever-visually-hidden">
            {visibleSlides.length === 0
              ? "No slides found."
              : `${visibleSlides.length} ${visibleSlides.length === 1 ? "slide" : "slides"} found.`}
          </p>
          <ol className="drever-speaker__slide-results">
            {visibleSlides.map((target) => (
              <li key={target.id}>
                <button
                  aria-current={target.index === position.slideIndex ? "page" : undefined}
                  aria-label={`Go to slide ${target.index + 1}: ${slideTitle(target)}`}
                  onClick={() => jumpToSlide(target)}
                  type="button"
                >
                  <span>{String(target.index + 1).padStart(2, "0")}</span>
                  <strong>{slideTitle(target)}</strong>
                  {target.index === position.slideIndex ? <small>Current</small> : null}
                </button>
              </li>
            ))}
            {visibleSlides.length === 0 ? (
              <li className="drever-speaker__slide-empty">No slides match “{navigatorQuery}”.</li>
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

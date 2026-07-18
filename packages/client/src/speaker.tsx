import type { DreverRenderMode, MDXComponents, MDXContent } from "@drever/core";
import type { CanvasDefinition, DeckManifest, SlideManifest } from "@drever/schema";
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactElement } from "react";
import type {
  DeckCommand,
  DeckPosition,
  PresentationStateMachine,
  PresentationStore,
} from "./presentation-state.ts";
import { Viewer } from "./viewer.tsx";

export type SpeakerProps = Readonly<{
  Content: MDXContent;
  canvas?: CanvasDefinition;
  machine: PresentationStateMachine;
  manifest: DeckManifest;
  onNavigate(command: DeckCommand): void | Promise<void>;
  onOpenAudience(): void;
  registry?: MDXComponents;
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

type TimerState = Readonly<{
  accumulated: number;
  running: boolean;
  startedAt: number;
}>;

const useSpeakerTimer = (): Readonly<{
  elapsed: string;
  reset(): void;
  running: boolean;
  toggle(): void;
}> => {
  const [clock, setClock] = useState(Date.now);
  const [timer, setTimer] = useState<TimerState>(() => ({
    accumulated: 0,
    running: true,
    startedAt: Date.now(),
  }));

  useEffect(() => {
    if (!timer.running) {
      return;
    }
    const interval = globalThis.setInterval(() => setClock(Date.now()), 500);
    return () => globalThis.clearInterval(interval);
  }, [timer.running]);

  const reset = useCallback(() => {
    const now = Date.now();
    setClock(now);
    setTimer((current) => ({ accumulated: 0, running: current.running, startedAt: now }));
  }, []);
  const toggle = useCallback(() => {
    const now = Date.now();
    setClock(now);
    setTimer((current) =>
      current.running
        ? {
            accumulated: current.accumulated + (now - current.startedAt),
            running: false,
            startedAt: now,
          }
        : { ...current, running: true, startedAt: now },
    );
  }, []);
  const milliseconds =
    timer.accumulated + (timer.running ? Math.max(0, clock - timer.startedAt) : 0);
  return Object.freeze({
    elapsed: formatSpeakerElapsedTime(milliseconds),
    reset,
    running: timer.running,
    toggle,
  });
};

const Preview = ({
  Content,
  canvas,
  label,
  position,
  registry,
  renderMode,
  testId,
}: Readonly<{
  Content: MDXContent;
  canvas?: CanvasDefinition;
  label: string;
  position: DeckPosition;
  registry?: MDXComponents;
  renderMode: DreverRenderMode;
  testId: string;
}>): ReactElement => (
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
        manageFocus={false}
        position={position}
        reducedMotion
        {...(registry === undefined ? {} : { registry })}
        renderMode={renderMode}
      />
    </div>
  </section>
);

export const Speaker = ({
  Content,
  canvas,
  machine,
  manifest,
  onNavigate,
  onOpenAudience,
  registry,
  store,
}: SpeakerProps): ReactElement => {
  const position = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const nextPosition = nextSpeakerPosition(machine, position);
  const slide = manifest.slides[position.slideIndex] as SlideManifest;
  const timer = useSpeakerTimer();
  const previousDisabled = machine.transition(position, { type: "previous" }) === undefined;
  const nextDisabled = nextPosition === undefined;

  const navigate = (command: DeckCommand): void => {
    void onNavigate(command);
  };

  return (
    <div className="drever-speaker" data-drever-speaker="">
      <header className="drever-speaker__header">
        <div>
          <strong>Drever</strong>
          <span>Speaker view</span>
        </div>
        <div
          aria-label="Presentation timer"
          className="drever-speaker__timer"
          data-drever-speaker-controls=""
          role="group"
        >
          <time>{timer.elapsed}</time>
          <button onClick={timer.toggle} type="button">
            {timer.running ? "Pause" : "Resume"}
          </button>
          <button onClick={timer.reset} type="button">
            Reset
          </button>
        </div>
      </header>

      <main className="drever-speaker__workspace">
        <Preview
          Content={Content}
          {...(canvas === undefined ? {} : { canvas })}
          label={`Current · ${positionLabel(position)}`}
          position={position}
          {...(registry === undefined ? {} : { registry })}
          renderMode="speaker-current"
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
            position={nextPosition}
            {...(registry === undefined ? {} : { registry })}
            renderMode="speaker-next"
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
        <div
          aria-atomic="true"
          aria-live="polite"
          className="drever-speaker__progress"
          role="status"
        >
          <strong>{positionLabel(position)}</strong>
          <span>
            {position.slideIndex + 1} / {manifest.slides.length}
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
        <button className="drever-speaker__audience" onClick={onOpenAudience} type="button">
          Open audience ↗
        </button>
      </footer>
    </div>
  );
};

export type SpeakerHostProps = SpeakerProps & Readonly<{ onMounted(): void }>;

export const SpeakerHost = ({ onMounted, ...props }: SpeakerHostProps): ReactElement => {
  useEffect(onMounted, [onMounted]);
  return <Speaker {...props} />;
};

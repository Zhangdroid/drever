import type { DreverRenderMode, MDXComponents, MDXContent } from "@drever/core";
import type { CanvasDefinition, DeckManifest, SlideManifest } from "@drever/schema";
import { useEffect, useSyncExternalStore, type ReactElement } from "react";
import type {
  DeckCommand,
  DeckPosition,
  PresentationStateMachine,
  PresentationStore,
} from "./presentation-state.ts";
import type { RehearsalStore } from "./rehearsal.ts";
import { Viewer } from "./viewer.tsx";

export type SpeakerProps = Readonly<{
  Content: MDXContent;
  canvas?: CanvasDefinition;
  machine: PresentationStateMachine;
  manifest: DeckManifest;
  onNavigate(command: DeckCommand): void | Promise<void>;
  onOpenAudience(): void;
  rehearsal: RehearsalStore;
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

const durationDateTime = (milliseconds: number): string =>
  `PT${Math.max(0, Math.floor(milliseconds / 1_000))}S`;

const targetMinutes = (milliseconds: number | undefined): string | number =>
  milliseconds === undefined ? "" : milliseconds / 60_000;

const RehearsalPanel = ({
  manifest,
  rehearsal,
}: Readonly<{ manifest: DeckManifest; rehearsal: RehearsalStore }>): ReactElement => {
  const snapshot = useSyncExternalStore(
    rehearsal.subscribe,
    rehearsal.getSnapshot,
    rehearsal.getSnapshot,
  );
  const overtime = snapshot.overtimeMs ?? 0;
  const targetValue = overtime > 0 ? overtime : snapshot.remainingMs;
  const targetLabel = overtime > 0 ? "Over" : "Remaining";

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
          className="drever-speaker__metric"
          data-rehearsal-pace={overtime > 0 ? "over" : "remaining"}
        >
          <span>{targetLabel}</span>
          <time data-testid="rehearsal-pace" dateTime={durationDateTime(targetValue)}>
            {formatSpeakerElapsedTime(targetValue)}
          </time>
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
  rehearsal,
  registry,
  store,
}: SpeakerProps): ReactElement => {
  const position = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const nextPosition = nextSpeakerPosition(machine, position);
  const slide = manifest.slides[position.slideIndex] as SlideManifest;
  const previousDisabled = machine.transition(position, { type: "previous" }) === undefined;
  const nextDisabled = nextPosition === undefined;

  const navigate = (command: DeckCommand): void => {
    void onNavigate(command);
  };

  return (
    <div className="drever-speaker" data-drever-speaker="">
      <header className="drever-speaker__header">
        <div className="drever-speaker__brand">
          <strong>Drever</strong>
          <span>Speaker view</span>
        </div>
        <RehearsalPanel manifest={manifest} rehearsal={rehearsal} />
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

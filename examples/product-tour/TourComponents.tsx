import { MotionGroup } from "@drever/core";
import { selectAudienceSignal, useAudienceSignal, type SignalId } from "./audience-signal.js";
import { useId, type PropsWithChildren, type ReactElement } from "react";

const SIGNALS = [
  {
    id: "risk",
    label: "Show the risk",
    response: "Start with the concern.",
    guidance: "Name what could stop the launch before asking for approval.",
  },
  {
    id: "evidence",
    label: "Show the evidence",
    response: "Bring in the proof.",
    guidance: "Reveal the pilot result while the decision is still in front of the room.",
  },
  {
    id: "explore",
    label: "Let me try",
    response: "Hand over control.",
    guidance: "Let the room inspect the launch experience before adding another claim.",
  },
] as const;

type Signal = (typeof SIGNALS)[number];

const resolveSignal = (id: SignalId | undefined): Signal =>
  SIGNALS.find((signal) => signal.id === id) ?? SIGNALS[1];

/** A live audience choice that can influence later authored React. */
export const AudienceSignal = (): ReactElement => {
  const titleId = useId();
  const signalId = useAudienceSignal();
  const signal = signalId === undefined ? undefined : resolveSignal(signalId);

  return (
    <section className="tour-signal" aria-labelledby={titleId}>
      <div className="tour-signal__prompt">
        <span className="tour-kicker">The room · one choice</span>
        <h3 id={titleId}>What would help you decide?</h3>
        <div className="tour-signal__choices" role="group" aria-label="Audience response">
          {SIGNALS.map((candidate) => (
            <button
              key={candidate.id}
              aria-pressed={signalId === candidate.id}
              className="tour-signal__choice"
              data-signal={candidate.id}
              onClick={() => selectAudienceSignal(candidate.id)}
              type="button"
            >
              <span>{candidate.label}</span>
              <span aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
      </div>

      <div
        className="tour-signal__result"
        data-signal={signal?.id ?? "idle"}
        role="status"
        aria-live="polite"
      >
        <span className="tour-signal__result-index">
          {signal === undefined ? "Waiting for the room" : `Selected · ${signal.label}`}
        </span>
        <strong>{signal?.response ?? "The next beat is still open."}</strong>
        <p>
          {signal?.guidance ?? "Choose the evidence the room needs—not the next slide in a file."}
        </p>
      </div>
    </section>
  );
};

/** The concrete result that travels through the audience, speaker, link, and document surfaces. */
export const DecisionProof = (): ReactElement => (
  <article className="tour-proof" data-testid="decision-proof">
    <header>
      <span>Pilot evidence</span>
      <span className="tour-proof__confidence">
        <i aria-hidden="true" />
        High confidence
      </span>
    </header>
    <div className="tour-proof__metric">
      <strong>96%</strong>
      <p>completed setup without support</p>
    </div>
    <footer>
      <span>48 of 50 people</span>
      <span>Illustrative scenario</span>
    </footer>
  </article>
);

/** A sparse, abstract model of a room signal becoming a change in the story. */
export const RoomResponse = ({
  phase = "opening",
}: Readonly<{ phase?: "closing" | "opening" }>): ReactElement => (
  <div className="tour-room-response" data-phase={phase} aria-hidden="true">
    <div className="tour-room-response__room">
      <span />
      <span />
      <span />
      <span />
      <span />
      <i />
    </div>
    <div className="tour-room-response__thread">
      <span />
      <i />
    </div>
    <div className="tour-room-response__story">
      <span />
      <span />
      <span />
    </div>
    <small>room</small>
    <small>story</small>
  </div>
);

/** A drafted route with one deliberate, human-directed beat. */
export const StoryRoute = ({ children }: PropsWithChildren): ReactElement => (
  <section className="tour-route" aria-label="A drafted story route revised by its presenter">
    <div className="tour-route__direction">
      <span className="tour-kicker">Your direction</span>
      <strong>Ask before proof.</strong>
      <p>The audience should decide what the story needs next.</p>
    </div>
    <div className="tour-route__path">
      <div className="tour-route__row">
        <span>01</span>
        <strong>Name the decision</strong>
        <small>Drafted by AI</small>
      </div>
      <MotionGroup flow="block" intent="focus">
        {children}
      </MotionGroup>
      <div className="tour-route__row">
        <span>03</span>
        <strong>Reveal the proof</strong>
        <small>When it helps</small>
      </div>
      <div className="tour-route__row">
        <span>04</span>
        <strong>Leave a next move</strong>
        <small>Keep it useful</small>
      </div>
    </div>
  </section>
);

/** The room's choice becomes a stable, addressable presentation state. */
export const SignalOutcome = ({ children }: PropsWithChildren): ReactElement => {
  const signal = resolveSignal(useAudienceSignal());

  return (
    <section className="tour-outcome" data-signal={signal.id}>
      <div className="tour-outcome__copy">
        <span className="tour-kicker">The story follows the room</span>
        <h2>{signal.response}</h2>
        <p>{signal.guidance}</p>
        <MotionGroup className="tour-outcome__beats" flow="block" intent="focus">
          {children}
        </MotionGroup>
      </div>
      <div className="tour-outcome__proof-slot">
        <span aria-hidden="true">Evidence waits until it can change the decision.</span>
      </div>
    </section>
  );
};

/** The single authored story that remains stable while its useful surfaces appear. */
export const StoryCore = (): ReactElement => (
  <article className="tour-story-core" data-testid="story-core">
    <span>Drever story</span>
    <strong>Launch pilot</strong>
    <p>Content, interaction, notes, and design—together and editable.</p>
    <footer>
      <i aria-hidden="true" />
      Ready to present
    </footer>
  </article>
);

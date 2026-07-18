import { useId, useState, type ReactElement } from "react";

const SIGNALS = [
  {
    id: "aligned",
    label: "Aligned",
    pulse: "82%",
    response: "Advance the story",
    guidance: "The room has the model. Move from explanation to decision.",
  },
  {
    id: "uncertain",
    label: "Uncertain",
    pulse: "51%",
    response: "Reveal one example",
    guidance: "Keep the claim. Add evidence at the moment it becomes useful.",
  },
  {
    id: "challenging",
    label: "Challenging",
    pulse: "24%",
    response: "Open the system",
    guidance: "Let the audience inspect or change the model instead of adding bullets.",
  },
] as const;

type Signal = (typeof SIGNALS)[number];

/** A small proof that a slide can respond to the room and retain local state. */
export const AudienceSignal = (): ReactElement => {
  const titleId = useId();
  const [signal, setSignal] = useState<Signal>(SIGNALS[1]);

  return (
    <section className="tour-signal" aria-labelledby={titleId}>
      <div className="tour-signal__prompt">
        <span className="tour-kicker">Live audience signal</span>
        <h3 id={titleId}>Where is the room?</h3>
        <div className="tour-signal__choices" role="group" aria-label="Audience response">
          {SIGNALS.map((candidate) => (
            <button
              key={candidate.id}
              aria-pressed={signal.id === candidate.id}
              className="tour-signal__choice"
              data-signal={candidate.id}
              onClick={() => setSignal(candidate)}
              type="button"
            >
              {candidate.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tour-signal__result" data-signal={signal.id} role="status" aria-live="polite">
        <div className="tour-signal__meter" aria-hidden="true">
          <span style={{ inlineSize: signal.pulse }} />
        </div>
        <span className="tour-signal__score">Signal confidence · {signal.pulse}</span>
        <strong>{signal.response}</strong>
        <p>{signal.guidance}</p>
      </div>
    </section>
  );
};

const MOMENTS = [
  {
    label: "Claim",
    detail: "A presentation can be a living interface.",
  },
  {
    label: "Proof",
    detail: "This panel changes. The surrounding stage stays still.",
  },
  {
    label: "Meaning",
    detail: "Motion explains continuity instead of decorating a cut.",
  },
] as const;

/** An interactive diagram of the canvas boundary used by Drever transitions. */
export const MotionBoundary = (): ReactElement => {
  const stateId = useId();
  const [moment, setMoment] = useState(0);
  const activeMoment = MOMENTS[moment] ?? MOMENTS[0];

  return (
    <section className="tour-motion" aria-label="Element-scoped motion diagram">
      <div className="tour-motion__stage">
        <span className="tour-motion__stage-label">Browser stage · stable</span>
        <div
          className="tour-motion__canvas"
          data-moment={moment}
          id={stateId}
          role="status"
          aria-atomic="true"
          aria-live="polite"
        >
          <span className="tour-kicker">Canvas transition boundary</span>
          <strong>{activeMoment.label}</strong>
          <p>{activeMoment.detail}</p>
          <div className="tour-motion__progress" aria-hidden="true">
            {MOMENTS.map((candidate, index) => (
              <span key={candidate.label} data-active={index === moment} />
            ))}
          </div>
        </div>
      </div>
      <button
        aria-describedby={stateId}
        className="tour-motion__button"
        onClick={() => setMoment((current) => (current + 1) % MOMENTS.length)}
        type="button"
      >
        Change the moment
      </button>
    </section>
  );
};

export type MomentCardProps = Readonly<{
  detail: string;
  index: string;
  title: string;
}>;

export const MomentCard = ({ detail, index, title }: MomentCardProps): ReactElement => (
  <article className="tour-moment">
    <span>{index}</span>
    <div>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  </article>
);

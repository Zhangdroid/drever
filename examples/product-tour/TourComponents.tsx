import { useId, useState, type ReactElement } from "react";

const SIGNALS = [
  {
    id: "aligned",
    label: "Aligned",
    response: "Advance the story",
    guidance: "The room has the model. Move from explanation to decision.",
  },
  {
    id: "uncertain",
    label: "Uncertain",
    response: "Reveal one example",
    guidance: "Keep the claim. Add evidence at the moment it becomes useful.",
  },
  {
    id: "challenging",
    label: "Challenging",
    response: "Open the system",
    guidance: "Let the audience inspect or change the model instead of adding bullets.",
  },
] as const;

type Signal = (typeof SIGNALS)[number];

/** A small proof that authored React can respond to the room and retain local state. */
export const AudienceSignal = (): ReactElement => {
  const titleId = useId();
  const [signal, setSignal] = useState<Signal>(SIGNALS[1]);

  return (
    <section className="tour-signal" aria-labelledby={titleId}>
      <div className="tour-signal__prompt">
        <span className="tour-kicker">Your component · live state</span>
        <h3 id={titleId}>Where is the room now?</h3>
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
        <span className="tour-signal__score">Selected · {signal.label}</span>
        <strong>{signal.response}</strong>
        <p>{signal.guidance}</p>
      </div>
    </section>
  );
};

const MOMENTS = [
  {
    label: "Claim",
    detail: "A strong story begins with one stable belief.",
  },
  {
    label: "Proof",
    detail: "Only this idea changes. The surrounding stage keeps its place.",
  },
  {
    label: "Meaning",
    detail: "The room follows the thought instead of watching an effect.",
  },
] as const;

/** An interactive example of motion following a changing thought. */
export const MotionBoundary = (): ReactElement => {
  const stateId = useId();
  const [moment, setMoment] = useState(0);
  const activeMoment = MOMENTS[moment] ?? MOMENTS[0];

  return (
    <section className="tour-motion" aria-label="Story moment motion example">
      <div className="tour-motion__stage">
        <span className="tour-motion__stage-label">Stage · stays still</span>
        <div
          className="tour-motion__canvas"
          data-moment={moment}
          id={stateId}
          role="status"
          aria-atomic="true"
          aria-live="polite"
        >
          <span className="tour-kicker">The moment that changed</span>
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

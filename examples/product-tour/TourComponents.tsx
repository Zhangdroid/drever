import { useId, useState, type ReactElement } from "react";

const SIGNALS = [
  {
    id: "example",
    label: "Show an example",
    response: "Make it concrete.",
    guidance: "Reveal one example, right when it can make the idea click.",
  },
  {
    id: "evidence",
    label: "Show the evidence",
    response: "Bring in the proof.",
    guidance: "Move from claim to evidence without leaving the story.",
  },
  {
    id: "explore",
    label: "Let me try",
    response: "Hand over control.",
    guidance: "Let people explore the idea for themselves instead of adding another bullet.",
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
        <span className="tour-kicker">The room · one choice</span>
        <h3 id={titleId}>What would help you decide?</h3>
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
    label: "Assumption",
    detail: "A presentation explains the idea.",
  },
  {
    label: "Evidence",
    detail: "This presentation lets the room try it.",
  },
  {
    label: "Decision",
    detail: "The experience becomes the proof.",
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
          <span className="tour-kicker">Only the changed idea</span>
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
        Change the idea
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

import { useId, useState, type ReactElement } from "react";

const SIGNALS = [
  {
    id: "risk",
    label: "Show the risk",
    response: "Name the concern.",
    guidance: "Start with what could stop the launch before asking for approval.",
  },
  {
    id: "evidence",
    label: "Show the evidence",
    response: "Bring in the proof.",
    guidance: "Reveal the pilot result without leaving the decision in front of the room.",
  },
  {
    id: "explore",
    label: "Let me try",
    response: "Hand over control.",
    guidance: "Let people inspect the launch experience instead of adding another claim.",
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
    label: "Question",
    detail: "What would make this launch feel safe?",
  },
  {
    label: "Evidence",
    detail: "96% of pilot teams completed setup without support.",
  },
  {
    label: "Decision",
    detail: "Approve the launch pilot for all three teams.",
  },
] as const;

/** An interactive example of motion following a changing thought. */
export const MotionBoundary = (): ReactElement => {
  const stateId = useId();
  const [hasAdvanced, setHasAdvanced] = useState(false);
  const [moment, setMoment] = useState(0);
  const activeMoment = MOMENTS[moment] ?? MOMENTS[0];

  const advance = (): void => {
    setHasAdvanced(true);
    setMoment((current) => (current + 1) % MOMENTS.length);
  };

  return (
    <section className="tour-motion" aria-label="Story moment motion example">
      <div className="tour-motion__stage">
        <span className="tour-motion__stage-label">Stage · stays still</span>
        <div
          className="tour-motion__canvas"
          data-animate={hasAdvanced ? "true" : "false"}
          data-moment={moment}
          id={stateId}
          role="status"
          aria-atomic="true"
          aria-live="polite"
        >
          <div className="tour-motion__thought" key={activeMoment.label}>
            <span className="tour-kicker">Only the changed idea</span>
            <strong>{activeMoment.label}</strong>
            <p>{activeMoment.detail}</p>
          </div>
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
        onClick={advance}
        type="button"
      >
        Show next moment
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

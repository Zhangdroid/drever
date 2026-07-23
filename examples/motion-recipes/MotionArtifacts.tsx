import { motion, useReducedMotion } from "motion/react";
import { useId, useState, type CSSProperties, type ReactElement } from "react";

const EVIDENCE = [
  {
    detail: "31% fewer teams stopped during setup after the guided first run.",
    label: "Setup completion",
    metric: "96%",
  },
  {
    detail: "The same three questions accounted for most requests before the change.",
    label: "Support pattern",
    metric: "3",
  },
] as const;

export type BrowserFrameProps = Readonly<{
  interactive?: boolean;
}>;

/** A stable browser artifact whose evidence can be inspected without moving the frame. */
export function BrowserFrame({ interactive = false }: BrowserFrameProps): ReactElement {
  const labelId = useId();
  const [activeEvidence, setActiveEvidence] = useState(0);
  const evidence = EVIDENCE[activeEvidence] ?? EVIDENCE[0];

  return (
    <section
      aria-labelledby={labelId}
      className="story-browser__frame"
      data-interactive={interactive}
    >
      <header className="story-browser__chrome" aria-hidden="true">
        <span />
        <span />
        <span />
        <i>yourdeck.dev/pilot</i>
      </header>
      <div className="story-browser__body">
        <nav aria-label="Demo sections">
          <strong>Launch room</strong>
          <span data-active="">Overview</span>
          <span>Sessions</span>
          <span>Questions</span>
        </nav>
        <div className="story-browser__content">
          <header>
            <span>Pilot evidence</span>
            <h3 id={labelId}>The first run became the proof.</h3>
          </header>
          <div className="story-browser__chart" aria-hidden="true">
            <i style={{ "--bar": "42%" } as CSSProperties} />
            <i style={{ "--bar": "58%" } as CSSProperties} />
            <i style={{ "--bar": "74%" } as CSSProperties} />
            <i data-current="" style={{ "--bar": "96%" } as CSSProperties} />
          </div>
          <div className="story-browser__evidence" role="status" aria-live="polite">
            <span>{evidence.label}</span>
            <strong>{evidence.metric}</strong>
            <p>{evidence.detail}</p>
          </div>
          <div className="story-browser__choices" role="group" aria-label="Evidence view">
            {EVIDENCE.map((candidate, index) => (
              <button
                key={candidate.label}
                aria-pressed={activeEvidence === index}
                disabled={!interactive}
                onClick={() => setActiveEvidence(index)}
                type="button"
              >
                {candidate.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** A deliberate reveal for information that was genuinely unavailable before. */
export function EvidenceReveal(): ReactElement {
  const [revealed, setRevealed] = useState(false);

  return (
    <section className="evidence-reveal" data-revealed={revealed}>
      <span className="motion-kicker">Interview 12 · recurring signal</span>
      <blockquote>
        “Teams did not need more features. They needed{" "}
        <span className="evidence-reveal__finding">
          <span aria-hidden={!revealed}>a first decision they could trust.</span>
          <i aria-hidden="true">████ █████ ████████ ████ █████ █████</i>
        </span>
        ”
      </blockquote>
      <button onClick={() => setRevealed((current) => !current)} type="button">
        {revealed ? "Hide the finding" : "Reveal the finding"}
      </button>
    </section>
  );
}

/** A real third-party integration kept local to the one idea it helps explain. */
export function MotionEvidence(): ReactElement {
  const [guided, setGuided] = useState(false);
  const reduceMotion = useReducedMotion();
  const values = guided ? [64, 78, 91, 96] : [28, 34, 38, 42];

  return (
    <section className="motion-evidence">
      <header>
        <span className="motion-kicker">Setup completion</span>
        <strong aria-live="polite">{guided ? "96%" : "42%"}</strong>
        <p>{guided ? "After the guided first run" : "Before the guided first run"}</p>
      </header>
      <div className="motion-evidence__bars" aria-hidden="true">
        {values.map((value, index) => (
          <motion.i
            animate={{ height: `${value}%` }}
            initial={false}
            key={index}
            transition={{
              delay: reduceMotion ? 0 : index * 0.045,
              duration: reduceMotion ? 0 : 0.52,
              ease: [0.16, 1, 0.3, 1],
            }}
          />
        ))}
      </div>
      <button aria-pressed={guided} onClick={() => setGuided((current) => !current)} type="button">
        {guided ? "Show the baseline" : "Apply the guided run"}
      </button>
      <small>Motion for React animates the evidence. Drever still owns the slide.</small>
    </section>
  );
}

/** An original fixed-slot word correction; animated copies remain presentation-only. */
export function SemanticCorrection(): ReactElement {
  return (
    <p className="semantic-correction" aria-label="Motion should explain the change.">
      <span aria-hidden="true">
        Motion should
        <span className="semantic-correction__slot">
          <span data-word="old">decorate everything.</span>
          <span data-word="new">explain the change.</span>
        </span>
      </span>
      <span className="motion-sr-only">Motion should explain the change.</span>
    </p>
  );
}

/** A small keyboard-accessible proxy for a state-driven 3D scene boundary. */
export function SpatialModel(): ReactElement {
  const descriptionId = useId();
  const [open, setOpen] = useState(false);

  return (
    <section className="spatial-model" data-open={open}>
      <div className="spatial-model__viewport" aria-hidden="true">
        <div className="spatial-model__object">
          <span data-layer="outer" />
          <span data-layer="middle" />
          <span data-layer="core" />
        </div>
        <i>One scene · two meaningful states</i>
      </div>
      <div className="spatial-model__copy">
        <span>Spatial explanation</span>
        <strong>
          {open ? "The hidden dependency is now visible." : "Start with the whole system."}
        </strong>
        <p id={descriptionId}>
          {open
            ? "Separate only the layer the audience needs to inspect."
            : "Depth earns its cost when structure is the subject."}
        </p>
        <button
          aria-describedby={descriptionId}
          aria-pressed={open}
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          {open ? "Return to whole" : "Reveal the inner layer"}
        </button>
      </div>
    </section>
  );
}

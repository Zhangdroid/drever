import { motion, useReducedMotion } from "motion/react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PropsWithChildren,
  type ReactElement,
} from "react";

const METRIC_FRAMES = [
  { bars: [28, 34, 38, 42], label: "Baseline", metric: 42 },
  { bars: [38, 49, 54, 61], label: "First guided run", metric: 61 },
  { bars: [44, 61, 69, 76], label: "Second session", metric: 76 },
  { bars: [32, 43, 48, 54], label: "New cohort", metric: 54 },
  { bars: [57, 70, 82, 89], label: "Copy revised", metric: 89 },
  { bars: [41, 55, 61, 68], label: "Support signal", metric: 68 },
  { bars: [64, 78, 91, 96], label: "Guided first run", metric: 96 },
] as const;

const FINAL_METRIC = METRIC_FRAMES.at(-1) ?? METRIC_FRAMES[0];
const FINAL_METRIC_INDEX = METRIC_FRAMES.length - 1;

const ENDPOINT_STAGES = [
  { label: "Question", value: "Where do teams stop?" },
  { label: "Evidence", value: "31% leave during setup." },
  { label: "Decision", value: "Ship a guided first run." },
] as const;

/** A compact semantic motion diagram for the opening claim. */
export function MotionPrimer(): ReactElement {
  return (
    <figure
      aria-label="A question moves through evidence to become a decision"
      className="motion-primer"
    >
      <div aria-hidden="true" className="motion-primer__route">
        <span data-stage="question">?</span>
        <i />
        <span data-stage="evidence">31%</span>
        <i />
        <span data-stage="decision">✓</span>
        <b />
      </div>
      <figcaption>
        <span>Question</span>
        <span>Evidence</span>
        <span>Decision</span>
      </figcaption>
    </figure>
  );
}

/** A stable browser artifact that can move through a story without changing geometry. */
export function BrowserFrame(): ReactElement {
  const labelId = useId();

  return (
    <section aria-labelledby={labelId} className="story-browser__frame">
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
          <div className="story-browser__evidence">
            <span>Setup completion</span>
            <strong>96%</strong>
            <p>31% fewer teams stopped during setup after the guided first run.</p>
          </div>
          <div className="story-browser__status">
            <span>Before</span>
            <i aria-hidden="true" />
            <strong>After guidance</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

/** An original fixed-slot word correction; animated copies remain presentation-only. */
export function SemanticCorrection(): ReactElement {
  return (
    <p className="semantic-correction" aria-label="Motion should explain the change.">
      <span aria-hidden="true" className="semantic-correction__line">
        <span>Motion should</span>
        <span className="semantic-correction__slot">
          <span data-word="old">decorate everything.</span>
          <span data-word="new">explain the change.</span>
        </span>
      </span>
      <span className="motion-sr-only">Motion should explain the change.</span>
    </p>
  );
}

/** A Step-driven reveal for information that was genuinely unavailable before. */
export function EvidenceReveal({ children }: PropsWithChildren): ReactElement {
  return (
    <section className="evidence-reveal">
      <span className="motion-kicker">Interview 12 · recurring signal</span>
      <blockquote>
        “Teams did not need more features. They needed{" "}
        <span aria-live="polite" className="evidence-reveal__finding">
          <i aria-hidden="true">████ █████ ████████ ████ █████ █████</i>
          {children}
        </span>
        ”
      </blockquote>
      <small>Advance once to uncover the finding.</small>
    </section>
  );
}

/** A deterministic live metric animated by Motion for React. */
export function MotionEvidence(): ReactElement {
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const [frameIndex, setFrameIndex] = useState(FINAL_METRIC_INDEX);

  useEffect(() => {
    const renderMode = rootRef.current
      ?.closest<HTMLElement>("[data-drever-render-mode]")
      ?.getAttribute("data-drever-render-mode");
    if (renderMode !== "audience" || reducedMotion === true) {
      return;
    }

    const interval = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % METRIC_FRAMES.length);
    }, 1_350);

    return () => window.clearInterval(interval);
  }, [reducedMotion]);

  const frame = METRIC_FRAMES[frameIndex] ?? FINAL_METRIC;

  return (
    <section
      aria-label="A simulated live setup-completion metric varies from 42 to 96 percent"
      className="motion-evidence"
      ref={rootRef}
    >
      <div aria-hidden="true" className="motion-evidence__metric">
        <header>
          <span className="motion-kicker">Setup completion</span>
          <motion.strong
            animate={{ opacity: 1, y: 0 }}
            initial={false}
            key={frame.metric}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
          >
            {frame.metric}%
          </motion.strong>
          <p>{frame.label}</p>
        </header>
        <div className="motion-evidence__bars">
          {frame.bars.map((value, index) => (
            <motion.i
              animate={{ height: `${value}%` }}
              initial={false}
              key={index}
              transition={{
                delay: index * 0.045,
                duration: 0.52,
                ease: [0.16, 1, 0.3, 1],
              }}
            />
          ))}
        </div>
      </div>
      <small>Motion for React animates one live signal. Drever still owns the slide.</small>
    </section>
  );
}

/** A Step-driven proxy for a stateful spatial scene boundary. */
export function SpatialModel({ children }: PropsWithChildren): ReactElement {
  return (
    <section className="spatial-model">
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
        <div className="spatial-model__states">
          <div className="spatial-model__state spatial-model__state--whole">
            <strong>Start with the whole system.</strong>
            <p>Depth earns its cost when structure is the subject.</p>
          </div>
          {children}
        </div>
        <small>Advance once to reveal the dependency.</small>
      </div>
    </section>
  );
}

/** A live composition that demonstrates several focused animation capabilities. */
export function CapabilityPipeline(): ReactElement {
  return (
    <section
      aria-label="A research brief transforms friction into guidance and then a product decision"
      className="capability-pipeline"
    >
      <div className="capability-pipeline__brief">
        <span>Research brief</span>
        <strong>Teams stop during setup.</strong>
      </div>
      <div aria-hidden="true" className="capability-pipeline__track">
        <i />
      </div>
      <div className="capability-pipeline__kinetic">
        <span>Kinetic type</span>
        <strong>
          <i data-word="old">friction</i>
          <i data-word="new">guidance</i>
        </strong>
      </div>
      <div aria-hidden="true" className="capability-pipeline__object">
        <i />
        <i />
        <i />
      </div>
      <div className="capability-pipeline__decision">
        <span>Spatial state</span>
        <strong>Ship the guided first run.</strong>
      </div>
      <small>One causal loop · kinetic type · local motion · spatial state</small>
    </section>
  );
}

/** The same authored conclusion in a live route and a static endpoint. */
export function AccessibleEndpoint(): ReactElement {
  return (
    <section className="accessible-endpoint">
      <article data-mode="live">
        <header>
          <span>Live route</span>
          <small>Motion clarifies the path.</small>
        </header>
        <ol>
          {ENDPOINT_STAGES.map((stage) => (
            <li key={stage.label}>
              <span>{stage.label}</span>
              <strong>{stage.value}</strong>
            </li>
          ))}
        </ol>
        <i aria-hidden="true" className="accessible-endpoint__focus" />
      </article>
      <article data-mode="static">
        <header>
          <span>Document / PDF</span>
          <small>The complete path remains readable.</small>
        </header>
        <ol>
          {ENDPOINT_STAGES.map((stage) => (
            <li key={stage.label}>
              <span>{stage.label}</span>
              <strong>{stage.value}</strong>
            </li>
          ))}
        </ol>
      </article>
      <div className="accessible-endpoint__same">
        <span aria-hidden="true">=</span>
        <strong>Same conclusion</strong>
      </div>
    </section>
  );
}

import { useDreverRenderMode } from "@drever/core";
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

type BrowserStoryCopyProps = {
  phase: "before" | "after";
};

type AnimatedMetricProps = {
  animate: boolean;
  value: number;
};

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

/** One changed object moves while the surrounding composition remains fixed. */
export function MotionPrimer(): ReactElement {
  return (
    <figure
      aria-label="One signal moves across a quiet field while every surrounding form stays still"
      className="motion-primer"
    >
      <div aria-hidden="true" className="motion-primer__canvas">
        <div className="motion-primer__orbit">
          <i />
          <i />
          <i />
        </div>
        <div className="motion-primer__axis" />
        <div className="motion-primer__origin" />
        <div className="motion-primer__target" />
        <div className="motion-primer__mover">
          <i />
        </div>
      </div>
    </figure>
  );
}

/** A stable headline slot that changes only the subject and outcome. */
function BrowserStoryHeadline({ phase }: BrowserStoryCopyProps): ReactElement {
  const label =
    phase === "before" ? "A screenshot shows the interface." : "Motion shows the change.";

  return (
    <h2 aria-label={label} className="browser-story-headline" data-phase={phase}>
      <span aria-hidden="true" className="browser-story-headline__slot" data-slot="subject">
        <span data-word="old">A screenshot</span>
        <span data-word="new">Motion</span>
      </span>
      <span aria-hidden="true" className="browser-story-headline__fixed">
        shows the
      </span>
      <span aria-hidden="true" className="browser-story-headline__slot" data-slot="outcome">
        <span data-word="old">interface.</span>
        <span data-word="new">change.</span>
      </span>
    </h2>
  );
}

/** One fixed copy canvas whose words change without moving their reading positions. */
export function BrowserStoryCopy({ phase }: BrowserStoryCopyProps): ReactElement {
  const description =
    phase === "before"
      ? "It cannot show the moment the product changes someone’s mind."
      : "The same object rises because the story has moved from a claim to its evidence.";

  return (
    <header className="browser-story-copy" data-phase={phase}>
      <span
        aria-label={phase === "before" ? "01 · Anticipation" : "02 · Introduction"}
        className="browser-story-copy__kicker browser-story-copy__swap"
      >
        <span aria-hidden="true" data-word="old">
          01 · Anticipation
        </span>
        <span aria-hidden="true" data-word="new">
          02 · Introduction
        </span>
      </span>
      <BrowserStoryHeadline phase={phase} />
      <p aria-label={description} className="browser-story-copy__body browser-story-copy__swap">
        <span aria-hidden="true" data-word="old">
          It cannot show the moment the product changes someone’s mind.
        </span>
        <span aria-hidden="true" data-word="new">
          The same object rises because the story has moved from a claim to its evidence.
        </span>
      </p>
    </header>
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

/** A small count-up tied to the same deterministic frame as the chart. */
function AnimatedMetric({ animate, value }: AnimatedMetricProps): ReactElement {
  const nodeRef = useRef<HTMLElement>(null);
  const previousValue = useRef(value);

  useEffect(() => {
    const node = nodeRef.current;
    const from = previousValue.current;
    previousValue.current = value;

    if (!node || !animate || from === value) {
      if (node) {
        node.textContent = `${value}%`;
      }
      return;
    }

    let animationFrame = 0;
    let startedAt: number | undefined;

    const update = (now: number) => {
      startedAt ??= now;
      const progress = Math.min((now - startedAt) / 680, 1);
      const eased = 1 - (1 - progress) ** 3;
      node.textContent = `${Math.round(from + (value - from) * eased)}%`;

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(update);
      }
    };

    animationFrame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [animate, value]);

  return <strong ref={nodeRef}>{value}%</strong>;
}

/** A deterministic live metric animated by Motion for React. */
export function MotionEvidence(): ReactElement {
  const renderMode = useDreverRenderMode();
  const reducedMotion = useReducedMotion();
  const isLive = renderMode === "audience" && reducedMotion !== true;
  const [frameIndex, setFrameIndex] = useState(isLive ? 0 : FINAL_METRIC_INDEX);

  useEffect(() => {
    if (!isLive) {
      setFrameIndex(FINAL_METRIC_INDEX);
      return;
    }

    const firstFrame = window.requestAnimationFrame(() => {
      setFrameIndex((current) => (current + 1) % METRIC_FRAMES.length);
    });
    const interval = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % METRIC_FRAMES.length);
    }, 1_650);

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.clearInterval(interval);
    };
  }, [isLive]);

  const frame = METRIC_FRAMES[frameIndex] ?? FINAL_METRIC;

  return (
    <section
      aria-label="A simulated live setup-completion metric varies from 42 to 96 percent"
      className="motion-evidence"
    >
      <div aria-hidden="true" className="motion-evidence__metric">
        <header>
          <span className="motion-kicker">Setup completion</span>
          <AnimatedMetric animate={isLive} value={frame.metric} />
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
        <div className="accessible-endpoint__route">
          <ol>
            {ENDPOINT_STAGES.map((stage) => (
              <li key={stage.label}>
                <span>{stage.label}</span>
                <strong>{stage.value}</strong>
              </li>
            ))}
          </ol>
          <i aria-hidden="true" className="accessible-endpoint__focus motion-cursor" />
        </div>
      </article>
      <article data-mode="static">
        <header>
          <span>Document / PDF</span>
          <small>The complete path remains readable.</small>
        </header>
        <div className="accessible-endpoint__route">
          <ol>
            {ENDPOINT_STAGES.map((stage) => (
              <li key={stage.label}>
                <span>{stage.label}</span>
                <strong>{stage.value}</strong>
              </li>
            ))}
          </ol>
        </div>
      </article>
      <div className="accessible-endpoint__same">
        <span aria-hidden="true">=</span>
        <strong>Same conclusion</strong>
      </div>
    </section>
  );
}

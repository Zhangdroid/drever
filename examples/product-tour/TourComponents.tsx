import { MotionGroup } from "drever";
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
        <div className="tour-signal__result-copy" key={signal?.id ?? "idle"}>
          <strong>{signal?.response ?? "The next beat is still open."}</strong>
          <p>
            {signal?.guidance ?? "Choose the evidence the room needs—not the next slide in a file."}
          </p>
        </div>
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

/** The first useful Studio surface: one outcome, with ordinary shared constraints beside it. */
export const StudioBrief = (): ReactElement => (
  <section
    className="tour-studio-brief"
    aria-label="A presentation brief inside the local creation room"
  >
    <header>
      <span>Local creation room</span>
      <small>
        <i aria-hidden="true" /> Agent connected
      </small>
    </header>
    <div className="tour-studio-brief__body">
      <article>
        <span className="tour-kicker">The job</span>
        <blockquote>
          Help product, legal, and sales decide whether to approve a launch pilot.
        </blockquote>
      </article>
      <dl>
        <div>
          <dt>Audience</dt>
          <dd>Product · Legal · Sales</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>20 minutes</dd>
        </div>
        <div>
          <dt>Density</dt>
          <dd>Concise</dd>
        </div>
        <div>
          <dt>Motion</dt>
          <dd>Measured</dd>
        </div>
      </dl>
    </div>
  </section>
);

/** One subject-specific direction choice, with the consequence kept visible. */
export const StudioDirection = (): ReactElement => (
  <section
    className="tour-studio-direction"
    aria-label="A topic-specific presentation direction question"
  >
    <div className="tour-studio-direction__question">
      <span className="tour-kicker">Chosen for this launch decision</span>
      <h3>What proof would make approval feel safe?</h3>
      <div aria-label="Direction options" role="list">
        <div
          aria-current="true"
          className="tour-studio-direction__option"
          data-selected=""
          role="listitem"
        >
          <i aria-hidden="true" /> Unaided completion
        </div>
        <div className="tour-studio-direction__option" role="listitem">
          Support volume
        </div>
        <div className="tour-studio-direction__option" role="listitem">
          Time to value
        </div>
      </div>
    </div>
    <aside>
      <small>This answer changes</small>
      <strong>The evidence and decision beats.</strong>
      <p>It does not add another generic slide.</p>
    </aside>
  </section>
);

/** A content-only Storyboard with a separate, authored approval state. */
export const ContentStoryboard = ({ children }: PropsWithChildren): ReactElement => (
  <section
    className="tour-content-storyboard"
    aria-label="A content-first Storyboard approval flow"
  >
    <header>
      <div>
        <span className="tour-kicker">Storyboard · content first</span>
        <strong>Review the argument while change is cheap.</strong>
      </div>
      <small>Layout and motion come later</small>
    </header>
    <ol>
      {[
        ["01", "Opening", "Name the launch decision"],
        ["02", "Question", "Ask what still feels risky"],
        ["03", "Evidence", "Answer with pilot proof"],
        ["04", "Decision", "Leave one explicit move"],
      ].map(([index, job, purpose]) => (
        <li key={index}>
          <span>{index}</span>
          <div className="tour-content-storyboard__copy">
            <small>{job}</small>
            <strong>{purpose}</strong>
          </div>
        </li>
      ))}
    </ol>
    <footer>{children}</footer>
  </section>
);

function DraftPreviewContent({ status }: Readonly<{ status: string }>): ReactElement {
  return (
    <>
      <header>
        <span>Live draft · 03 / 04</span>
        <small>{status}</small>
      </header>
      <div className="tour-draft-preview__metric">
        <small>Pilot evidence</small>
        <strong>96%</strong>
        <p>completed setup without support</p>
      </div>
      <footer>
        <span>Speaker note</span>
        <p>Ask what still feels risky before revealing the number.</p>
      </footer>
    </>
  );
}

/** A complete first draft in the real runtime, with notes and current work beside it. */
export const LiveDraft = (): ReactElement => (
  <section className="tour-live-draft" aria-label="A complete live Draft 1 with speaker notes">
    <div className="tour-live-draft__rail" aria-hidden="true">
      {["Opening", "Question", "Evidence", "Decision"].map((label, index) => (
        <div data-current={index === 2 ? "" : undefined} key={label}>
          <i />
          <span>{String(index + 1).padStart(2, "0")}</span>
        </div>
      ))}
    </div>
    <div className="tour-draft-preview tour-live-draft__preview">
      <DraftPreviewContent status="Complete story" />
    </div>
    <aside>
      <span>
        <i aria-hidden="true" /> Agent active
      </span>
      <strong>Refining the same draft</strong>
      <p>Researching the pilot evidence · checking the decision sequence</p>
    </aside>
  </section>
);

/** Feedback stays independent from the currently previewed slide. */
export const DraftFeedback = ({ children }: PropsWithChildren): ReactElement => (
  <section className="tour-draft-feedback" aria-label="Feedback for one slide or the whole deck">
    <div className="tour-draft-preview tour-draft-feedback__preview">
      <DraftPreviewContent status="Complete story" />
    </div>
    <div className="tour-draft-feedback__composer">
      <span className="tour-kicker">Your direction</span>
      <div className="tour-draft-feedback__scope" aria-label="Feedback scope" role="list">
        <span role="listitem">This slide</span>
        <span aria-current="true" data-selected="" role="listitem">
          Entire deck
        </span>
      </div>
      <blockquote>Let the proof arrive one beat earlier.</blockquote>
      <small>Feedback applies to the entire deck.</small>
      <footer>{children}</footer>
    </div>
  </section>
);

/** Rendered evidence connects exact states and transitions to one repairable result. */
export const RenderedReview = ({ children }: PropsWithChildren): ReactElement => (
  <section
    className="tour-rendered-review"
    aria-label="Rendered review with sampled exact presentation states"
  >
    <div className="tour-rendered-review__states">
      <small>Sample exact states</small>
      {["/1", "/4/1", "/6/1", "/9/1", "/9/2"].map((route) => (
        <span key={route}>
          <i aria-hidden="true" /> {route}
        </span>
      ))}
    </div>
    <div className="tour-rendered-review__frames" aria-hidden="true">
      <div>
        <span>settled</span>
        <i />
        <i />
      </div>
      <div className="tour-rendered-review__frame">
        <span>transition</span>
        <i />
        <i />
      </div>
    </div>
    <div className="tour-rendered-review__result">
      <header>
        <span>Rendered evidence</span>
        <strong>Ready</strong>
      </header>
      <ul>
        <li>Safe area</li>
        <li>Contrast</li>
        <li>Overlap</li>
        <li>Geometry</li>
      </ul>
      <p>Every Step · both directions · one versioned manifest</p>
      <footer>{children}</footer>
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

/** One deliberate handoff from a broad brief to the question that changes the story. */
export const StudioPlan = ({ children }: PropsWithChildren): ReactElement => (
  <section className="tour-studio-plan" aria-label="A brief becoming a focused direction question">
    <header>
      <span>Studio · local creation room</span>
      <small>
        <i aria-hidden="true" /> Agent connected
      </small>
    </header>
    <div className="tour-studio-plan__stage">
      <article className="tour-studio-plan__brief">
        <div>
          <span className="tour-kicker">The job</span>
          <blockquote>
            Help product, legal, and sales decide whether to approve a launch pilot.
          </blockquote>
        </div>
        <dl>
          <div>
            <dt>Audience</dt>
            <dd>Product · Legal · Sales</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>20 minutes</dd>
          </div>
          <div data-focus="">
            <dt>Outcome</dt>
            <dd>Approve the pilot</dd>
          </div>
        </dl>
      </article>
      <article className="tour-studio-plan__direction">
        <div className="tour-studio-plan__summary">
          <span>Launch pilot</span>
          <span>Three teams</span>
          <span>One decision</span>
        </div>
        <span className="tour-kicker">One question that changes the story</span>
        <h3>What proof would make approval feel safe?</h3>
        <div className="tour-studio-plan__options" aria-label="Direction options" role="list">
          <span aria-current="true" data-selected="" role="listitem">
            <i aria-hidden="true" /> Unaided completion
          </span>
          <span role="listitem">Support volume</span>
          <span role="listitem">Time to value</span>
        </div>
      </article>
      <span className="tour-studio-plan__signal" aria-hidden="true">
        <i />
      </span>
    </div>
    <footer>{children}</footer>
  </section>
);

const DRAFT_WALL = [
  ["Opening", "The decision"],
  ["Context", "Why now"],
  ["Question", "What feels risky"],
  ["Flow", "How it works"],
  ["Guardrail", "What stays safe"],
  ["Pilot", "Who goes first"],
  ["Evidence", "96% completed"],
  ["Response", "Answer the room"],
  ["Decision", "Approve the pilot"],
  ["Owners", "Three teams"],
  ["Next", "Two-week start"],
  ["Close", "One clear move"],
] as const;

/** A complete first draft unfolds from one reviewable seed into the whole story. */
export const DraftWall = ({ children }: PropsWithChildren): ReactElement => (
  <section
    className="tour-draft-wall"
    aria-label="A complete twelve-slide draft expanding into view"
  >
    <ol>
      {DRAFT_WALL.map(([job, title], index) => (
        <li data-current={index === 6 ? "" : undefined} key={job}>
          <header>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <small>{job}</small>
          </header>
          <div aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <strong>{title}</strong>
        </li>
      ))}
    </ol>
    <div className="tour-draft-wall__seed" aria-hidden="true">
      <span>Draft 1</span>
      <strong>Complete story</strong>
      <small>12 slides · notes connected</small>
    </div>
    <footer>{children}</footer>
  </section>
);

/** Human direction and deterministic rendered review act on the same stable draft. */
export const DraftReview = ({ children }: PropsWithChildren): ReactElement => (
  <section
    className="tour-draft-review"
    aria-label="A live draft receiving direction and rendered review"
  >
    <div className="tour-draft-review__preview">
      <div className="tour-draft-preview">
        <DraftPreviewContent status="Draft 1 · live" />
      </div>
      <span className="tour-draft-review__target" aria-hidden="true" />
      <span className="tour-draft-review__comment" aria-hidden="true">
        Move proof earlier
      </span>
      <div className="tour-draft-review__evidence" aria-hidden="true">
        <span className="tour-draft-review__evidence-frame" />
        <span className="tour-draft-review__evidence-summary">
          <i /> Rendered check · 4 checks passed
        </span>
        <span className="tour-draft-review__evidence-result" data-check="safe-area">
          Safe area
        </span>
        <span className="tour-draft-review__evidence-result" data-check="contrast">
          Contrast · pass
        </span>
        <span className="tour-draft-review__evidence-result" data-check="overlap">
          No overlap
        </span>
        <span className="tour-draft-review__evidence-result" data-check="geometry">
          Stable geometry
        </span>
      </div>
    </div>
    <aside>
      <div className="tour-draft-review__feedback">
        <span className="tour-kicker">Your direction</span>
        <div className="tour-draft-review__scope" aria-label="Feedback scope">
          <span>This slide</span>
          <span data-selected="">Entire deck</span>
        </div>
        <blockquote>Let the proof arrive one beat earlier.</blockquote>
        <small>The draft stays live while the agent applies the request.</small>
        <div className="tour-draft-review__sent">
          <i aria-hidden="true" /> Direction applied to Draft 1
        </div>
      </div>
      <div className="tour-draft-review__checks">
        <span className="tour-kicker">Rendered evidence</span>
        <strong>Every authored state, checked.</strong>
        <ul>
          {[
            ["Safe area", "12 / 12"],
            ["Contrast", "Pass"],
            ["Overlap", "None"],
            ["Geometry", "Stable"],
          ].map(([label, value]) => (
            <li key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </li>
          ))}
        </ul>
        <div className="tour-draft-review__ready">
          <i aria-hidden="true" /> Ready for the room
        </div>
      </div>
    </aside>
    <footer>{children}</footer>
  </section>
);

/** The selected room signal reveals proof before it locks an explicit decision. */
export const SignalDecision = ({ children }: PropsWithChildren): ReactElement => {
  const signal = resolveSignal(useAudienceSignal());

  return (
    <section className="tour-signal-decision" data-signal={signal.id}>
      <div className="tour-signal-decision__copy">
        <span className="tour-kicker">The story follows the room</span>
        <h2>{signal.response}</h2>
        <p>{signal.guidance}</p>
        <div className="tour-signal-decision__path" aria-hidden="true">
          <span />
          <i />
        </div>
      </div>
      <div className="tour-signal-decision__stage">
        <span className="tour-signal-decision__waiting">
          Evidence waits until it can change the decision.
        </span>
        <div className="tour-signal-decision__proof">
          <DecisionProof />
        </div>
        <div className="tour-signal-decision__lock">
          <span>Decision recorded</span>
          <strong>Approve the three-team pilot.</strong>
          <small>Product · Legal · Sales</small>
        </div>
      </div>
      <footer>{children}</footer>
    </section>
  );
};

/** One stable piece of evidence opens into the four surfaces people actually need. */
export const StorySurfaces = ({ children }: PropsWithChildren): ReactElement => (
  <section className="tour-story-surfaces" aria-label="One story across four useful surfaces">
    <div className="tour-story-surfaces__copy">
      <span className="tour-kicker">One project · every useful surface</span>
      <h2 aria-label="One story, made once—then useful everywhere.">
        <span aria-hidden="true">One story,</span>
        <span aria-hidden="true" className="tour-story-surfaces__headline-slot">
          <strong data-story-copy="source">made once.</strong>
          <strong data-story-copy="result">useful everywhere.</strong>
        </span>
      </h2>
      <p>The evidence stays the same. The surrounding context meets each person where they are.</p>
    </div>
    <div className="tour-story-surfaces__map">
      <div className="tour-story-surfaces__proof">
        <DecisionProof />
      </div>
      <article data-surface="audience">
        <span>Audience</span>
        <strong>Live and interactive</strong>
        <small>What the room needs now</small>
      </article>
      <article data-surface="speaker">
        <span>Speaker</span>
        <strong>Private context</strong>
        <small>Notes · next · timing</small>
      </article>
      <article data-surface="link">
        <span>Exact link</span>
        <strong>/7/2</strong>
        <small>The precise visible state</small>
      </article>
      <article data-surface="document">
        <span>Document</span>
        <strong>Readable afterward</strong>
        <small>Every Step in order</small>
      </article>
    </div>
    <footer>{children}</footer>
  </section>
);

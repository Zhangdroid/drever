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
        <span aria-current="true" data-selected="" role="listitem">
          <i aria-hidden="true" /> Unaided completion
        </span>
        <span role="listitem">Support volume</span>
        <span role="listitem">Time to value</span>
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
          <div>
            <small>{job}</small>
            <strong>{purpose}</strong>
          </div>
        </li>
      ))}
    </ol>
    <footer>{children}</footer>
  </section>
);

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
    <div className="tour-live-draft__preview">
      <header>
        <span>Live draft · 03 / 04</span>
        <small>Complete story</small>
      </header>
      <div>
        <small>Pilot evidence</small>
        <strong>96%</strong>
        <p>completed setup without support</p>
      </div>
      <footer>
        <span>Speaker note</span>
        <p>Ask what still feels risky before revealing the number.</p>
      </footer>
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
    <div className="tour-draft-feedback__preview">
      <header>
        <span>Live draft</span>
        <small>Slide 03 remains selected</small>
      </header>
      <div>
        <strong>96%</strong>
        <i />
        <i />
      </div>
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
      <div>
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

import type { Diagnostic, DreverDeckPlan, DreverDeckPlanSlide } from "@drever/schema";
import { type CSSProperties, type ReactElement } from "react";

export type StoryboardStatus = "invalid" | "missing" | "ready" | "waiting";

export type StoryboardDiagnostic = Pick<Diagnostic, "code" | "hint" | "message" | "severity">;

/** Serializable state supplied by the development server. */
export type StoryboardState = Readonly<{
  diagnostics: readonly StoryboardDiagnostic[];
  plan?: DreverDeckPlan;
  revision: number;
  status: StoryboardStatus;
}>;

export type StoryboardProps = Readonly<{
  state: StoryboardState;
}>;

type ReviewablePlan = Exclude<DreverDeckPlan, Readonly<{ status: "awaiting-input" }>>;

type StoryboardCardStyle = CSSProperties &
  Readonly<{
    "--drever-storyboard-card-index": number;
  }>;

const statusLabel = (state: StoryboardState): string => {
  if (state.status === "invalid") return "Plan needs attention";
  if (state.status === "missing") return "Plan not started";
  if (state.plan?.status === "approved") return "Approved structure";
  if (state.plan?.status === "awaiting-approval") return "Awaiting approval";
  return "Waiting for brief";
};

const planWithSlides = (plan: DreverDeckPlan | undefined): ReviewablePlan | undefined =>
  plan?.status === "awaiting-input" ? undefined : plan;

const sentenceCase = (value: string): string =>
  value
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const slideNumber = (index: number): string => String(index + 1).padStart(2, "0");

const EXPECTED_WAITING_DIAGNOSTICS = new Set([
  "DREVER_PLAN_AWAITING_APPROVAL",
  "DREVER_PLAN_AWAITING_INPUT",
]);

const PlanValue = ({ children, language }: Readonly<{ children: string; language: string }>) => (
  <span dir="auto" lang={language}>
    {children}
  </span>
);

const Summary = ({ plan }: Readonly<{ plan: ReviewablePlan }>): ReactElement => {
  const { brief } = plan;
  const items: readonly Readonly<{
    authored: boolean;
    label: string;
    value: string;
  }>[] = [
    { authored: true, label: "Audience", value: brief.audience },
    { authored: true, label: "Desired change", value: brief.desiredChange },
    { authored: false, label: "Duration", value: `${brief.durationMinutes} min` },
    { authored: false, label: "Language", value: brief.language },
    { authored: false, label: "Density", value: sentenceCase(brief.density) },
  ] as const;

  return (
    <dl aria-label="Presentation brief" className="drever-storyboard__summary">
      {items.map(({ authored, label, value }) => (
        <div className="drever-storyboard__summary-item" key={label}>
          <dt>{label}</dt>
          <dd>{authored ? <PlanValue language={brief.language}>{value}</PlanValue> : value}</dd>
        </div>
      ))}
    </dl>
  );
};

const SlideCard = ({
  index,
  language,
  slide,
}: Readonly<{
  index: number;
  language: string;
  slide: DreverDeckPlanSlide;
}>): ReactElement => {
  const style: StoryboardCardStyle = { "--drever-storyboard-card-index": index };
  const composition = [slide.composition.recipe, slide.composition.variant]
    .filter((value) => value !== undefined)
    .join(" · ");

  return (
    <li className="drever-storyboard-card" data-storyboard-slide={slide.id} style={style}>
      <article aria-labelledby={`drever-storyboard-${slide.id}-title`}>
        <header className="drever-storyboard-card__header">
          <span aria-hidden="true" className="drever-storyboard-card__number">
            {slideNumber(index)}
          </span>
          <div className="drever-storyboard-card__heading">
            <span className="drever-storyboard-card__job">{sentenceCase(slide.job)}</span>
            <h2 dir="auto" id={`drever-storyboard-${slide.id}-title`} lang={language}>
              {slide.title}
            </h2>
          </div>
        </header>

        <p className="drever-storyboard-card__purpose" dir="auto" lang={language}>
          {slide.purpose}
        </p>

        <div className="drever-storyboard-card__body">
          <section>
            <h3>Evidence</h3>
            <ul>
              {slide.evidence.map((item, evidenceIndex) => (
                <li
                  dir="auto"
                  key={`${slide.id}-evidence-${String(evidenceIndex)}`}
                  lang={language}
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>
          <section className="drever-storyboard-card__artifact">
            <h3>Focal artifact</h3>
            <p dir="auto" lang={language}>
              {slide.focalArtifact}
            </p>
          </section>
        </div>

        <dl className="drever-storyboard-card__specification">
          <div>
            <dt>Composition</dt>
            <dd dir="auto" lang={language}>
              {composition}
            </dd>
          </div>
          <div>
            <dt>Density</dt>
            <dd>{sentenceCase(slide.density)}</dd>
          </div>
          {slide.motion === undefined ? (
            <div>
              <dt>Motion</dt>
              <dd>None planned</dd>
            </div>
          ) : (
            <div className="drever-storyboard-card__motion">
              <dt>
                Motion · {sentenceCase(slide.motion.intent)} · owner {slide.motion.owner}
              </dt>
              <dd dir="auto" lang={language}>
                {slide.motion.purpose}
              </dd>
            </div>
          )}
        </dl>
      </article>
    </li>
  );
};

const Diagnostics = ({
  diagnostics,
  status,
}: Readonly<{
  diagnostics: readonly StoryboardDiagnostic[];
  status: StoryboardStatus;
}>): ReactElement | null => {
  const visible = diagnostics.filter(
    ({ code }) => status === "invalid" || !EXPECTED_WAITING_DIAGNOSTICS.has(code),
  );
  if (visible.length === 0) return null;

  const needsRepair = status === "invalid" || visible.some(({ severity }) => severity === "error");

  return (
    <section
      aria-labelledby="drever-storyboard-diagnostics"
      className="drever-storyboard__notice"
      data-severity={needsRepair ? "error" : "note"}
    >
      <div aria-hidden="true" className="drever-storyboard__notice-mark">
        {needsRepair ? "!" : "i"}
      </div>
      <div>
        <h2 id="drever-storyboard-diagnostics">
          {needsRepair ? "The plan needs a small repair" : "Plan notes"}
        </h2>
        <ul>
          {visible.map((diagnostic, index) => (
            <li key={`${diagnostic.code}-${String(index)}`}>
              <p>{diagnostic.message}</p>
              {diagnostic.hint === undefined ? null : <span>{diagnostic.hint}</span>}
              <code>{diagnostic.code}</code>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

const EmptyStoryboard = ({ status }: Readonly<{ status: StoryboardStatus }>): ReactElement => {
  const invalid = status === "invalid";
  const missing = status === "missing";
  const title = invalid
    ? "The last valid storyboard is not available."
    : missing
      ? "No story plan yet."
      : "The briefing is still taking shape.";
  const description = invalid
    ? "Repair drever.plan.json to restore the structure preview."
    : missing
      ? "Create drever.plan.json through the Drever briefing to see the complete story before authoring."
      : "Answer the remaining briefing questions. The ordered slides will appear here before design work begins.";

  return (
    <section className="drever-storyboard-empty">
      <div aria-hidden="true" className="drever-storyboard-empty__preview">
        <span />
        <span />
        <span />
      </div>
      <div>
        <p>{missing ? "Story contract" : "Structure preview"}</p>
        <h2>{title}</h2>
        <span>{description}</span>
      </div>
    </section>
  );
};

const ReviewNotice = ({ state }: StoryboardProps): ReactElement => {
  const plan = planWithSlides(state.plan);
  const invalidWithPlan = state.status === "invalid" && plan !== undefined;
  const copy = invalidWithPlan
    ? "Showing the last valid structure while the current plan is repaired."
    : plan?.status === "approved"
      ? "The story contract is approved. Visual design and final composition come next."
      : "Review this order in chat. Approve it there or request changes before authoring begins.";

  return (
    <aside className="drever-storyboard__review-note">
      <span aria-hidden="true" />
      <p>{copy}</p>
    </aside>
  );
};

/** A read-only, design-neutral view of the persisted presentation story contract. */
export const Storyboard = ({ state }: StoryboardProps): ReactElement => {
  const plan = planWithSlides(state.plan);

  return (
    <main
      className="drever-storyboard"
      data-drever-storyboard=""
      data-storyboard-state={state.status}
      dir="ltr"
      lang="en"
    >
      <div className="drever-storyboard__frame">
        <header className="drever-storyboard__header">
          <div className="drever-storyboard__identity">
            <svg aria-hidden="true" viewBox="0 0 36 36">
              <path d="M7 7h15l7 7v15H14l-7-7V7Z" />
              <path d="m7 22 7-8h15M14 14v15" />
            </svg>
            <span>Drever / Storyboard</span>
          </div>
          <div aria-live="polite" className="drever-storyboard__status" role="status">
            <span aria-hidden="true" />
            {statusLabel(state)}
          </div>
        </header>

        <section className="drever-storyboard__introduction">
          <div>
            <p>Structure preview—not final design.</p>
            <h1 dir="auto" lang={plan?.brief.language}>
              {plan?.brief.topic ?? "Shape the story before styling the slides."}
            </h1>
          </div>
          <p className="drever-storyboard__lede">
            Read the sequence, evidence, and intended transformation. Approval happens in your AI
            conversation; this surface stays deliberately read-only.
          </p>
        </section>

        <Diagnostics diagnostics={state.diagnostics} status={state.status} />

        {plan === undefined ? (
          <EmptyStoryboard status={state.status} />
        ) : (
          <>
            <Summary plan={plan} />
            <ReviewNotice state={state} />
            <section
              aria-labelledby="drever-storyboard-sequence"
              className="drever-storyboard__sequence"
            >
              <div className="drever-storyboard__sequence-heading">
                <div>
                  <p>Ordered story</p>
                  <h2 id="drever-storyboard-sequence">
                    {plan.slides.length} {plan.slides.length === 1 ? "slide" : "slides"}
                  </h2>
                </div>
                <span>Read from top to bottom</span>
              </div>
              <ol className="drever-storyboard__cards">
                {plan.slides.map((slide, index) => (
                  <SlideCard
                    index={index}
                    key={slide.id}
                    language={plan.brief.language}
                    slide={slide}
                  />
                ))}
              </ol>
            </section>
          </>
        )}
      </div>
    </main>
  );
};

import type {
  DreverDeckPlanSlide,
  DreverStudioAgentApprovalDecision,
  DreverStudioAgentApprovalRequest,
  DreverStudioAnswer,
  DreverStudioActivity,
  DreverStudioCommonBrief,
  DreverStudioQuestion,
  DreverStudioState,
} from "@drever/schema";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type SVGProps,
} from "react";

export type StudioActionInput =
  | Readonly<{ brief: DreverStudioCommonBrief; type: "submit-common-brief" }>
  | Readonly<{ answers: readonly DreverStudioAnswer[]; type: "submit-adaptive-answers" }>
  | Readonly<{ type: "skip-remaining-questions" }>
  | Readonly<{ type: "approve-plan" }>
  | Readonly<{
      approvalId: string;
      decision: DreverStudioAgentApprovalDecision;
      type: "respond-agent-approval";
    }>
  | Readonly<{ message: string; slideId?: string; type: "submit-feedback" }>;

export type StudioProps = Readonly<{
  audienceUrl: string;
  onAction(action: StudioActionInput): Promise<void> | void;
  previewUrl?: string;
  state: DreverStudioState;
}>;

type IconProps = SVGProps<SVGSVGElement>;

const ArrowIcon = (props: IconProps): ReactElement => (
  <svg aria-hidden="true" viewBox="0 0 20 20" {...props}>
    <path d="M4 10h11m-4-4 4 4-4 4" />
  </svg>
);

const CheckIcon = (props: IconProps): ReactElement => (
  <svg aria-hidden="true" viewBox="0 0 20 20" {...props}>
    <path d="m4.5 10.5 3.2 3.2 7.8-8" />
  </svg>
);

const CommentIcon = (props: IconProps): ReactElement => (
  <svg aria-hidden="true" viewBox="0 0 20 20" {...props}>
    <path d="M4 4.5h12v8H9l-4 3v-3H4v-8Z" />
  </svg>
);

const ExternalIcon = (props: IconProps): ReactElement => (
  <svg aria-hidden="true" viewBox="0 0 20 20" {...props}>
    <path d="M8 5H4v11h11v-4M10 4h6v6m0-6-8 8" />
  </svg>
);

const SparkIcon = (props: IconProps): ReactElement => (
  <svg aria-hidden="true" viewBox="0 0 20 20" {...props}>
    <path d="M10 2.5c.4 4.2 2.3 6.2 6.5 6.5-4.2.4-6.1 2.3-6.5 6.5C9.6 11.3 7.7 9.4 3.5 9 7.7 8.7 9.6 6.7 10 2.5Z" />
  </svg>
);

const densityOptions = [
  {
    description: "One idea per slide, with detail kept in notes.",
    id: "concise",
    label: "Concise",
  },
  {
    description: "Enough evidence to stand alone without becoming a document.",
    id: "balanced",
    label: "Balanced",
    recommended: true,
  },
  {
    description: "More context remains visible for later reading.",
    id: "detailed",
    label: "Detailed",
  },
] as const;

const motionOptions = [
  {
    description: "Let the agent choose where motion clarifies the story.",
    id: "agent-choice",
    label: "Choose for me",
    recommended: true,
  },
  {
    description: "Restrained transitions with a few meaningful surprises.",
    id: "minimal",
    label: "Quiet",
  },
  {
    description: "A balanced rhythm for most presentations.",
    id: "measured",
    label: "Measured",
  },
  {
    description: "More authored sequences when the content earns them.",
    id: "expressive",
    label: "Expressive",
  },
] as const;

const durationOptions = [5, 10, 20, 30] as const;

type DensityChoice = NonNullable<DreverStudioCommonBrief["density"]>;
type MotionChoice = "agent-choice" | NonNullable<DreverStudioCommonBrief["motionIntensity"]>;
type StudioMode = "draft" | "storyboard";

type StudioAnswerDraft = Readonly<{
  optionIds: readonly string[];
  text: string;
}>;

type StudioAnswerDrafts = Readonly<Record<string, StudioAnswerDraft>>;
type StudioQuestionRound = Readonly<{
  answers: readonly DreverStudioAnswer[];
  questions: readonly DreverStudioQuestion[];
}>;

export const hydrateStudioAnswerDrafts = (
  questions: readonly DreverStudioQuestion[],
  answers: readonly DreverStudioAnswer[] | undefined,
): StudioAnswerDrafts => {
  const answersById = new Map((answers ?? []).map((answer) => [answer.questionId, answer]));
  return Object.fromEntries(
    questions.map((question) => {
      const answer = answersById.get(question.id);
      const optionIds = new Set(question.options.map(({ id }) => id));
      return [
        question.id,
        {
          optionIds: (answer?.optionIds ?? []).filter((id) => optionIds.has(id)),
          text: answer?.text ?? "",
        },
      ];
    }),
  );
};

export const resolveStudioAnswers = (
  questions: readonly DreverStudioQuestion[],
  drafts: StudioAnswerDrafts,
): readonly DreverStudioAnswer[] =>
  questions.flatMap((question) => {
    const draft = drafts[question.id];
    if (draft === undefined) return [];
    const optionIds = new Set(question.options.map(({ id }) => id));
    const selected = draft.optionIds.filter((id) => optionIds.has(id));
    const text = draft.text.trim();
    if (selected.length === 0 && text === "") return [];
    return [
      {
        questionId: question.id,
        ...(selected.length === 0 ? {} : { optionIds: selected }),
        ...(text === "" ? {} : { text }),
      },
    ];
  });

export const submitStudioBrief = async (
  onAction: StudioProps["onAction"],
  brief: DreverStudioCommonBrief,
  skipRemaining: boolean,
): Promise<void> => {
  await onAction({ brief, type: "submit-common-brief" });
  if (skipRemaining) await onAction({ type: "skip-remaining-questions" });
};

export const resolveStudioDuration = (value: string): number | undefined => {
  const normalized = value.trim();
  if (!/^\d+$/u.test(normalized)) return undefined;
  const duration = Number(normalized);
  return Number.isSafeInteger(duration) && duration > 0 && duration <= 1_440 ? duration : undefined;
};

export const nextStudioMode = (
  mode: StudioMode,
  wasDraftAvailable: boolean,
  draftAvailable: boolean,
): StudioMode => {
  if (!draftAvailable) return "storyboard";
  return wasDraftAvailable ? mode : "draft";
};

const sentenceCase = (value: string): string =>
  value
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const ChoiceGroup = <Value extends string>({
  label,
  onChange,
  options,
  value,
}: Readonly<{
  label: string;
  onChange(value: Value): void;
  options: readonly Readonly<{
    description: string;
    id: Value;
    label: string;
    recommended?: boolean;
  }>[];
  value: Value;
}>): ReactElement => (
  <fieldset className="drever-studio-choice-group">
    <legend>{label}</legend>
    <div className="drever-studio-choice-grid">
      {options.map((option) => (
        <label data-selected={value === option.id ? "" : undefined} key={option.id}>
          <input
            checked={value === option.id}
            name={label}
            onChange={() => onChange(option.id)}
            type="radio"
          />
          <span className="drever-studio-choice-title">
            {option.label}
            {option.recommended === true ? <small>Recommended</small> : null}
          </span>
          <span>{option.description}</span>
        </label>
      ))}
    </div>
  </fieldset>
);

const StudioIdentity = (): ReactElement => (
  <div className="drever-studio-identity">
    <svg aria-hidden="true" viewBox="0 0 36 36">
      <path d="M7 7h15l7 7v15H14l-7-7V7Z" />
      <path d="m7 22 7-8h15M14 14v15" />
    </svg>
    <span>Drever</span>
    <i />
    <strong>Creation room</strong>
  </div>
);

const phaseIndex = (state: DreverStudioState): number => {
  if (state.phase === "error") return -1;
  if (state.phase === "briefing") return 0;
  if (state.phase === "waiting-for-agent" || state.phase === "adaptive-questions") return 1;
  if (state.phase === "plan-review") return 2;
  return 3;
};

const StudioProgress = ({ state }: Readonly<{ state: DreverStudioState }>): ReactElement => {
  const current = phaseIndex(state);
  const stages = ["Brief", "Direction", "Storyboard", "Draft"] as const;
  return (
    <ol aria-label="Creation progress" className="drever-studio-progress">
      {stages.map((stage, index) => (
        <li
          aria-current={current === index ? "step" : undefined}
          data-complete={index < current ? "" : undefined}
          key={stage}
        >
          <span>{index < current ? <CheckIcon /> : String(index + 1).padStart(2, "0")}</span>
          {stage}
        </li>
      ))}
    </ol>
  );
};

const fallbackActivity = (state: DreverStudioState): readonly DreverStudioActivity[] => [
  {
    id: "brief-saved",
    label: "Brief saved",
    detail: "Your topic and direction are stored in this Studio session.",
    status: "complete",
  },
  {
    id: "current-work",
    label: state.agentConnected
      ? (state.progress?.label ?? "Preparing the next step")
      : "Waiting for a local agent",
    detail:
      state.message ??
      (state.agentConnected
        ? "Latest activity published by the agent"
        : "Resume the coding-agent task to continue"),
    status: "active",
  },
];

const activityFor = (state: DreverStudioState): readonly DreverStudioActivity[] =>
  state.activity ?? fallbackActivity(state);

const currentActivityFor = (state: DreverStudioState): DreverStudioActivity | undefined =>
  state.activity?.find(({ status }) => status === "active") ?? state.activity?.at(-1);

const StudioActivityTicker = ({ state }: Readonly<{ state: DreverStudioState }>): ReactElement => {
  const published = currentActivityFor(state);
  const label = published?.label ?? state.progress?.label ?? state.message;
  const detail = published?.detail ?? (published === undefined ? state.message : undefined);
  const active = published?.status === "active" || state.phase === "drafting";

  return (
    <aside
      aria-label="Latest agent activity"
      aria-live="polite"
      className="drever-studio-live-update"
      data-active={active ? "" : undefined}
    >
      <span aria-hidden="true" />
      <small>{active ? "Agent working" : "Latest update"}</small>
      <strong dir="auto">{label ?? "Studio is up to date"}</strong>
      {detail === undefined || detail === label ? null : <p dir="auto">{detail}</p>}
    </aside>
  );
};

const approvalKindLabel = (kind: DreverStudioAgentApprovalRequest["kind"]): string => {
  if (kind === "file-change") return "File change";
  if (kind === "permissions") return "Permission";
  return "Command";
};

export const respondToStudioAgentApproval = async (
  onAction: StudioProps["onAction"],
  approvalId: string,
  decision: DreverStudioAgentApprovalDecision,
): Promise<void> => {
  await onAction({ approvalId, decision, type: "respond-agent-approval" });
};

const StudioAgentApproval = ({
  approvals,
  onAction,
}: Readonly<{
  approvals: readonly DreverStudioAgentApprovalRequest[];
  onAction: StudioProps["onAction"];
}>): ReactElement | null => {
  const approval = approvals[0];
  const [responding, setResponding] = useState<DreverStudioAgentApprovalDecision>();
  const titleId = useId();
  if (approval === undefined) return null;
  const decisions = approval.decisions ?? ["accept", "acceptForSession", "decline"];

  const respond = async (decision: DreverStudioAgentApprovalDecision): Promise<void> => {
    setResponding(decision);
    try {
      await respondToStudioAgentApproval(onAction, approval.id, decision);
    } catch {
      // Studio owns the visible action error at the shared dispatch boundary.
    } finally {
      setResponding(undefined);
    }
  };
  return (
    <aside
      aria-labelledby={titleId}
      aria-live="assertive"
      className="drever-studio-agent-approval"
      role="region"
    >
      <span aria-hidden="true" />
      <div className="drever-studio-agent-approval__copy">
        <small>{approvalKindLabel(approval.kind)} approval</small>
        <strong dir="auto" id={titleId}>
          {approval.reason ?? "The local agent needs your approval to continue."}
        </strong>
        {approval.detail === undefined ? null : <p dir="auto">{approval.detail}</p>}
        {approvals.length > 1 ? <em>{approvals.length - 1} more waiting</em> : null}
      </div>
      <div
        aria-label="Respond to agent approval"
        className="drever-studio-agent-approval__actions"
        role="group"
      >
        {decisions.includes("accept") ? (
          <button
            className="drever-studio-button drever-studio-button--primary"
            disabled={responding !== undefined}
            onClick={() => void respond("accept")}
            type="button"
          >
            {responding === "accept" ? "Allowing…" : "Allow once"}
          </button>
        ) : null}
        {decisions.includes("acceptForSession") ? (
          <button
            className="drever-studio-agent-approval__session"
            disabled={responding !== undefined}
            onClick={() => void respond("acceptForSession")}
            type="button"
          >
            {responding === "acceptForSession" ? "Allowing…" : "Allow for session"}
          </button>
        ) : null}
        {decisions.includes("decline") ? (
          <button
            className="drever-studio-button drever-studio-button--quiet"
            disabled={responding !== undefined}
            onClick={() => void respond("decline")}
            type="button"
          >
            {responding === "decline" ? "Declining…" : "Decline"}
          </button>
        ) : null}
        {decisions.includes("cancel") ? (
          <button
            className="drever-studio-button drever-studio-button--quiet"
            disabled={responding !== undefined}
            onClick={() => void respond("cancel")}
            type="button"
          >
            {responding === "cancel" ? "Cancelling…" : "Cancel"}
          </button>
        ) : null}
      </div>
    </aside>
  );
};

const BriefScreen = ({
  onAction,
  state,
}: Readonly<{
  onAction: StudioProps["onAction"];
  state: DreverStudioState;
}>): ReactElement => {
  const existing = state.commonBrief;
  const [topic, setTopic] = useState(existing?.topic ?? "");
  const [audience, setAudience] = useState(existing?.audience ?? "");
  const [desiredChange, setDesiredChange] = useState(existing?.desiredChange ?? "");
  const initialDuration = existing?.durationMinutes ?? 10;
  const initialPreset = durationOptions.find((duration) => duration === initialDuration);
  const [durationChoice, setDurationChoice] = useState<number | "custom">(
    initialPreset ?? "custom",
  );
  const [customDuration, setCustomDuration] = useState(
    initialPreset === undefined ? String(initialDuration) : "",
  );
  const [density, setDensity] = useState<DensityChoice>(existing?.density ?? "balanced");
  const [motion, setMotion] = useState<MotionChoice>(existing?.motionIntensity ?? "agent-choice");
  const [submitting, setSubmitting] = useState(false);
  const durationMinutes =
    durationChoice === "custom" ? resolveStudioDuration(customDuration) : durationChoice;

  const submit = async (event: FormEvent, skipRemaining = false): Promise<void> => {
    event.preventDefault();
    if (topic.trim() === "" || durationMinutes === undefined) return;
    const brief: DreverStudioCommonBrief = {
      topic: topic.trim(),
      ...(audience.trim() === "" ? {} : { audience: audience.trim() }),
      ...(desiredChange.trim() === "" ? {} : { desiredChange: desiredChange.trim() }),
      density,
      durationMinutes,
      ...(motion === "agent-choice" ? {} : { motionIntensity: motion }),
    };
    setSubmitting(true);
    try {
      await submitStudioBrief(onAction, brief, skipRemaining);
    } catch {
      // Studio owns the visible action error at the shared dispatch boundary.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="drever-studio-brief">
      <section className="drever-studio-brief__intro">
        <p>Begin with the room</p>
        <h1>What should this presentation help people understand—or do?</h1>
        <span>
          Give the agent a topic and only the constraints that matter. It will ask the next useful
          questions, not a generic questionnaire.
        </span>
      </section>

      <form className="drever-studio-brief__form" onSubmit={(event) => void submit(event)}>
        <label className="drever-studio-topic">
          <span>Presentation topic</span>
          <textarea
            autoFocus
            onChange={(event) => setTopic(event.currentTarget.value)}
            placeholder="For example: Why black holes are not cosmic vacuum cleaners"
            required
            rows={3}
            value={topic}
          />
        </label>

        <div className="drever-studio-brief__pair">
          <label>
            <span>
              Audience <small>Optional</small>
            </span>
            <input
              onChange={(event) => setAudience(event.currentTarget.value)}
              placeholder="Who will be in the room?"
              value={audience}
            />
          </label>
          <label>
            <span>
              After the presentation <small>Optional</small>
            </span>
            <input
              onChange={(event) => setDesiredChange(event.currentTarget.value)}
              placeholder="What should people understand, decide, or do?"
              value={desiredChange}
            />
          </label>
        </div>

        <fieldset className="drever-studio-duration">
          <legend>Duration</legend>
          <div>
            {durationOptions.map((duration) => (
              <label data-selected={duration === durationChoice ? "" : undefined} key={duration}>
                <input
                  checked={duration === durationChoice}
                  name="duration"
                  onChange={() => setDurationChoice(duration)}
                  type="radio"
                />
                {duration} min
              </label>
            ))}
            <label
              className="drever-studio-duration__custom"
              data-selected={durationChoice === "custom" ? "" : undefined}
            >
              <span>Custom</span>
              <span>
                <input
                  aria-invalid={
                    durationChoice === "custom" && durationMinutes === undefined ? true : undefined
                  }
                  aria-label="Custom duration in minutes"
                  inputMode="numeric"
                  max={1_440}
                  min={1}
                  onChange={(event) => {
                    setDurationChoice("custom");
                    setCustomDuration(event.currentTarget.value);
                  }}
                  onFocus={() => setDurationChoice("custom")}
                  placeholder="45"
                  required={durationChoice === "custom"}
                  step={1}
                  type="number"
                  value={customDuration}
                />
                <small>min</small>
              </span>
            </label>
          </div>
        </fieldset>

        <ChoiceGroup<DensityChoice>
          label="Information density"
          onChange={setDensity}
          options={densityOptions}
          value={density}
        />
        <ChoiceGroup<MotionChoice>
          label="Motion direction"
          onChange={setMotion}
          options={motionOptions}
          value={motion}
        />

        <footer className="drever-studio-brief__actions">
          <button
            className="drever-studio-button drever-studio-button--quiet"
            disabled={submitting || topic.trim() === "" || durationMinutes === undefined}
            onClick={(event) => void submit(event, true)}
            type="button"
          >
            Skip the rest — surprise me
          </button>
          <button
            className="drever-studio-button drever-studio-button--primary"
            disabled={submitting || topic.trim() === "" || durationMinutes === undefined}
            type="submit"
          >
            {submitting ? "Sending…" : "Shape the direction"}
            <ArrowIcon />
          </button>
        </footer>
      </form>
    </main>
  );
};

const WaitingScreen = ({ state }: Readonly<{ state: DreverStudioState }>): ReactElement => {
  const { progress } = state;
  const progressCount =
    progress?.completed === undefined
      ? undefined
      : progress.total === undefined
        ? `${progress.completed} complete`
        : `${progress.completed} of ${progress.total}`;
  const currentActivity = state.agentConnected
    ? (progress?.label ?? "Preparing the next step")
    : "Waiting for a local agent";
  const nextMilestone =
    state.skippedRemainingQuestions === true || state.adaptiveAnswers !== undefined
      ? "Storyboard ready"
      : "Questions ready";
  const activity = activityFor(state);

  return (
    <main className="drever-studio-waiting">
      <section className="drever-studio-waiting__hero">
        <div aria-hidden="true" className="drever-studio-orbit">
          <span />
          <span />
          <span />
        </div>
        <p>{state.agentConnected ? "Agent activity" : "Request saved locally"}</p>
        <h1 dir="auto">{state.commonBrief?.topic}</h1>
        <span>
          {state.agentConnected
            ? "Studio follows the agent live and advances as soon as the next result is ready."
            : "Nothing is running inside Studio itself. Start or resume the coding-agent task to continue."}
        </span>
      </section>

      <section aria-label="Agent activity" aria-live="polite" className="drever-studio-activity">
        <header>
          <span>Session activity</span>
          <small data-active={state.agentConnected ? "" : undefined}>
            <i aria-hidden="true" />
            {state.agentConnected ? "Live" : "Paused"}
          </small>
        </header>
        <ol>
          {activity.map((item) => (
            <li
              aria-current={item.status === "active" ? "step" : undefined}
              data-status={item.status}
              key={item.id}
            >
              <span aria-hidden="true" className="drever-studio-activity__marker">
                {item.status === "complete" ? <CheckIcon /> : <SparkIcon />}
              </span>
              <div>
                <strong dir="auto">{item.label}</strong>
                <span dir="auto">
                  {item.detail ??
                    (item.label === currentActivity && progressCount !== undefined
                      ? progressCount
                      : "Published by the local agent")}
                </span>
                {item.status === "active" && progressCount !== undefined ? (
                  <small>{progressCount}</small>
                ) : null}
                {item.status === "active" &&
                progress?.completed !== undefined &&
                progress.total !== undefined ? (
                  <progress
                    aria-label={progress.label}
                    max={progress.total}
                    value={progress.completed}
                  />
                ) : null}
              </div>
            </li>
          ))}
          <li data-status="pending">
            <span aria-hidden="true" className="drever-studio-activity__marker">
              {String(activity.length + 1).padStart(2, "0")}
            </span>
            <div>
              <strong>{nextMilestone}</strong>
              <span>Studio opens it as soon as it is ready.</span>
            </div>
          </li>
        </ol>
        {state.agentConnected && state.message !== undefined && state.activity === undefined ? (
          <aside className="drever-studio-activity__note">
            <SparkIcon aria-hidden="true" />
            <div>
              <small>Agent update</small>
              <p dir="auto">{state.message}</p>
            </div>
          </aside>
        ) : null}
      </section>
    </main>
  );
};

const ErrorScreen = ({ state }: Readonly<{ state: DreverStudioState }>): ReactElement => (
  <main
    aria-labelledby="drever-studio-error-title"
    className="drever-studio-waiting drever-studio-waiting--error"
  >
    <p>Agent needs attention</p>
    <h1 id="drever-studio-error-title">The draft paused.</h1>
    <span aria-live="assertive" role="alert">
      {state.message ?? "Resolve the reported agent error, then continue from this Studio session."}
    </span>
  </main>
);

const AgentConnectionNotice = (): ReactElement => (
  <aside aria-live="polite" className="drever-studio-agent-notice">
    <span aria-hidden="true" />
    <div>
      <strong>No local agent is active.</strong>
      <span>
        Studio does not run a model itself. Changes stay queued until the coding-agent task starts
        or resumes the Drever workflow.
      </span>
    </div>
  </aside>
);

const QuestionsScreen = ({
  onAction,
  state,
}: Readonly<{
  onAction: StudioProps["onAction"];
  state: DreverStudioState;
}>): ReactElement => {
  const serializedQuestionRound = JSON.stringify({
    answers: state.adaptiveAnswers ?? [],
    questions: state.adaptiveQuestions ?? [],
  });
  const questionRound = useMemo(
    () => JSON.parse(serializedQuestionRound) as StudioQuestionRound,
    [serializedQuestionRound],
  );
  const { answers: hydratedAnswers, questions } = questionRound;
  const [drafts, setDrafts] = useState<StudioAnswerDrafts>(() =>
    hydrateStudioAnswerDrafts(questions, hydratedAnswers),
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setDrafts(hydrateStudioAnswerDrafts(questionRound.questions, questionRound.answers));
  }, [questionRound]);

  const setAnswer = (question: DreverStudioQuestion, value: string): void => {
    setDrafts((current) => {
      const draft = current[question.id] ?? { optionIds: [], text: "" };
      if (question.multiple !== true) {
        return { ...current, [question.id]: { ...draft, optionIds: [value] } };
      }
      return {
        ...current,
        [question.id]: {
          ...draft,
          optionIds: draft.optionIds.includes(value)
            ? draft.optionIds.filter((entry) => entry !== value)
            : [...draft.optionIds, value],
        },
      };
    });
  };

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const resolved = resolveStudioAnswers(questions, drafts);
    setSubmitting(true);
    try {
      await onAction({ answers: resolved, type: "submit-adaptive-answers" });
    } catch {
      // Studio owns the visible action error at the shared dispatch boundary.
    } finally {
      setSubmitting(false);
    }
  };

  const skip = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await onAction({ type: "skip-remaining-questions" });
    } catch {
      // Studio owns the visible action error at the shared dispatch boundary.
    } finally {
      setSubmitting(false);
    }
  };

  const resolvedAnswers = resolveStudioAnswers(questions, drafts);

  return (
    <main className="drever-studio-questions">
      <header>
        <p>Direction, not paperwork</p>
        <h1>A few choices that genuinely change this deck.</h1>
        <span>The agent chose these questions from your topic and earlier answers.</span>
      </header>

      <form onSubmit={(event) => void submit(event)}>
        {questions.map((question, index) => {
          const draft = drafts[question.id] ?? { optionIds: [], text: "" };
          return (
            <fieldset className="drever-studio-question" key={question.id}>
              <legend>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{question.prompt}</strong>
              </legend>
              <div>
                {question.options.map((option) => {
                  const checked = draft.optionIds.includes(option.id);
                  return (
                    <label data-selected={checked ? "" : undefined} key={option.id}>
                      <input
                        checked={checked}
                        name={question.id}
                        onChange={() => setAnswer(question, option.id)}
                        type={question.multiple === true ? "checkbox" : "radio"}
                      />
                      <span>
                        <strong>{option.label}</strong>
                        {option.recommended === true ? <small>Recommended</small> : null}
                      </span>
                      <span className="drever-studio-question__description">
                        {option.description}
                      </span>
                    </label>
                  );
                })}
              </div>
              <label className="drever-studio-question__custom">
                <span>Or add your own direction</span>
                <input
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [question.id]: {
                        ...(current[question.id] ?? { optionIds: [] }),
                        text: event.currentTarget.value,
                      },
                    }))
                  }
                  placeholder="Anything the agent should know?"
                  value={draft.text}
                />
              </label>
            </fieldset>
          );
        })}
        <footer className="drever-studio-brief__actions">
          <button
            className="drever-studio-button drever-studio-button--quiet"
            disabled={submitting}
            onClick={() => void skip()}
            type="button"
          >
            Skip remaining questions
          </button>
          <button
            className="drever-studio-button drever-studio-button--primary"
            disabled={submitting || resolvedAnswers.length !== questions.length}
            type="submit"
          >
            {submitting ? "Saving…" : "Create the storyboard"}
            <ArrowIcon />
          </button>
        </footer>
      </form>
    </main>
  );
};

const SlideCard = ({
  cardRef,
  index,
  onSelect,
  selected,
  slide,
}: Readonly<{
  cardRef(node: HTMLButtonElement | null): void;
  index: number;
  onSelect(): void;
  selected: boolean;
  slide: DreverDeckPlanSlide;
}>): ReactElement => (
  <button
    aria-current={selected ? "true" : undefined}
    aria-pressed={selected}
    className="drever-studio-plan-card"
    data-selected={selected ? "" : undefined}
    data-studio-slide-id={slide.id}
    id={`drever-studio-plan-card-${slide.id}`}
    onClick={onSelect}
    ref={cardRef}
    type="button"
  >
    <span className="drever-studio-plan-card__number">{String(index + 1).padStart(2, "0")}</span>
    <span className="drever-studio-plan-card__copy">
      <small>{sentenceCase(slide.job)}</small>
      <strong dir="auto">{slide.title}</strong>
      <span className="drever-studio-plan-card__purpose" dir="auto">
        {slide.purpose}
      </span>
    </span>
    <span className="drever-studio-plan-card__meta">
      {slide.composition.recipe}
      {slide.motion === undefined ? null : <i>{sentenceCase(slide.motion.intent)}</i>}
    </span>
  </button>
);

const FeedbackComposer = ({
  onAction,
  selectedSlide,
  state,
}: Readonly<{
  onAction: StudioProps["onAction"];
  selectedSlide?: DreverDeckPlanSlide;
  state: DreverStudioState;
}>): ReactElement => {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const scope = selectedSlide === undefined ? "Entire deck" : `Slide · ${selectedSlide.title}`;

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const next = message.trim();
    if (next === "") return;
    setSubmitting(true);
    try {
      await onAction({
        message: next,
        ...(selectedSlide === undefined ? {} : { slideId: selectedSlide.id }),
        type: "submit-feedback",
      });
      setMessage("");
    } catch {
      // Keep the draft feedback available after Studio reports the failure.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <aside className="drever-studio-direction">
      <header>
        <p>Direction</p>
        <span>{scope}</span>
      </header>
      {selectedSlide === undefined ? (
        <div className="drever-studio-direction__summary">
          <span>Audience</span>
          <strong dir="auto">{state.commonBrief?.audience ?? "Agent chooses"}</strong>
          <span>After the presentation</span>
          <strong dir="auto">{state.commonBrief?.desiredChange ?? "Agent proposes"}</strong>
        </div>
      ) : (
        <div className="drever-studio-direction__summary">
          <span>Focal artifact</span>
          <strong dir="auto">{selectedSlide.focalArtifact}</strong>
          <span>Evidence</span>
          <strong dir="auto">{selectedSlide.evidence.join(" · ")}</strong>
        </div>
      )}

      {state.activity === undefined ? null : (
        <section aria-label="Recent agent activity" className="drever-studio-direction__activity">
          <header>
            <span>Agent activity</span>
            <small>Live summary</small>
          </header>
          <ol aria-live="polite">
            {state.activity.slice(-4).map((item) => (
              <li data-status={item.status} key={item.id}>
                <i aria-hidden="true" />
                <div>
                  <strong dir="auto">{item.label}</strong>
                  {item.detail === undefined ? null : <p dir="auto">{item.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <form onSubmit={(event) => void submit(event)}>
        <label>
          <span>
            <CommentIcon />
            What should change?
          </span>
          <textarea
            onChange={(event) => setMessage(event.currentTarget.value)}
            placeholder={
              selectedSlide === undefined
                ? "Make the story more concrete and reduce repeated claims…"
                : "Keep the idea, but make the visual evidence easier to understand…"
            }
            rows={5}
            value={message}
          />
        </label>
        <button
          className="drever-studio-button drever-studio-button--primary"
          disabled={submitting || message.trim() === ""}
          type="submit"
        >
          {submitting ? "Sending…" : "Send to agent"}
          <ArrowIcon />
        </button>
      </form>

      {state.pendingActionCount === 0 ? null : (
        <p className="drever-studio-direction__pending">
          {state.pendingActionCount} {state.pendingActionCount === 1 ? "request" : "requests"}
          waiting for the agent
        </p>
      )}
    </aside>
  );
};

const PlanScreen = ({
  audienceUrl,
  onAction,
  previewUrl = audienceUrl,
  state,
}: StudioProps): ReactElement => {
  const plan = state.plan?.status === "awaiting-input" ? undefined : state.plan;
  const [selectedSlideId, setSelectedSlideId] = useState<string | undefined>();
  const draftAvailable = ["preview", "ready", "refining"].includes(state.phase);
  const [mode, setMode] = useState<StudioMode>(draftAvailable ? "draft" : "storyboard");
  const previousDraftAvailable = useRef(draftAvailable);
  const [approving, setApproving] = useState(false);
  const planRef = useRef<HTMLDivElement>(null);
  const slideElements = useRef(new Map<string, HTMLButtonElement>());
  const pendingScrollSlideId = useRef<string | undefined>(undefined);
  const selectedSlide = plan?.slides.find(({ id }) => id === selectedSlideId);
  const currentActivity = currentActivityFor(state);

  useEffect(() => {
    setMode((current) => nextStudioMode(current, previousDraftAvailable.current, draftAvailable));
    previousDraftAvailable.current = draftAvailable;
  }, [draftAvailable]);

  useEffect(() => {
    const slideId = pendingScrollSlideId.current;
    if (mode !== "storyboard" || slideId === undefined) return;
    const frame = requestAnimationFrame(() => {
      slideElements.current.get(slideId)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      pendingScrollSlideId.current = undefined;
    });
    return () => cancelAnimationFrame(frame);
  }, [mode, selectedSlideId]);

  const selectSlide = (slideId: string): void => {
    pendingScrollSlideId.current = slideId;
    setSelectedSlideId(slideId);
    setMode("storyboard");
  };

  const selectDeck = (): void => {
    setSelectedSlideId(undefined);
    setMode("storyboard");
    requestAnimationFrame(() => planRef.current?.scrollTo({ behavior: "smooth", top: 0 }));
  };

  const approve = async (): Promise<void> => {
    setApproving(true);
    try {
      await onAction({ type: "approve-plan" });
    } catch {
      // Studio owns the visible action error at the shared dispatch boundary.
    } finally {
      setApproving(false);
    }
  };

  if (plan === undefined) return <WaitingScreen state={state} />;

  return (
    <main className="drever-studio-workspace">
      <nav aria-label="Storyboard slides" className="drever-studio-rail">
        <header>
          <p>Story</p>
          <span>{plan.slides.length} slides</span>
        </header>
        <button
          className="drever-studio-rail__whole"
          data-selected={selectedSlideId === undefined ? "" : undefined}
          onClick={selectDeck}
          type="button"
        >
          <SparkIcon />
          Entire deck
        </button>
        <ol>
          {plan.slides.map((slide, index) => (
            <li key={slide.id}>
              <button
                aria-controls={`drever-studio-plan-card-${slide.id}`}
                aria-current={slide.id === selectedSlideId ? "true" : undefined}
                data-selected={slide.id === selectedSlideId ? "" : undefined}
                onClick={() => selectSlide(slide.id)}
                type="button"
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong dir="auto">{slide.title}</strong>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <section className="drever-studio-canvas">
        <header>
          <div className="drever-studio-mode-switcher">
            <button
              aria-pressed={mode === "storyboard"}
              onClick={() => setMode("storyboard")}
              type="button"
            >
              Storyboard
            </button>
            <button
              aria-pressed={mode === "draft"}
              disabled={!draftAvailable}
              onClick={() => setMode("draft")}
              type="button"
            >
              Live draft
            </button>
          </div>
          {plan.status === "awaiting-approval" ? (
            <button
              className="drever-studio-approve"
              disabled={approving || state.pendingActionCount > 0}
              onClick={() => void approve()}
              type="button"
            >
              {approving
                ? "Approving…"
                : state.pendingActionCount > 0
                  ? "Waiting for agent…"
                  : "Approve story"}
              <ArrowIcon />
            </button>
          ) : draftAvailable ? (
            <a href={audienceUrl} rel="noreferrer" target="_blank">
              Open audience
              <ExternalIcon />
            </a>
          ) : state.phase === "drafting" ? (
            <span>{state.progress?.label ?? "Draft 1 is being authored"}</span>
          ) : (
            <span>Approve the story before authoring</span>
          )}
        </header>

        {mode === "draft" && draftAvailable ? (
          <div className="drever-studio-preview">
            <iframe
              referrerPolicy="no-referrer"
              sandbox="allow-same-origin allow-scripts"
              src={previewUrl}
              title="Live Drever draft"
            />
          </div>
        ) : (
          <div className="drever-studio-plan" ref={planRef}>
            {state.phase === "drafting" ? (
              <section aria-live="polite" className="drever-studio-draft-status">
                <span aria-hidden="true">
                  <SparkIcon />
                </span>
                <div>
                  <small>Draft 1 is taking shape</small>
                  <strong dir="auto">
                    {currentActivity?.label ??
                      state.progress?.label ??
                      "Building the first preview"}
                  </strong>
                  <p dir="auto">
                    {currentActivity?.detail ??
                      state.message ??
                      "Studio will switch to the live deck as soon as the first complete preview is ready."}
                  </p>
                </div>
                {state.progress?.completed !== undefined && state.progress.total !== undefined ? (
                  <progress
                    aria-label={state.progress.label}
                    max={state.progress.total}
                    value={state.progress.completed}
                  />
                ) : (
                  <i aria-hidden="true" />
                )}
              </section>
            ) : null}
            <header>
              <div>
                <p>Structure preview</p>
                <h1 dir="auto" lang={plan.brief.language}>
                  {plan.brief.topic}
                </h1>
              </div>
              <span>Read the sequence before styling the slides.</span>
            </header>
            <div className="drever-studio-plan__cards">
              {plan.slides.map((slide, index) => (
                <SlideCard
                  cardRef={(node) => {
                    if (node === null) slideElements.current.delete(slide.id);
                    else slideElements.current.set(slide.id, node);
                  }}
                  index={index}
                  key={slide.id}
                  onSelect={() => setSelectedSlideId(slide.id)}
                  selected={slide.id === selectedSlideId}
                  slide={slide}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <FeedbackComposer
        onAction={onAction}
        {...(selectedSlide === undefined ? {} : { selectedSlide })}
        state={state}
      />
    </main>
  );
};

/** Development-only local control surface shared by any coding agent. */
export const Studio = (props: StudioProps): ReactElement => {
  const { state } = props;
  const [actionError, setActionError] = useState<string | undefined>();
  const commonBriefDone = (state.commonBrief?.topic.trim() ?? "") !== "";
  const hasQuestions = (state.adaptiveQuestions?.length ?? 0) > 0;
  const plan = state.plan?.status === "awaiting-input" ? undefined : state.plan;
  const screen = useMemo(() => {
    if (state.phase === "error") return "error";
    if (!commonBriefDone || state.phase === "briefing") return "brief";
    if (state.phase === "adaptive-questions" && hasQuestions) return "questions";
    if (plan !== undefined) return "plan";
    return "waiting";
  }, [commonBriefDone, hasQuestions, plan, state.phase]);
  const agentStatus =
    state.phase === "error"
      ? "Agent needs attention"
      : !state.agentConnected
        ? "No agent connected"
        : state.pendingActionCount > 0
          ? "Waiting for local agent"
          : "Local agent active recently";
  const dispatch = async (action: StudioActionInput): Promise<void> => {
    setActionError(undefined);
    try {
      await props.onAction(action);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "The Drever creation room could not save that change.",
      );
      throw error;
    }
  };

  return (
    <div
      className="drever-studio"
      data-agent-connected={state.agentConnected ? "" : undefined}
      data-drever-studio=""
      data-studio-phase={state.phase}
    >
      <header className="drever-studio-header">
        <StudioIdentity />
        <StudioProgress state={state} />
        <div aria-live="polite" className="drever-studio-agent-status">
          <span aria-hidden="true" />
          {agentStatus}
        </div>
      </header>
      {state.agentConnected || screen === "waiting" || screen === "error" ? null : (
        <AgentConnectionNotice />
      )}
      <StudioAgentApproval approvals={state.agentApprovals ?? []} onAction={dispatch} />
      {(screen === "questions" || screen === "plan") &&
      (state.activity !== undefined ||
        state.progress !== undefined ||
        state.message !== undefined) ? (
        <StudioActivityTicker state={state} />
      ) : null}
      {screen === "brief" ? <BriefScreen onAction={dispatch} state={state} /> : null}
      {screen === "questions" ? <QuestionsScreen onAction={dispatch} state={state} /> : null}
      {screen === "waiting" ? <WaitingScreen state={state} /> : null}
      {screen === "plan" ? <PlanScreen {...props} onAction={dispatch} /> : null}
      {screen === "error" ? <ErrorScreen state={state} /> : null}
      {actionError === undefined ? null : (
        <div aria-live="assertive" className="drever-studio-error" role="alert">
          {actionError}
        </div>
      )}
    </div>
  );
};

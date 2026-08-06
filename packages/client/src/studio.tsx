import {
  DECK_MANIFEST_VERSION,
  type DeckManifest,
  type DreverDeckPlanSlide,
  type DreverStudioAgentApprovalDecision,
  type DreverStudioAgentApprovalRequest,
  type DreverStudioAnswer,
  type DreverStudioActivity,
  type DreverStudioCommonBrief,
  type DreverStudioQuestion,
  type DreverStudioState,
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
  previewCapability?: string;
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

const ChevronIcon = (props: IconProps): ReactElement => (
  <svg aria-hidden="true" viewBox="0 0 20 20" {...props}>
    <path d="m6 8 4 4 4-4" />
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
type StudioFeedbackTarget = "deck" | "slide";
type StudioProgressStatus = "complete" | "current" | "error" | "pending";

export type StudioProgressStage = Readonly<{
  label: "Brief" | "Direction" | "Storyboard" | "Draft";
  status: StudioProgressStatus;
}>;

export type StudioPreviewState = Readonly<{
  manifest: DeckManifest;
  position: Readonly<{ slideId: string; slideIndex: number; step: number }>;
  type: "drever:studio-preview-state";
  version: 1;
}>;

type StudioPreviewConnection = "connected" | "connecting" | "unavailable";

const studioPreviewConnectAttempts = 16;

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

const progressLabels = ["Brief", "Direction", "Storyboard", "Draft"] as const;

const measurableStudioProgress = (
  progress: DreverStudioState["progress"],
): Readonly<{ completed: number; total: number }> | undefined =>
  progress?.completed !== undefined &&
  progress.total !== undefined &&
  Number.isFinite(progress.completed) &&
  Number.isFinite(progress.total) &&
  progress.completed > 0 &&
  progress.total > 0 &&
  progress.completed <= progress.total
    ? { completed: progress.completed, total: progress.total }
    : undefined;

const directionIsPending = (state: DreverStudioState): boolean =>
  state.pendingActionCount > 0 &&
  (state.phase === "waiting-for-agent" || state.phase === "adaptive-questions");

export const resolveStudioProgress = (state: DreverStudioState): readonly StudioProgressStage[] => {
  const hasBrief = state.phase !== "briefing" && (state.commonBrief?.topic.trim() ?? "") !== "";
  const directionInFlight = directionIsPending(state);
  const directionNeedsInput = state.plan?.status === "awaiting-input";
  const directionSubmitted =
    !directionInFlight &&
    !directionNeedsInput &&
    (state.skippedRemainingQuestions === true ||
      state.adaptiveAnswers !== undefined ||
      state.plan !== undefined);
  const storyboardApproved = !directionInFlight && state.plan?.status === "approved";
  const draftComplete = state.phase === "ready";
  const complete = [hasBrief, directionSubmitted, storyboardApproved, draftComplete];
  let current = complete.findIndex((value) => !value);
  if (current === -1) current = progressLabels.length - 1;

  return progressLabels.map((label, index) => ({
    label,
    status:
      state.phase === "error" && index === current
        ? "error"
        : complete[index] === true
          ? "complete"
          : index === current
            ? "current"
            : "pending",
  }));
};

const StudioProgress = ({ state }: Readonly<{ state: DreverStudioState }>): ReactElement => {
  const stages = resolveStudioProgress(state);
  return (
    <ol aria-label="Creation progress" className="drever-studio-progress">
      {stages.map((stage, index) => (
        <li
          aria-current={stage.status === "current" ? "step" : undefined}
          data-status={stage.status}
          key={stage.label}
        >
          <span>
            {stage.status === "complete" ? (
              <CheckIcon />
            ) : stage.status === "error" ? (
              "!"
            ) : (
              String(index + 1).padStart(2, "0")
            )}
          </span>
          {stage.label}
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

const plainStudioNarration = (value: string): string =>
  value
    .replace(/^\s*```(?:[\w-]+)?\s*$/u, "")
    .replace(/^\s*(?:>\s*)+/u, "")
    .replace(/^#{1,6}\s+/u, "")
    .replace(/^\s*(?:[-+*]|\d+[.)])\s+/u, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/`{1,3}([^`\n]+)`{1,3}/gu, "$1")
    .replace(/~~(\S(?:.*?\S)?)~~/gu, "$1")
    .replace(/(\*\*|__)(\S(?:.*?\S)?)\1/gu, "$2")
    .replace(/^(?:\*{1,3}|_{2,3})(?=\S)/u, "")
    .replace(/(?:\*{1,3}|_{2,3})$/u, "")
    .trim();

export const latestStudioNarration = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  if (normalized === undefined || normalized === "") return undefined;
  const plainText = normalized.split(/\n+/u).map(plainStudioNarration).filter(Boolean).at(-1);
  if (plainText === undefined) return undefined;
  if (plainText.length <= 220) return plainText;
  const tail = plainText.slice(-219);
  const firstSpace = tail.search(/\s/u);
  return `…${(firstSpace === -1 ? tail : tail.slice(firstSpace + 1)).trimStart()}`;
};

type StudioActivitySnapshot = Readonly<{
  active: boolean;
  current?: DreverStudioActivity;
  detail?: string;
  history: readonly DreverStudioActivity[];
}>;

export const resolveStudioActivity = (state: DreverStudioState): StudioActivitySnapshot => {
  const activity = activityFor(state);
  const current = activity.findLast(({ status }) => status === "active") ?? activity.at(-1);
  const detail = latestStudioNarration(state.message) ?? current?.detail;
  return {
    active: current?.status === "active" && state.agentConnected,
    ...(current === undefined ? {} : { current }),
    ...(detail === undefined ? {} : { detail }),
    history: current === undefined ? activity : activity.filter(({ id }) => id !== current.id),
  };
};

const StudioActivityHistory = ({
  activity,
}: Readonly<{ activity: readonly DreverStudioActivity[] }>): ReactElement | null => {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (activity.length === 0) return null;
  return (
    <section className="drever-studio-activity-history" data-open={open ? "" : undefined}>
      <button
        aria-controls={panelId}
        aria-expanded={open}
        className="drever-studio-activity-history__toggle"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        View history <span>{activity.length}</span>
        <ChevronIcon />
      </button>
      <div aria-hidden={!open} className="drever-studio-activity-history__reveal" id={panelId}>
        <div>
          <ol>
            {activity.map((item) => (
              <li data-status={item.status} key={item.id}>
                <i aria-hidden="true" />
                <div>
                  <strong dir="auto">{item.label}</strong>
                  {item.detail === undefined ? null : <p dir="auto">{item.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
};

const StudioActivityTicker = ({ state }: Readonly<{ state: DreverStudioState }>): ReactElement => {
  const activity = resolveStudioActivity(state);
  const label = activity.current?.label ?? state.progress?.label;

  return (
    <aside
      aria-label="Latest agent activity"
      className="drever-studio-live-update"
      data-active={activity.active ? "" : undefined}
    >
      <span aria-hidden="true" />
      <small>{activity.active ? "Agent working" : "Latest update"}</small>
      <div
        aria-atomic="true"
        aria-live="polite"
        className="drever-studio-live-update__current"
        data-studio-status-copy=""
        key={`${activity.current?.id ?? label ?? "idle"}:${activity.current?.status ?? "idle"}`}
      >
        <strong dir="auto">{label ?? "Studio is up to date"}</strong>
        {activity.detail === undefined || activity.detail === label ? null : (
          <p dir="auto">{activity.detail}</p>
        )}
      </div>
      <StudioActivityHistory activity={activity.history} />
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
  const [responseError, setResponseError] = useState<string>();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (approval === undefined || dialog === null) return;
    setResponseError(undefined);
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    return () => {
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      previousFocus.current?.focus();
    };
  }, [approval?.id]);
  if (approval === undefined) return null;
  const decisions = approval.decisions ?? ["accept", "acceptForSession", "decline"];

  const respond = async (decision: DreverStudioAgentApprovalDecision): Promise<void> => {
    setResponseError(undefined);
    setResponding(decision);
    try {
      await respondToStudioAgentApproval(onAction, approval.id, decision);
    } catch (error) {
      setResponseError(
        error instanceof Error
          ? error.message
          : "The local agent could not receive that approval response.",
      );
    } finally {
      setResponding(undefined);
    }
  };
  const dismissDecision = decisions.includes("cancel")
    ? "cancel"
    : decisions.includes("decline")
      ? "decline"
      : undefined;
  return (
    <dialog
      aria-labelledby={titleId}
      aria-modal="true"
      className="drever-studio-agent-approval"
      onCancel={(event) => {
        event.preventDefault();
        if (dismissDecision !== undefined && responding === undefined) {
          void respond(dismissDecision);
        }
      }}
      ref={dialogRef}
      role="alertdialog"
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
            autoFocus
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
      {responseError === undefined ? null : (
        <p className="drever-studio-agent-approval__error" role="alert">
          {responseError}
        </p>
      )}
    </dialog>
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
    <main className="drever-studio-brief" data-studio-screen="brief">
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
  const measurableProgress = measurableStudioProgress(progress);
  const nextMilestone =
    state.skippedRemainingQuestions === true || state.adaptiveAnswers !== undefined
      ? "Storyboard ready"
      : "Questions ready";
  const activity = resolveStudioActivity(state);
  const currentLabel =
    activity.current?.label ??
    (state.agentConnected
      ? (progress?.label ?? "Preparing the next step")
      : "Waiting for a local agent");

  return (
    <main className="drever-studio-waiting" data-studio-screen="waiting">
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

      <section aria-label="Agent activity" className="drever-studio-activity">
        <header>
          <span>Session activity</span>
          <small data-active={state.agentConnected ? "" : undefined}>
            <i aria-hidden="true" />
            {state.agentConnected ? "Live" : "Paused"}
          </small>
        </header>
        <div
          aria-atomic="true"
          aria-current={activity.active ? "step" : undefined}
          aria-live="polite"
          className="drever-studio-activity__current"
          data-status={activity.current?.status ?? "active"}
          key={`${activity.current?.id ?? currentLabel}:${activity.current?.status ?? "active"}`}
        >
          <span aria-hidden="true" className="drever-studio-activity__marker">
            {activity.current?.status === "complete" ? <CheckIcon /> : <SparkIcon />}
          </span>
          <div>
            <strong dir="auto">{currentLabel}</strong>
            <p dir="auto">
              {activity.detail ??
                (state.agentConnected
                  ? "The agent will publish another update as the work advances."
                  : "Resume the coding-agent task to continue.")}
            </p>
            {measurableProgress === undefined ? null : (
              <small>
                {measurableProgress.completed} of {measurableProgress.total}
              </small>
            )}
            {measurableProgress === undefined ? null : (
              <progress
                aria-label={progress?.label ?? currentLabel}
                max={measurableProgress.total}
                value={measurableProgress.completed}
              />
            )}
          </div>
        </div>
        <footer className="drever-studio-activity__next">
          <span>Next</span>
          <strong>{nextMilestone}</strong>
        </footer>
        <StudioActivityHistory activity={activity.history} />
      </section>
    </main>
  );
};

const ErrorScreen = ({
  onAction,
  state,
}: Readonly<{
  onAction: StudioProps["onAction"];
  state: DreverStudioState;
}>): ReactElement => {
  const [retrying, setRetrying] = useState(false);
  const retry = async (): Promise<void> => {
    if (state.commonBrief === undefined) return;
    setRetrying(true);
    try {
      await onAction({ brief: state.commonBrief, type: "submit-common-brief" });
    } catch {
      // Studio owns the visible action error at the shared dispatch boundary.
    } finally {
      setRetrying(false);
    }
  };
  return (
    <main
      aria-labelledby="drever-studio-error-title"
      className="drever-studio-waiting drever-studio-waiting--error"
      data-studio-screen="error"
    >
      <p>Agent needs attention</p>
      <h1 id="drever-studio-error-title">The draft paused.</h1>
      <span aria-live="assertive" role="alert">
        {state.message ??
          "Resolve the reported agent error, then continue from this Studio session."}
      </span>
      {state.commonBrief === undefined ? null : (
        <button
          className="drever-studio-button drever-studio-button--primary"
          disabled={retrying}
          onClick={() => void retry()}
          type="button"
        >
          {retrying ? "Retrying…" : "Retry from this brief"}
          <ArrowIcon />
        </button>
      )}
    </main>
  );
};

const AgentConnectionNotice = ({ state }: Readonly<{ state: DreverStudioState }>): ReactElement => {
  const resumable = state.agentConfigured === true;
  const awaitingReview = state.plan?.status === "awaiting-approval";
  return (
    <aside
      aria-live="polite"
      className="drever-studio-agent-notice"
      data-resumable={resumable ? "" : undefined}
    >
      <span aria-hidden="true" />
      <div>
        <strong>
          {resumable && awaitingReview
            ? "The agent is resting at the review gate."
            : resumable
              ? "The managed agent is ready to resume."
              : "No local agent is active."}
        </strong>
        <span>
          {resumable
            ? "Your session is preserved. The next Studio action reconnects the managed agent automatically."
            : "Studio does not run a model itself. Changes stay queued until the coding-agent task starts or resumes the Drever workflow."}
        </span>
      </div>
    </aside>
  );
};

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
    <main className="drever-studio-questions" data-studio-screen="questions">
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
  </button>
);

const FeedbackComposer = ({
  feedbackTarget,
  onAction,
  onFeedbackTargetChange,
  selectedSlide,
  state,
}: Readonly<{
  feedbackTarget: StudioFeedbackTarget;
  onAction: StudioProps["onAction"];
  onFeedbackTargetChange(target: StudioFeedbackTarget): void;
  selectedSlide?: DreverDeckPlanSlide;
  state: DreverStudioState;
}>): ReactElement => {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const contextId = useId();
  const headingId = useId();
  const targetDescriptionId = useId();
  const feedbackSlide = feedbackTarget === "slide" ? selectedSlide : undefined;
  const effectiveTarget = feedbackSlide === undefined ? "deck" : "slide";

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const next = message.trim();
    if (next === "") return;
    setSubmitting(true);
    try {
      await onAction({
        message: next,
        ...(feedbackSlide === undefined ? {} : { slideId: feedbackSlide.id }),
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
    <aside aria-labelledby={headingId} className="drever-studio-direction">
      <header>
        <h2 id={headingId}>Direction</h2>
        <div aria-label="Feedback scope" className="drever-studio-direction__scope" role="group">
          <button
            aria-pressed={effectiveTarget === "deck"}
            onClick={() => onFeedbackTargetChange("deck")}
            type="button"
          >
            Entire deck
          </button>
          <button
            aria-disabled={selectedSlide === undefined}
            aria-label={
              selectedSlide === undefined
                ? "This slide is still connecting"
                : `This slide: ${selectedSlide.title}`
            }
            aria-pressed={effectiveTarget === "slide"}
            onClick={() => {
              if (selectedSlide !== undefined) onFeedbackTargetChange("slide");
            }}
            type="button"
          >
            This slide
          </button>
        </div>
      </header>
      <p aria-live="polite" className="drever-studio-direction__target" id={targetDescriptionId}>
        {feedbackSlide === undefined
          ? "Feedback applies to the entire deck."
          : `Feedback applies to “${feedbackSlide.title}”`}
      </p>
      <section
        className="drever-studio-direction__context"
        data-open={contextOpen ? "" : undefined}
      >
        <button
          aria-controls={contextId}
          aria-expanded={contextOpen}
          onClick={() => setContextOpen((current) => !current)}
          type="button"
        >
          {feedbackSlide === undefined ? "Story context" : "Slide context"}
          <ChevronIcon />
        </button>
        <div
          aria-hidden={!contextOpen}
          className="drever-studio-direction__context-reveal"
          id={contextId}
        >
          <div>
            {feedbackSlide === undefined ? (
              <div className="drever-studio-direction__summary">
                <span>Audience</span>
                <strong dir="auto">{state.commonBrief?.audience ?? "Agent chooses"}</strong>
                <span>After the presentation</span>
                <strong dir="auto">{state.commonBrief?.desiredChange ?? "Agent proposes"}</strong>
              </div>
            ) : (
              <div className="drever-studio-direction__summary">
                <span>Anchor evidence</span>
                <strong dir="auto">{feedbackSlide.focalArtifact}</strong>
                <span>Evidence</span>
                <strong dir="auto">{feedbackSlide.evidence.join(" · ")}</strong>
              </div>
            )}
          </div>
        </div>
      </section>

      <form onSubmit={(event) => void submit(event)}>
        <label>
          <span>
            <CommentIcon />
            What should change?
          </span>
          <textarea
            aria-describedby={targetDescriptionId}
            onChange={(event) => setMessage(event.currentTarget.value)}
            placeholder={
              feedbackSlide === undefined
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
        <p aria-live="polite" className="drever-studio-direction__pending" role="status">
          {`${String(state.pendingActionCount)} ${
            state.pendingActionCount === 1 ? "request" : "requests"
          } waiting for the agent`}
        </p>
      )}
    </aside>
  );
};

type StudioDraftLifecycle = Readonly<{
  detail: string;
  status: "error" | "ready" | "working";
  title: string;
}>;

export const resolveStudioDraftLifecycle = (
  state: DreverStudioState,
): StudioDraftLifecycle | undefined => {
  const detail = latestStudioNarration(state.message);
  const disconnectedDraftWork =
    !state.agentConnected && (state.phase === "drafting" || state.phase === "refining");
  const agentWorkIsActive =
    state.agentConnected &&
    (state.pendingActionCount > 0 ||
      state.activity?.some(({ status }) => status === "active") === true);
  const firstDraftStarting =
    state.phase === "waiting-for-agent" &&
    state.plan?.status === "approved" &&
    state.draftAvailable !== true &&
    agentWorkIsActive;
  const laterDraftWorkStarting =
    state.phase === "waiting-for-agent" && state.draftAvailable === true && agentWorkIsActive;
  if (state.phase === "error" || disconnectedDraftWork) {
    return {
      detail:
        detail ??
        (state.draftAvailable === true
          ? "The last published draft remains available. Resume the managed agent before making further changes."
          : "The agent connection ended before Draft 1 was published. Retry from the approved story."),
      status: "error",
      title: state.draftAvailable === true ? "Refinement paused" : "The agent paused",
    };
  }
  if (
    state.phase === "drafting" ||
    state.phase === "refining" ||
    firstDraftStarting ||
    laterDraftWorkStarting
  ) {
    return {
      detail:
        detail ??
        (state.draftAvailable === true
          ? "This is a live work in progress. Layout and motion may change until this pass is ready."
          : "Studio will open the first reviewable preview as soon as it is published."),
      status: "working",
      title:
        state.draftAvailable === true
          ? "The agent is still refining this draft"
          : "Draft 1 is taking shape",
    };
  }
  if (state.phase === "preview") {
    return {
      detail: detail ?? "Review the live deck and send the agent any changes you want.",
      status: "ready",
      title: "Draft 1 is ready to review",
    };
  }
  if (state.phase === "ready") {
    return {
      detail: detail ?? "This pass is complete. Review it or send another direction.",
      status: "ready",
      title: "This pass is ready for your feedback",
    };
  }
  if (state.phase === "waiting-for-agent" && state.draftAvailable === true) {
    return {
      detail:
        detail ??
        (state.agentConnected
          ? "No refinement is active. Review the last published draft or send the agent new direction."
          : "The local agent is not connected, but the last published draft remains available for review."),
      status: "ready",
      title: "Last published draft is available",
    };
  }
  return undefined;
};

export const readStudioPreviewState = (value: unknown): StudioPreviewState | undefined => {
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = value as Partial<StudioPreviewState>;
  if (
    candidate.type !== "drever:studio-preview-state" ||
    candidate.version !== 1 ||
    typeof candidate.manifest !== "object" ||
    candidate.manifest === null ||
    candidate.manifest.version !== DECK_MANIFEST_VERSION ||
    !Array.isArray(candidate.manifest.slides) ||
    !candidate.manifest.slides.every(
      (slide) =>
        typeof slide === "object" &&
        slide !== null &&
        typeof slide.id === "string" &&
        Number.isSafeInteger(slide.index) &&
        Array.isArray(slide.stepStops) &&
        slide.stepStops.every(Number.isSafeInteger) &&
        Array.isArray(slide.speakerNotes) &&
        slide.speakerNotes.every(
          (note: unknown) =>
            typeof note === "object" &&
            note !== null &&
            "format" in note &&
            note.format === "markdown" &&
            "plainText" in note &&
            typeof note.plainText === "string" &&
            "value" in note &&
            typeof note.value === "string",
        ),
    ) ||
    typeof candidate.position !== "object" ||
    candidate.position === null ||
    !Number.isSafeInteger(candidate.position.slideIndex) ||
    !Number.isSafeInteger(candidate.position.step) ||
    typeof candidate.position.slideId !== "string"
  ) {
    return undefined;
  }
  const slide = candidate.manifest.slides[candidate.position.slideIndex];
  return slide?.id === candidate.position.slideId ? (candidate as StudioPreviewState) : undefined;
};

export const isStudioPreviewReady = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  "type" in value &&
  value.type === "drever:studio-preview-ready" &&
  "version" in value &&
  value.version === 1;

export const resolveStudioPlanSlideId = (
  slides: readonly DreverDeckPlanSlide[] | undefined,
  runtimeSlideIndex: number,
): string | undefined => slides?.[runtimeSlideIndex]?.id;

const StudioDraftStatus = ({
  onAction,
  state,
}: Readonly<{
  onAction: StudioProps["onAction"];
  state: DreverStudioState;
}>): ReactElement | null => {
  const lifecycle = resolveStudioDraftLifecycle(state);
  const [resuming, setResuming] = useState(false);
  if (lifecycle === undefined) return null;
  const canResumeDraft = state.draftAvailable === true;
  const activity = resolveStudioActivity(state);
  const activityHistory = lifecycle.status === "working" ? activity.history : activityFor(state);
  const measurableProgress = measurableStudioProgress(state.progress);
  const progressLabel =
    lifecycle.status === "working"
      ? activity.current?.status === "active"
        ? activity.current.label
        : state.progress?.label
      : undefined;
  const resume = async (): Promise<void> => {
    setResuming(true);
    try {
      await onAction({
        message: canResumeDraft
          ? "Resume from the last published draft. Preserve its working layout and fix the reported failure before making further changes."
          : "Retry Draft 1 from the approved storyboard. Reuse the accepted story and report the concrete failure if authoring pauses again.",
        type: "submit-feedback",
      });
    } catch {
      // Studio owns the visible action error at the shared dispatch boundary.
    } finally {
      setResuming(false);
    }
  };
  return (
    <section className="drever-studio-draft-status" data-status={lifecycle.status}>
      <span aria-hidden="true">
        <SparkIcon />
      </span>
      <div
        aria-atomic="true"
        aria-live={lifecycle.status === "error" ? "assertive" : "polite"}
        data-studio-status-copy=""
        key={`${lifecycle.status}:${lifecycle.title}:${activity.current?.id ?? "idle"}`}
        role={lifecycle.status === "error" ? "alert" : "status"}
      >
        <small>
          {lifecycle.status === "working"
            ? "Live work in progress"
            : lifecycle.status === "error"
              ? "Action needed"
              : "Review point"}
        </small>
        <strong dir="auto">{lifecycle.title}</strong>
        <p dir="auto">
          {progressLabel === undefined
            ? lifecycle.detail
            : `${progressLabel} · ${lifecycle.detail}`}
        </p>
      </div>
      {lifecycle.status === "working" ? (
        measurableProgress === undefined ? (
          <i aria-hidden="true" />
        ) : (
          <progress
            aria-label={state.progress?.label ?? progressLabel ?? lifecycle.title}
            max={measurableProgress.total}
            value={measurableProgress.completed}
          />
        )
      ) : null}
      {lifecycle.status === "error" ? (
        <button
          className="drever-studio-draft-status__resume"
          disabled={resuming}
          onClick={() => void resume()}
          type="button"
        >
          {resuming
            ? canResumeDraft
              ? "Resuming…"
              : "Retrying…"
            : canResumeDraft
              ? "Resume from last draft"
              : "Retry Draft 1"}
        </button>
      ) : null}
      <StudioActivityHistory activity={activityHistory} />
    </section>
  );
};

const PlanScreen = ({
  audienceUrl,
  onAction,
  previewCapability,
  previewUrl = audienceUrl,
  state,
}: StudioProps): ReactElement => {
  const plan = state.plan?.status === "awaiting-input" ? undefined : state.plan;
  const [selectedSlideId, setSelectedSlideId] = useState<string | undefined>();
  const draftAvailable =
    state.draftAvailable === true || state.phase === "preview" || state.phase === "ready";
  const [mode, setMode] = useState<StudioMode>(draftAvailable ? "draft" : "storyboard");
  const [feedbackScope, setFeedbackScope] = useState<StudioFeedbackTarget>(
    draftAvailable ? "slide" : "deck",
  );
  const previousDraftAvailable = useRef(draftAvailable);
  const [approving, setApproving] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [previewState, setPreviewState] = useState<StudioPreviewState>();
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [previewConnection, setPreviewConnection] = useState<StudioPreviewConnection>("connecting");
  const planRef = useRef<HTMLDivElement>(null);
  const slideElements = useRef(new Map<string, HTMLButtonElement>());
  const pendingPreviewSlideIndex = useRef<number | undefined>(undefined);
  const selectedSlide =
    selectedSlideId === undefined
      ? undefined
      : plan?.slides.find(({ id }) => id === selectedSlideId);
  const selectedSlideIndex = plan?.slides.findIndex(({ id }) => id === selectedSlideId) ?? -1;
  const previewOrigin = useMemo(
    () => new URL(previewUrl, audienceUrl).origin,
    [audienceUrl, previewUrl],
  );
  const lifecycle = resolveStudioDraftLifecycle(state);

  useEffect(() => {
    if (!previousDraftAvailable.current && draftAvailable) setFeedbackScope("slide");
    setMode((current) => nextStudioMode(current, previousDraftAvailable.current, draftAvailable));
    previousDraftAvailable.current = draftAvailable;
  }, [draftAvailable]);

  useEffect(() => {
    const receivePreviewState = (event: MessageEvent): void => {
      if (event.source !== iframeRef.current?.contentWindow || event.origin !== previewOrigin)
        return;
      if (isStudioPreviewReady(event.data)) {
        if (previewCapability !== undefined) {
          iframeRef.current?.contentWindow?.postMessage(
            {
              capability: previewCapability,
              type: "drever:studio-preview-connect",
              version: 1,
            },
            previewOrigin,
          );
        }
        return;
      }
      const previewState = readStudioPreviewState(event.data);
      if (previewState === undefined) return;
      setPreviewState(previewState);
      setPreviewConnection("connected");
      const pendingSlideIndex = pendingPreviewSlideIndex.current;
      if (
        pendingSlideIndex === undefined ||
        pendingSlideIndex === previewState.position.slideIndex
      ) {
        pendingPreviewSlideIndex.current = undefined;
        setSelectedSlideId(
          resolveStudioPlanSlideId(plan?.slides, previewState.position.slideIndex),
        );
      }
    };
    globalThis.addEventListener("message", receivePreviewState);
    return () => globalThis.removeEventListener("message", receivePreviewState);
  }, [plan?.slides, previewCapability, previewOrigin]);

  const postPreviewMessage = (message: Readonly<Record<string, unknown>>): void => {
    iframeRef.current?.contentWindow?.postMessage(message, previewOrigin);
  };

  useEffect(() => {
    setPreviewState(undefined);
    setPreviewLoaded(false);
    setPreviewConnection("connecting");
    pendingPreviewSlideIndex.current = undefined;
  }, [previewOrigin]);

  useEffect(() => {
    if (mode !== "draft" || !draftAvailable || !previewLoaded || previewState !== undefined) return;
    if (previewCapability === undefined) {
      setPreviewConnection("unavailable");
      return;
    }
    let attempt = 0;
    let timeout: number | undefined;
    const connect = (): void => {
      const frame = iframeRef.current;
      if (frame === null) return;
      frame.contentWindow?.postMessage(
        {
          capability: previewCapability,
          type: "drever:studio-preview-connect",
          version: 1,
        },
        previewOrigin,
      );
      attempt += 1;
      if (attempt >= studioPreviewConnectAttempts) {
        setPreviewConnection("unavailable");
        return;
      }
      timeout = globalThis.setTimeout(connect, Math.min(200 * 2 ** (attempt - 1), 1_200));
    };
    connect();
    return () => {
      if (timeout !== undefined) globalThis.clearTimeout(timeout);
    };
  }, [draftAvailable, mode, previewCapability, previewLoaded, previewOrigin, previewState]);

  useEffect(() => {
    const slideIndex = pendingPreviewSlideIndex.current;
    if (mode !== "draft" || previewConnection !== "connected" || slideIndex === undefined) return;
    postPreviewMessage({
      capability: previewCapability,
      slideIndex,
      type: "drever:studio-preview-navigate",
      version: 1,
    });
  }, [mode, previewCapability, previewConnection]);

  const scrollStoryboardSlide = (slideId: string): void => {
    requestAnimationFrame(() => {
      slideElements.current.get(slideId)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  };

  const selectSlide = (slideId: string, slideIndex: number): void => {
    setFeedbackScope("slide");
    if (mode === "draft" && draftAvailable) {
      setSelectedSlideId(resolveStudioPlanSlideId(plan?.slides, slideIndex));
      if (previewConnection !== "connected") {
        pendingPreviewSlideIndex.current = slideIndex;
        return;
      }
      pendingPreviewSlideIndex.current = undefined;
      postPreviewMessage({
        capability: previewCapability,
        slideIndex,
        type: "drever:studio-preview-navigate",
        version: 1,
      });
      return;
    }
    setSelectedSlideId(slideId);
    scrollStoryboardSlide(slideId);
  };

  const selectDeck = (): void => {
    setFeedbackScope("deck");
    if (mode === "storyboard") {
      setSelectedSlideId(undefined);
      requestAnimationFrame(() => planRef.current?.scrollTo({ behavior: "smooth", top: 0 }));
    }
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
  const railSlides =
    mode === "draft" && previewState !== undefined
      ? previewState.manifest.slides.map((slide) => ({
          id: slide.id,
          title: slide.title ?? `Slide ${String(slide.index + 1)}`,
        }))
      : plan.slides;
  const previewSlide = previewState?.manifest.slides[previewState.position.slideIndex];
  const previewNotes =
    previewSlide?.speakerNotes
      .map(({ plainText }) => plainText)
      .filter(Boolean)
      .join("\n\n") ||
    (previewSlide === undefined
      ? "Connecting to speaker notes…"
      : "No speaker notes for this slide yet.");
  return (
    <main className="drever-studio-workspace" data-studio-screen="plan">
      <nav aria-label="Presentation slides" className="drever-studio-rail" data-mode={mode}>
        <header>
          <p>{mode === "draft" ? "Live draft" : "Story"}</p>
          <span>{railSlides.length} slides</span>
        </header>
        {mode === "storyboard" ? (
          <button
            aria-pressed={feedbackScope === "deck"}
            className="drever-studio-rail__whole"
            data-selected={feedbackScope === "deck" ? "" : undefined}
            onClick={selectDeck}
            type="button"
          >
            <SparkIcon />
            Entire deck
          </button>
        ) : null}
        <ol>
          {railSlides.map((slide, index) => {
            const current =
              mode === "draft" ? index === selectedSlideIndex : slide.id === selectedSlideId;
            const selected = mode === "draft" ? current : feedbackScope === "slide" && current;
            return (
              <li key={slide.id}>
                <button
                  aria-controls={
                    mode === "draft"
                      ? "drever-studio-live-draft"
                      : `drever-studio-plan-card-${slide.id}`
                  }
                  aria-current={current ? (mode === "draft" ? "page" : "true") : undefined}
                  data-selected={selected ? "" : undefined}
                  onClick={() => selectSlide(slide.id, index)}
                  type="button"
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong dir="auto">{slide.title}</strong>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="drever-studio-canvas">
        <header>
          <div className="drever-studio-mode-switcher">
            <button
              aria-pressed={mode === "storyboard"}
              onClick={() => {
                setMode("storyboard");
                if (feedbackScope === "deck") selectDeck();
                else if (selectedSlideId !== undefined) scrollStoryboardSlide(selectedSlideId);
              }}
              type="button"
            >
              Storyboard
            </button>
            <button
              aria-pressed={mode === "draft"}
              disabled={!draftAvailable}
              onClick={() => {
                setMode("draft");
                setFeedbackScope("slide");
              }}
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
          ) : lifecycle?.status === "working" ? (
            <span
              className="drever-studio-canvas__status"
              data-studio-status-copy=""
              key={`working:${state.progress?.label ?? lifecycle.title}`}
            >
              {state.progress?.label ?? lifecycle.title}
            </span>
          ) : lifecycle?.status === "error" ? (
            <span
              className="drever-studio-canvas__status"
              data-studio-status-copy=""
              key={`error:${lifecycle.title}`}
            >
              {lifecycle.title}
            </span>
          ) : plan.status === "approved" ? (
            <span
              className="drever-studio-canvas__status"
              data-studio-status-copy=""
              key="waiting-for-draft"
            >
              Waiting for the agent to start Draft 1
            </span>
          ) : (
            <span
              className="drever-studio-canvas__status"
              data-studio-status-copy=""
              key="approval-needed"
            >
              Approve the story before authoring
            </span>
          )}
        </header>

        {mode === "draft" && draftAvailable ? (
          <div
            aria-busy={lifecycle?.status === "working"}
            className="drever-studio-preview"
            data-studio-panel="draft"
            id="drever-studio-live-draft"
          >
            <StudioDraftStatus onAction={onAction} state={state} />
            <div className="drever-studio-preview__frame">
              <iframe
                allow="fullscreen"
                allowFullScreen
                onLoad={() => {
                  setPreviewState(undefined);
                  setPreviewConnection("connecting");
                  setPreviewLoaded(true);
                }}
                ref={iframeRef}
                referrerPolicy="no-referrer"
                sandbox="allow-same-origin allow-scripts"
                src={previewUrl}
                title="Live Drever draft"
              />
            </div>
            <aside aria-live="polite" className="drever-studio-preview__notes">
              <small>
                Speaker notes
                {previewState === undefined
                  ? null
                  : ` · Slide ${previewState.position.slideIndex + 1}`}
              </small>
              <p
                data-studio-status-copy=""
                dir="auto"
                key={previewState?.position.slideId ?? "connecting"}
              >
                {previewNotes}
              </p>
              {previewConnection === "unavailable" ? (
                <em>The live slide connection paused. Reload this preview to reconnect.</em>
              ) : null}
            </aside>
          </div>
        ) : (
          <div className="drever-studio-plan" data-studio-panel="storyboard" ref={planRef}>
            <StudioDraftStatus onAction={onAction} state={state} />
            <header>
              <div>
                <p>Structure preview</p>
                <h1 dir="auto" lang={plan.brief.language}>
                  {plan.brief.topic}
                </h1>
              </div>
              <span
                data-studio-status-copy=""
                key={state.pendingActionCount > 0 ? "draft" : "stable"}
              >
                {state.pendingActionCount > 0
                  ? "A first sequence is ready now. Review it before research and styling begin."
                  : "Read the sequence before styling the slides."}
              </span>
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
                  onSelect={() => {
                    setFeedbackScope("slide");
                    setSelectedSlideId(slide.id);
                  }}
                  selected={slide.id === selectedSlideId}
                  slide={slide}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <FeedbackComposer
        feedbackTarget={feedbackScope}
        onAction={onAction}
        onFeedbackTargetChange={(target) => {
          setFeedbackScope(target);
          if (target === "deck" && mode === "storyboard") setSelectedSlideId(undefined);
        }}
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
  const plan =
    state.plan?.status === "awaiting-input" || directionIsPending(state) ? undefined : state.plan;
  const screen = useMemo(() => {
    if (state.phase === "error" && plan === undefined) return "error";
    if (!commonBriefDone || state.phase === "briefing") return "brief";
    if (state.phase === "adaptive-questions" && hasQuestions) return "questions";
    if (plan !== undefined) return "plan";
    return "waiting";
  }, [commonBriefDone, hasQuestions, plan, state.phase]);
  const waitingForReview =
    state.plan?.status === "awaiting-approval" && state.pendingActionCount === 0;
  const agentStatus = waitingForReview
    ? "Waiting for your review"
    : state.phase === "error"
      ? "Agent needs attention"
      : !state.agentConnected
        ? state.agentConfigured === true
          ? "Agent ready to resume"
          : "No agent connected"
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
          <i aria-hidden="true" />
          <span data-studio-status-copy="" key={agentStatus}>
            {agentStatus}
          </span>
        </div>
      </header>
      {state.agentConnected || screen === "waiting" || screen === "error" ? null : (
        <AgentConnectionNotice state={state} />
      )}
      <StudioAgentApproval approvals={state.agentApprovals ?? []} onAction={dispatch} />
      {screen === "questions" &&
      (state.activity !== undefined ||
        state.progress !== undefined ||
        state.message !== undefined) ? (
        <StudioActivityTicker state={state} />
      ) : null}
      {screen === "brief" ? <BriefScreen onAction={dispatch} state={state} /> : null}
      {screen === "questions" ? <QuestionsScreen onAction={dispatch} state={state} /> : null}
      {screen === "waiting" ? <WaitingScreen state={state} /> : null}
      {screen === "plan" ? <PlanScreen {...props} onAction={dispatch} /> : null}
      {screen === "error" ? <ErrorScreen onAction={dispatch} state={state} /> : null}
      {actionError === undefined ? null : (
        <div aria-live="assertive" className="drever-studio-error" role="alert">
          {actionError}
        </div>
      )}
    </div>
  );
};

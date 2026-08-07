import {
  DECK_MANIFEST_VERSION,
  type CanvasDefinition,
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
  type RefObject,
  type SVGProps,
} from "react";
import { DEFAULT_CANVAS } from "./canvas.tsx";

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

const CloseIcon = (props: IconProps): ReactElement => (
  <svg aria-hidden="true" viewBox="0 0 20 20" {...props}>
    <path d="m5.5 5.5 9 9m0-9-9 9" />
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

const durationOptions = [5, 10, 15, 30] as const;

type DensityChoice = NonNullable<DreverStudioCommonBrief["density"]>;
type MotionChoice = "agent-choice" | NonNullable<DreverStudioCommonBrief["motionIntensity"]>;
type StudioMode = "draft" | "storyboard";
type StudioFeedbackTarget = "deck" | "slide";
type StudioProgressStatus = "complete" | "current" | "error" | "pending";
type StudioStep = "brief" | "direction" | "draft" | "storyboard";

export type StudioProgressStage = Readonly<{
  label: "Brief" | "Direction" | "Storyboard" | "Draft";
  status: StudioProgressStatus;
}>;

type StudioStepAvailability = Readonly<Record<StudioStep, boolean>>;

export type StudioPreviewState = Readonly<{
  canvas?: CanvasDefinition;
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

const comparableStudioAnswers = (answers: readonly DreverStudioAnswer[]) =>
  answers
    .map((answer) => ({
      optionIds: [...(answer.optionIds ?? [])].sort(),
      questionId: answer.questionId,
      text: answer.text?.trim() ?? "",
    }))
    .sort((left, right) => left.questionId.localeCompare(right.questionId));

export const studioAnswersMatch = (
  left: readonly DreverStudioAnswer[],
  right: readonly DreverStudioAnswer[],
): boolean =>
  JSON.stringify(comparableStudioAnswers(left)) === JSON.stringify(comparableStudioAnswers(right));

export const submitStudioBrief = async (
  onAction: StudioProps["onAction"],
  brief: DreverStudioCommonBrief,
  skipRemaining: boolean,
): Promise<void> => {
  await onAction({ brief, type: "submit-common-brief" });
  if (skipRemaining) await onAction({ type: "skip-remaining-questions" });
};

const comparableStudioBrief = (brief: DreverStudioCommonBrief) => ({
  audience: brief.audience?.trim() ?? "",
  density: brief.density ?? "balanced",
  desiredChange: brief.desiredChange?.trim() ?? "",
  durationMinutes: brief.durationMinutes ?? 10,
  language: brief.language ?? "",
  motionIntensity: brief.motionIntensity ?? "agent-choice",
  topic: brief.topic.trim(),
});

export const studioBriefsMatch = (
  left: DreverStudioCommonBrief,
  right: DreverStudioCommonBrief,
): boolean =>
  JSON.stringify(comparableStudioBrief(left)) === JSON.stringify(comparableStudioBrief(right));

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

export const isStudioArtifactOutdated = (state: DreverStudioState, mode: StudioMode): boolean =>
  mode === "draft"
    ? state.draftOutdated === true || state.storyboardOutdated === true
    : state.storyboardOutdated === true;

const sentenceCase = (value: string): string =>
  value
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const RevisionConfirmation = ({
  busy,
  confirmLabel = "Update and rebuild",
  detail,
  eyebrow = "Earlier step changed",
  onCancel,
  onConfirm,
  title,
}: Readonly<{
  busy: boolean;
  confirmLabel?: string;
  detail: string;
  eyebrow?: string;
  onCancel(): void;
  onConfirm(): void;
  title: string;
}>): ReactElement => {
  const headingId = useId();
  const detailId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      if (dialog?.open === true) dialog.close();
    };
  }, []);
  return (
    <dialog
      aria-describedby={detailId}
      aria-labelledby={headingId}
      aria-modal="true"
      className="drever-studio-revision-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      ref={dialogRef}
      role="alertdialog"
    >
      <span aria-hidden="true">
        <SparkIcon />
      </span>
      <div>
        <small>{eyebrow}</small>
        <strong id={headingId}>{title}</strong>
        <p id={detailId}>{detail}</p>
      </div>
      <footer>
        <button
          autoFocus
          className="drever-studio-button drever-studio-button--quiet"
          disabled={busy}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className="drever-studio-button drever-studio-button--primary"
          disabled={busy}
          onClick={onConfirm}
          type="button"
        >
          {busy ? "Updating…" : confirmLabel}
          <ArrowIcon />
        </button>
      </footer>
    </dialog>
  );
};

const SelectionSurface = ({ value }: Readonly<{ value: number | string }>): ReactElement => {
  const surfaceRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const surface = surfaceRef.current;
    const group = surface?.parentElement;
    if (surface === null || group === null || group === undefined) return;

    const moveToSelection = (): void => {
      const selected = group.querySelector<HTMLElement>("[data-selected]");
      if (selected === null) {
        surface.removeAttribute("data-visible");
        return;
      }
      surface.style.width = `${selected.offsetWidth}px`;
      surface.style.height = `${selected.offsetHeight}px`;
      surface.style.transform = `translate3d(${selected.offsetLeft}px, ${selected.offsetTop}px, 0)`;
      surface.setAttribute("data-visible", "");
    };

    moveToSelection();
    const view = group.ownerDocument.defaultView;
    if (view === null) return;
    const readyFrame = view.requestAnimationFrame(() => surface.setAttribute("data-ready", ""));
    const observer = new view.ResizeObserver(moveToSelection);
    observer.observe(group);
    return () => {
      view.cancelAnimationFrame(readyFrame);
      observer.disconnect();
    };
  }, [value]);

  return <span aria-hidden="true" className="drever-studio-selection-surface" ref={surfaceRef} />;
};

const ChoiceGroup = <Value extends string>({
  disabled = false,
  label,
  onChange,
  options,
  value,
}: Readonly<{
  disabled?: boolean;
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
    <div className="drever-studio-choice-grid" data-option-count={options.length}>
      <SelectionSurface value={value} />
      {options.map((option) => (
        <label data-selected={value === option.id ? "" : undefined} key={option.id}>
          <input
            checked={value === option.id}
            disabled={disabled}
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
    <strong>Studio</strong>
  </div>
);

const studioSteps = [
  { label: "Brief", step: "brief" },
  { label: "Direction", step: "direction" },
  { label: "Storyboard", step: "storyboard" },
  { label: "Draft", step: "draft" },
] as const satisfies readonly Readonly<{ label: StudioProgressStage["label"]; step: StudioStep }>[];

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
  const directionNeedsInput =
    state.phase === "adaptive-questions" || state.plan?.status === "awaiting-input";
  const directionSubmitted =
    !directionInFlight &&
    !directionNeedsInput &&
    (state.skippedRemainingQuestions === true ||
      state.adaptiveAnswers !== undefined ||
      (state.storyboardOutdated !== true && state.plan !== undefined));
  const storyboardApproved =
    !directionInFlight && state.storyboardOutdated !== true && state.plan?.status === "approved";
  const draftComplete = state.phase === "ready" && state.draftOutdated !== true;
  const complete = [hasBrief, directionSubmitted, storyboardApproved, draftComplete];
  let current = complete.findIndex((value) => !value);
  if (current === -1) current = studioSteps.length - 1;

  return studioSteps.map(({ label }, index) => ({
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

export const resolveStudioWorkflowStep = (state: DreverStudioState): StudioStep => {
  const stages = resolveStudioProgress(state);
  const current = stages.findIndex(({ status }) => status === "current" || status === "error");
  return studioSteps[current === -1 ? studioSteps.length - 1 : current]?.step ?? "brief";
};

export const resolveStudioStepAvailability = (
  state: DreverStudioState,
): StudioStepAvailability => ({
  brief: true,
  direction:
    state.commonBrief !== undefined &&
    ((state.adaptiveQuestions?.length ?? 0) > 0 ||
      state.adaptiveAnswers !== undefined ||
      state.skippedRemainingQuestions === true ||
      state.plan !== undefined),
  storyboard: state.plan !== undefined && state.plan.status !== "awaiting-input",
  draft: state.draftAvailable === true || state.phase === "preview" || state.phase === "ready",
});

const StudioProgress = ({
  onStepSelect,
  state,
  viewedStep,
  workflowStep,
}: Readonly<{
  onStepSelect(step: StudioStep): void;
  state: DreverStudioState;
  viewedStep?: StudioStep;
  workflowStep: StudioStep;
}>): ReactElement => {
  const stages = resolveStudioProgress(state);
  const availability = resolveStudioStepAvailability(state);
  return (
    <ol aria-label="Creation progress" className="drever-studio-progress">
      {stages.map((stage, index) => {
        const step = studioSteps[index]?.step ?? "brief";
        const outdated =
          (step === "storyboard" && state.storyboardOutdated === true) ||
          (step === "draft" && state.draftOutdated === true);
        return (
          <li
            data-outdated={outdated ? "" : undefined}
            data-status={stage.status}
            data-viewing={viewedStep === step ? "" : undefined}
            key={stage.label}
          >
            <button
              aria-current={workflowStep === step ? "step" : undefined}
              aria-label={`${outdated ? "View previous" : "View"} ${stage.label}`}
              aria-pressed={viewedStep === step}
              disabled={!availability[step]}
              onClick={() => onStepSelect(step)}
              type="button"
            >
              <span className="drever-studio-progress__marker">
                {stage.status === "complete" ? (
                  <CheckIcon />
                ) : stage.status === "error" ? (
                  "!"
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              <strong className="drever-studio-progress__label">{stage.label}</strong>
            </button>
          </li>
        );
      })}
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

const replaceMarkdownReferences = (
  value: string,
  prefix: "![" | "[",
  allowEmptyLabel: boolean,
): string => {
  let cursor = 0;
  const plainText: string[] = [];

  while (cursor < value.length) {
    const referenceStart = value.indexOf(prefix, cursor);
    if (referenceStart === -1) {
      plainText.push(value.slice(cursor));
      break;
    }

    plainText.push(value.slice(cursor, referenceStart));
    const labelStart = referenceStart + prefix.length;
    const labelEnd = value.indexOf("]", labelStart);
    if (labelEnd === -1) {
      plainText.push(value.slice(referenceStart));
      break;
    }

    if (!allowEmptyLabel && labelEnd === labelStart) {
      plainText.push(prefix);
      cursor = labelStart;
      continue;
    }

    if (value[labelEnd + 1] !== "(") {
      plainText.push(value.slice(referenceStart, labelEnd + 1));
      cursor = labelEnd + 1;
      continue;
    }

    const destinationEnd = value.indexOf(")", labelEnd + 2);
    if (destinationEnd === -1) {
      plainText.push(value.slice(referenceStart));
      break;
    }

    plainText.push(value.slice(labelStart, labelEnd));
    cursor = destinationEnd + 1;
  }

  return plainText.join("");
};

const stripMarkdownLinks = (value: string): string =>
  replaceMarkdownReferences(replaceMarkdownReferences(value, "![", true), "[", false);

const plainStudioNarration = (value: string): string =>
  stripMarkdownLinks(value)
    .replace(/^\s*```(?:[\w-]+)?\s*$/u, "")
    .replace(/^\s*(?:>\s*)+/u, "")
    .replace(/^#{1,6}\s+/u, "")
    .replace(/^\s*(?:[-+*]|\d+[.)])\s+/u, "")
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
  presentation = "inline",
}: Readonly<{
  activity: readonly DreverStudioActivity[];
  presentation?: "inline" | "popover-end" | "popover-start";
}>): ReactElement | null => {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (activity.length === 0) return null;
  return (
    <section
      className="drever-studio-activity-history"
      data-open={open ? "" : undefined}
      data-presentation={presentation}
    >
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
      <StudioActivityHistory activity={activity.history} presentation="popover-end" />
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
  onDirtyChange,
  onReturnToWorkflow,
  reviewing,
  state,
}: Readonly<{
  onAction: StudioProps["onAction"];
  onDirtyChange(dirty: boolean): void;
  onReturnToWorkflow(): void;
  reviewing: boolean;
  state: DreverStudioState;
}>): ReactElement => {
  const existing = state.commonBrief;
  const existingKey = JSON.stringify(existing);
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
  const [pendingUpdate, setPendingUpdate] = useState<
    Readonly<{ brief: DreverStudioCommonBrief; skipRemaining: boolean }> | undefined
  >();
  const durationMinutes =
    durationChoice === "custom" ? resolveStudioDuration(customDuration) : durationChoice;
  const revisionBusy =
    reviewing &&
    (state.pendingActionCount > 0 ||
      (state.agentConnected && (state.phase === "drafting" || state.phase === "refining")));

  useEffect(() => {
    if (existing === undefined) return;
    const nextDuration = existing.durationMinutes ?? 10;
    const nextPreset = durationOptions.find((duration) => duration === nextDuration);
    setTopic(existing.topic);
    setAudience(existing.audience ?? "");
    setDesiredChange(existing.desiredChange ?? "");
    setDurationChoice(nextPreset ?? "custom");
    setCustomDuration(nextPreset === undefined ? String(nextDuration) : "");
    setDensity(existing.density ?? "balanced");
    setMotion(existing.motionIntensity ?? "agent-choice");
    setPendingUpdate(undefined);
  }, [existingKey]);

  const currentBrief = (): DreverStudioCommonBrief | undefined => {
    if (topic.trim() === "" || durationMinutes === undefined) return;
    return {
      topic: topic.trim(),
      ...(audience.trim() === "" ? {} : { audience: audience.trim() }),
      ...(desiredChange.trim() === "" ? {} : { desiredChange: desiredChange.trim() }),
      density,
      durationMinutes,
      ...(existing?.language === undefined ? {} : { language: existing.language }),
      ...(motion === "agent-choice" ? {} : { motionIntensity: motion }),
    };
  };

  const sendBrief = async (
    brief: DreverStudioCommonBrief,
    skipRemaining: boolean,
  ): Promise<void> => {
    setSubmitting(true);
    try {
      await submitStudioBrief(onAction, brief, skipRemaining);
      setPendingUpdate(undefined);
      onReturnToWorkflow();
    } catch {
      // Studio owns the visible action error at the shared dispatch boundary.
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async (event: FormEvent, skipRemaining = false): Promise<void> => {
    event.preventDefault();
    const brief = currentBrief();
    if (brief === undefined || revisionBusy) return;
    const briefChanged = existing === undefined || !studioBriefsMatch(existing, brief);
    const skipChanged = skipRemaining && state.skippedRemainingQuestions !== true;
    const restartQuestions =
      reviewing && !skipRemaining && state.skippedRemainingQuestions === true;
    if (reviewing && !briefChanged && !skipChanged && !restartQuestions) {
      onReturnToWorkflow();
      return;
    }
    const hasDownstreamWork =
      state.adaptiveAnswers !== undefined ||
      (state.adaptiveQuestions?.length ?? 0) > 0 ||
      state.skippedRemainingQuestions === true ||
      state.plan !== undefined ||
      state.draftAvailable === true;
    if (reviewing && hasDownstreamWork) {
      setPendingUpdate({ brief, skipRemaining });
      return;
    }
    await sendBrief(brief, skipRemaining);
  };

  const draftBrief = currentBrief();
  const briefChanged =
    existing === undefined || draftBrief === undefined || !studioBriefsMatch(existing, draftBrief);

  useEffect(() => {
    onDirtyChange(reviewing && briefChanged);
    return () => onDirtyChange(false);
  }, [briefChanged, onDirtyChange, reviewing]);

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
            autoFocus={!reviewing}
            readOnly={revisionBusy}
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
              readOnly={revisionBusy}
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
              readOnly={revisionBusy}
              onChange={(event) => setDesiredChange(event.currentTarget.value)}
              placeholder="What should people know or do?"
              value={desiredChange}
            />
          </label>
        </div>

        <fieldset className="drever-studio-duration">
          <legend>Duration</legend>
          <div>
            <SelectionSurface value={durationChoice} />
            {durationOptions.map((duration) => (
              <label data-selected={duration === durationChoice ? "" : undefined} key={duration}>
                <input
                  checked={duration === durationChoice}
                  disabled={revisionBusy}
                  name="duration"
                  onChange={() => setDurationChoice(duration)}
                  type="radio"
                />
                <span>{duration} min</span>
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
                  disabled={revisionBusy}
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
          disabled={revisionBusy}
          label="Information density"
          onChange={setDensity}
          options={densityOptions}
          value={density}
        />
        <ChoiceGroup<MotionChoice>
          disabled={revisionBusy}
          label="Motion direction"
          onChange={setMotion}
          options={motionOptions}
          value={motion}
        />

        {revisionBusy ? (
          <p aria-live="polite" className="drever-studio-revision-busy" role="status">
            You can review this brief now. Wait for the active agent request before changing it.
          </p>
        ) : null}

        <footer className="drever-studio-brief__actions">
          <span className="drever-studio-surprise-control">
            <button
              aria-label="Skip remaining questions and surprise me"
              className="drever-studio-button drever-studio-button--quiet drever-studio-button--subtle drever-studio-button--surprise"
              disabled={
                submitting || revisionBusy || topic.trim() === "" || durationMinutes === undefined
              }
              onClick={(event) => void submit(event, true)}
              type="button"
            >
              <SparkIcon />
              <span aria-hidden="true" className="drever-studio-button__swap">
                <span>Skip the rest</span>
                <span>Surprise me</span>
              </span>
            </button>
            <span aria-hidden="true" className="drever-studio-button__confetti">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
          </span>
          <button
            className="drever-studio-button drever-studio-button--forward drever-studio-button--primary"
            disabled={
              submitting || revisionBusy || topic.trim() === "" || durationMinutes === undefined
            }
            type="submit"
          >
            {submitting
              ? "Sending…"
              : reviewing
                ? briefChanged
                  ? "Update brief"
                  : state.skippedRemainingQuestions === true
                    ? "Ask me questions"
                    : "Return to current step"
                : "Shape the direction"}
            <ArrowIcon />
          </button>
        </footer>
      </form>
      {pendingUpdate === undefined ? null : (
        <RevisionConfirmation
          busy={submitting}
          detail="Direction, Storyboard, and Draft will be regenerated. The current draft remains available as a previous version until its replacement is ready."
          onCancel={() => setPendingUpdate(undefined)}
          onConfirm={() => void sendBrief(pendingUpdate.brief, pendingUpdate.skipRemaining)}
          title="Update this brief?"
        />
      )}
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

const DirectionSummaryScreen = ({
  onReturnToWorkflow,
  state,
}: Readonly<{
  onReturnToWorkflow(): void;
  state: DreverStudioState;
}>): ReactElement => {
  const brief = state.commonBrief;
  const skipped = state.skippedRemainingQuestions === true;
  return (
    <main className="drever-studio-direction-summary" data-studio-screen="direction-summary">
      <header>
        <p>Direction saved</p>
        <h1>{skipped ? "The agent chose the remaining details." : "Your direction is saved."}</h1>
        <span>
          {skipped
            ? "This session skipped the optional question round. The choices below still guide the Storyboard and design pass."
            : "This earlier session did not retain its question wording, but the saved direction still guides the current Storyboard."}
        </span>
      </header>
      <section aria-label="Saved direction">
        <div>
          <small>Duration</small>
          <strong>{brief?.durationMinutes ?? 10} minutes</strong>
        </div>
        <div>
          <small>Information</small>
          <strong>{sentenceCase(brief?.density ?? "balanced")}</strong>
        </div>
        <div>
          <small>Motion</small>
          <strong>
            {brief?.motionIntensity === undefined
              ? "Agent choice"
              : sentenceCase(brief.motionIntensity)}
          </strong>
        </div>
        <button
          className="drever-studio-button drever-studio-button--forward drever-studio-button--primary"
          onClick={onReturnToWorkflow}
          type="button"
        >
          Return to current step
          <ArrowIcon />
        </button>
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

const AgentConnectionNotice = ({
  state,
}: Readonly<{ state: DreverStudioState }>): ReactElement | null => {
  const [dismissed, setDismissed] = useState(false);
  const resumable = state.agentConfigured === true;
  const awaitingReview =
    state.plan?.status === "awaiting-approval" && state.storyboardOutdated !== true;
  if (dismissed) return null;
  return (
    <aside
      aria-live="polite"
      className="drever-studio-agent-notice"
      data-resumable={resumable ? "" : undefined}
      role="status"
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
      <button
        aria-label="Dismiss agent connection notice"
        onClick={() => setDismissed(true)}
        type="button"
      >
        <CloseIcon />
      </button>
    </aside>
  );
};

const QuestionsScreen = ({
  onAction,
  onDirtyChange,
  onReturnToWorkflow,
  reviewing,
  state,
}: Readonly<{
  onAction: StudioProps["onAction"];
  onDirtyChange(dirty: boolean): void;
  onReturnToWorkflow(): void;
  reviewing: boolean;
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
  const [pendingRevision, setPendingRevision] = useState<"answers" | "skip" | undefined>();
  const revisionBusy =
    reviewing &&
    (state.pendingActionCount > 0 ||
      (state.agentConnected && (state.phase === "drafting" || state.phase === "refining")));

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

  const sendAnswers = async (answers: readonly DreverStudioAnswer[]): Promise<void> => {
    setSubmitting(true);
    try {
      await onAction({ answers, type: "submit-adaptive-answers" });
      setPendingRevision(undefined);
      onReturnToWorkflow();
    } catch {
      // Studio owns the visible action error at the shared dispatch boundary.
    } finally {
      setSubmitting(false);
    }
  };

  const sendSkip = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await onAction({ type: "skip-remaining-questions" });
      setPendingRevision(undefined);
      onReturnToWorkflow();
    } catch {
      // Studio owns the visible action error at the shared dispatch boundary.
    } finally {
      setSubmitting(false);
    }
  };

  const resolvedAnswers = resolveStudioAnswers(questions, drafts);
  const answersChanged = !studioAnswersMatch(state.adaptiveAnswers ?? [], resolvedAnswers);
  const hasDownstreamWork = state.plan !== undefined || state.draftAvailable === true;

  useEffect(() => {
    onDirtyChange(answersChanged);
    return () => onDirtyChange(false);
  }, [answersChanged, onDirtyChange]);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (revisionBusy) return;
    if (reviewing && !answersChanged && state.skippedRemainingQuestions !== true) {
      onReturnToWorkflow();
      return;
    }
    if (reviewing && hasDownstreamWork) {
      setPendingRevision("answers");
      return;
    }
    await sendAnswers(resolvedAnswers);
  };

  const skip = async (): Promise<void> => {
    if (revisionBusy) return;
    if (reviewing && state.skippedRemainingQuestions === true) {
      onReturnToWorkflow();
      return;
    }
    if (reviewing && hasDownstreamWork) {
      setPendingRevision("skip");
      return;
    }
    await sendSkip();
  };

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
                        disabled={revisionBusy}
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
                  readOnly={revisionBusy}
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
        {revisionBusy ? (
          <p aria-live="polite" className="drever-studio-revision-busy" role="status">
            You can review this direction now. Wait for the active agent request before changing it.
          </p>
        ) : null}
        <footer className="drever-studio-brief__actions">
          <button
            className="drever-studio-button drever-studio-button--quiet"
            disabled={submitting || revisionBusy}
            onClick={() => void skip()}
            type="button"
          >
            Skip remaining questions
          </button>
          <button
            className="drever-studio-button drever-studio-button--forward drever-studio-button--primary"
            disabled={submitting || revisionBusy || resolvedAnswers.length !== questions.length}
            type="submit"
          >
            {submitting
              ? "Saving…"
              : reviewing
                ? answersChanged || state.skippedRemainingQuestions === true
                  ? "Update direction"
                  : "Return to current step"
                : "Create the storyboard"}
            <ArrowIcon />
          </button>
        </footer>
      </form>
      {pendingRevision === undefined ? null : (
        <RevisionConfirmation
          busy={submitting}
          detail="The Storyboard and Draft will be regenerated from this direction. The current draft remains available as a previous version until its replacement is ready."
          onCancel={() => setPendingRevision(undefined)}
          onConfirm={() =>
            void (pendingRevision === "skip" ? sendSkip() : sendAnswers(resolvedAnswers))
          }
          title={
            pendingRevision === "skip" ? "Let the agent choose the rest?" : "Update direction?"
          }
        />
      )}
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
    <span className="drever-studio-plan-card__copy">
      <span className="drever-studio-plan-card__meta">
        <span className="drever-studio-plan-card__number">
          {String(index + 1).padStart(2, "0")}
        </span>
        <small>{sentenceCase(slide.job)}</small>
      </span>
      <strong dir="auto">{slide.title}</strong>
      <span className="drever-studio-plan-card__purpose" dir="auto">
        {slide.purpose}
      </span>
    </span>
  </button>
);

export const studioDraftThumbnailUrl = (
  previewUrl: string,
  audienceUrl: string,
  slideIndex: number,
): string => {
  const url = new URL(previewUrl, audienceUrl);
  url.searchParams.set("drever-studio-thumbnail", String(slideIndex + 1));
  url.hash = "";
  return url.href;
};

const StudioDraftThumbnail = ({
  audienceUrl,
  current,
  index,
  onSelect,
  previewRoot,
  previewUrl,
  selected,
  slide,
  canvas,
}: Readonly<{
  audienceUrl: string;
  canvas: CanvasDefinition;
  current: boolean;
  index: number;
  onSelect(): void;
  previewRoot: RefObject<HTMLElement | null>;
  previewUrl: string;
  selected: boolean;
  slide: Readonly<{ id: string; title: string }>;
}>): ReactElement => {
  const cardRef = useRef<HTMLElement>(null);
  const [previewReady, setPreviewReady] = useState(current);

  useEffect(() => {
    if (current) setPreviewReady(true);
  }, [current]);

  useEffect(() => {
    const card = cardRef.current;
    if (card === null || previewReady) return;
    if (typeof IntersectionObserver !== "function") {
      setPreviewReady(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting !== true) return;
        setPreviewReady(true);
        observer.disconnect();
      },
      { root: previewRoot.current, rootMargin: "300px 0px" },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [previewReady, previewRoot]);

  const ordinal = index + 1;
  return (
    <article
      className="drever-studio-rail__thumbnail"
      data-selected={selected ? "" : undefined}
      ref={cardRef}
    >
      <span className="drever-studio-rail__index">{String(ordinal).padStart(2, "0")}</span>
      <div
        aria-hidden="true"
        className="drever-studio-rail__thumbnail-frame"
        inert
        style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }}
      >
        {previewReady ? (
          <iframe
            aria-hidden="true"
            loading="lazy"
            referrerPolicy="no-referrer"
            sandbox="allow-same-origin allow-scripts"
            src={studioDraftThumbnailUrl(previewUrl, audienceUrl, index)}
            tabIndex={-1}
            title={`Slide ${String(ordinal)} preview`}
          />
        ) : (
          <span className="drever-studio-rail__thumbnail-placeholder" />
        )}
      </div>
      <strong className="drever-studio-rail__title" dir="auto">
        {slide.title}
      </strong>
      <button
        aria-controls="drever-studio-live-draft"
        aria-current={current ? "page" : undefined}
        className="drever-studio-rail__thumbnail-link"
        onClick={onSelect}
        type="button"
      >
        <span className="drever-studio-visually-hidden">
          View slide {ordinal}: <span dir="auto">{slide.title}</span>
        </span>
      </button>
    </article>
  );
};

const FeedbackComposer = ({
  feedbackTarget,
  onAction,
  onDirtyChange,
  onFeedbackTargetChange,
  outdated,
  selectedSlide,
  state,
}: Readonly<{
  feedbackTarget: StudioFeedbackTarget;
  onAction: StudioProps["onAction"];
  onDirtyChange(dirty: boolean): void;
  onFeedbackTargetChange(target: StudioFeedbackTarget): void;
  outdated: boolean;
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

  useEffect(() => {
    onDirtyChange(message.trim() !== "");
    return () => onDirtyChange(false);
  }, [message, onDirtyChange]);

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
        {outdated
          ? "This is a previous version. Return to the current step before sending more direction."
          : feedbackSlide === undefined
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
            readOnly={outdated}
            rows={5}
            value={message}
          />
        </label>
        <button
          className="drever-studio-button drever-studio-button--forward drever-studio-button--primary"
          disabled={outdated || submitting || message.trim() === ""}
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
  status: "error" | "outdated" | "ready" | "working";
  title: string;
}>;

export const resolveStudioDraftLifecycle = (
  state: DreverStudioState,
): StudioDraftLifecycle | undefined => {
  const detail = latestStudioNarration(state.message);
  if (state.draftOutdated === true && state.draftAvailable === true) {
    return {
      detail:
        "This preview reflects the earlier brief. Keep reviewing it while the agent prepares its replacement.",
      status: "outdated",
      title: "Previous draft remains available",
    };
  }
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
  const canvas = candidate.canvas;
  if (
    candidate.type !== "drever:studio-preview-state" ||
    candidate.version !== 1 ||
    (canvas !== undefined &&
      (typeof canvas !== "object" ||
        !Number.isFinite(canvas.width) ||
        canvas.width <= 0 ||
        !Number.isFinite(canvas.height) ||
        canvas.height <= 0)) ||
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
  mode,
  onAction,
  state,
}: Readonly<{
  mode: StudioMode;
  onAction: StudioProps["onAction"];
  state: DreverStudioState;
}>): ReactElement | null => {
  const lifecycle: StudioDraftLifecycle | undefined =
    mode === "storyboard" && state.storyboardOutdated === true
      ? {
          detail:
            "This sequence belongs to the earlier direction. Keep it for reference while the agent prepares a replacement.",
          status: "outdated",
          title: "Previous storyboard remains available",
        }
      : resolveStudioDraftLifecycle(state);
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
              : lifecycle.status === "outdated"
                ? "Previous version"
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
      <StudioActivityHistory activity={activityHistory} presentation="popover-start" />
    </section>
  );
};

const PlanScreen = ({
  audienceUrl,
  onDirtyChange,
  onModeChange,
  onAction,
  previewCapability,
  previewUrl = audienceUrl,
  requestedMode,
  state,
}: StudioProps &
  Readonly<{
    onDirtyChange(dirty: boolean): void;
    onModeChange?(mode: StudioMode): void;
    requestedMode?: StudioMode;
  }>): ReactElement => {
  const plan = state.plan?.status === "awaiting-input" ? undefined : state.plan;
  const [selectedSlideId, setSelectedSlideId] = useState<string | undefined>();
  const draftAvailable =
    state.draftAvailable === true || state.phase === "preview" || state.phase === "ready";
  const mode: StudioMode =
    requestedMode === "draft" && draftAvailable
      ? "draft"
      : requestedMode === "storyboard"
        ? "storyboard"
        : draftAvailable
          ? "draft"
          : "storyboard";
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
  const railRef = useRef<HTMLElement>(null);
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
  const artifactOutdated = isStudioArtifactOutdated(state, mode);

  useEffect(() => {
    if (!previousDraftAvailable.current && draftAvailable) setFeedbackScope("slide");
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
  const previewCanvas = previewState?.canvas ?? DEFAULT_CANVAS;
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
      <nav
        aria-label="Presentation slides"
        className="drever-studio-rail"
        data-mode={mode}
        ref={railRef}
      >
        <header>
          <p>{mode === "draft" ? "Live draft" : "Story"}</p>
          <span>{railSlides.length} slides</span>
        </header>
        <ol>
          {railSlides.map((slide, index) => {
            const current =
              mode === "draft" ? index === selectedSlideIndex : slide.id === selectedSlideId;
            const selected = mode === "draft" ? current : feedbackScope === "slide" && current;
            if (mode === "draft") {
              return (
                <li key={slide.id}>
                  <StudioDraftThumbnail
                    audienceUrl={audienceUrl}
                    canvas={previewCanvas}
                    current={current}
                    index={index}
                    onSelect={() => selectSlide(slide.id, index)}
                    previewRoot={railRef}
                    previewUrl={previewUrl}
                    selected={selected}
                    slide={slide}
                  />
                </li>
              );
            }
            return (
              <li key={slide.id}>
                <button
                  aria-controls={`drever-studio-plan-card-${slide.id}`}
                  aria-current={current ? "true" : undefined}
                  data-selected={selected ? "" : undefined}
                  onClick={() => selectSlide(slide.id, index)}
                  type="button"
                >
                  <span className="drever-studio-rail__index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <strong className="drever-studio-rail__title" dir="auto">
                    {slide.title}
                  </strong>
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
                onModeChange?.("storyboard");
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
                setFeedbackScope("slide");
                onModeChange?.("draft");
              }}
              type="button"
            >
              Live draft
            </button>
          </div>
          {mode === "storyboard" && plan.status === "awaiting-approval" && !artifactOutdated ? (
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
          ) : artifactOutdated ? (
            <span
              className="drever-studio-canvas__status"
              data-studio-status-copy=""
              key="previous-version"
            >
              Viewing a previous version
            </span>
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
            <StudioDraftStatus mode="draft" onAction={onAction} state={state} />
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
            <StudioDraftStatus mode="storyboard" onAction={onAction} state={state} />
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
        onDirtyChange={onDirtyChange}
        onFeedbackTargetChange={(target) => {
          setFeedbackScope(target);
          if (target === "deck" && mode === "storyboard") setSelectedSlideId(undefined);
        }}
        outdated={artifactOutdated}
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
  const [viewedStep, setViewedStep] = useState<StudioStep>();
  const [viewDirty, setViewDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<
    Readonly<{ viewedStep?: StudioStep }> | undefined
  >();
  const commonBriefDone = (state.commonBrief?.topic.trim() ?? "") !== "";
  const hasQuestions = (state.adaptiveQuestions?.length ?? 0) > 0;
  const workflowStep = resolveStudioWorkflowStep(state);
  const availableSteps = resolveStudioStepAvailability(state);
  const displayedStep = viewedStep ?? workflowStep;
  const currentPlan =
    state.plan?.status === "awaiting-input" ||
    directionIsPending(state) ||
    state.storyboardOutdated === true
      ? undefined
      : state.plan;
  const workflowScreen = useMemo(() => {
    if (state.phase === "error" && currentPlan === undefined) return "error";
    if (!commonBriefDone || state.phase === "briefing") return "brief";
    if (state.phase === "adaptive-questions" && hasQuestions) return "questions";
    if (currentPlan !== undefined) return "plan";
    return "waiting";
  }, [commonBriefDone, currentPlan, hasQuestions, state.phase]);
  const screen = useMemo(() => {
    if (viewedStep === undefined) return workflowScreen;
    if (viewedStep === "brief") return "brief";
    if (viewedStep === "direction") {
      return hasQuestions ? "questions" : "direction-summary";
    }
    return state.plan === undefined ? workflowScreen : "plan";
  }, [hasQuestions, state.plan, viewedStep, workflowScreen]);
  const activeSurfaceStep: StudioStep | undefined =
    screen === "brief"
      ? "brief"
      : screen === "questions" || screen === "direction-summary"
        ? "direction"
        : screen === "plan"
          ? displayedStep === "draft"
            ? "draft"
            : "storyboard"
          : undefined;

  useEffect(() => {
    if (viewedStep !== undefined && !availableSteps[viewedStep]) setViewedStep(undefined);
  }, [availableSteps, viewedStep]);
  const waitingForReview =
    state.plan?.status === "awaiting-approval" &&
    state.storyboardOutdated !== true &&
    state.pendingActionCount === 0;
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
      if (
        action.type === "submit-common-brief" ||
        action.type === "submit-adaptive-answers" ||
        action.type === "skip-remaining-questions" ||
        action.type === "approve-plan"
      ) {
        setViewDirty(false);
        setViewedStep(undefined);
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "The Drever creation room could not save that change.",
      );
      throw error;
    }
  };
  const selectStep = (step: StudioStep): void => {
    const nextViewedStep = step === workflowStep ? undefined : step;
    if (viewDirty && nextViewedStep !== viewedStep) {
      setPendingNavigation(
        nextViewedStep === undefined
          ? Object.freeze({})
          : Object.freeze({ viewedStep: nextViewedStep }),
      );
      return;
    }
    setViewedStep(nextViewedStep);
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
        <StudioProgress
          onStepSelect={selectStep}
          state={state}
          {...(activeSurfaceStep === undefined ? {} : { viewedStep: activeSurfaceStep })}
          workflowStep={workflowStep}
        />
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
      viewedStep === undefined &&
      (state.activity !== undefined ||
        state.progress !== undefined ||
        state.message !== undefined) ? (
        <StudioActivityTicker state={state} />
      ) : null}
      {screen === "brief" ? (
        <BriefScreen
          onAction={dispatch}
          onDirtyChange={setViewDirty}
          onReturnToWorkflow={() => setViewedStep(undefined)}
          reviewing={viewedStep === "brief" && workflowStep !== "brief"}
          state={state}
        />
      ) : null}
      {screen === "questions" ? (
        <QuestionsScreen
          onAction={dispatch}
          onDirtyChange={setViewDirty}
          onReturnToWorkflow={() => setViewedStep(undefined)}
          reviewing={viewedStep === "direction" && workflowStep !== "direction"}
          state={state}
        />
      ) : null}
      {screen === "direction-summary" ? (
        <DirectionSummaryScreen onReturnToWorkflow={() => setViewedStep(undefined)} state={state} />
      ) : null}
      {screen === "waiting" ? <WaitingScreen state={state} /> : null}
      {screen === "plan" ? (
        <PlanScreen
          {...props}
          onAction={dispatch}
          onDirtyChange={setViewDirty}
          onModeChange={(mode) => {
            const step = mode === "draft" ? "draft" : "storyboard";
            setViewedStep(step === workflowStep ? undefined : step);
          }}
          requestedMode={displayedStep === "draft" ? "draft" : "storyboard"}
        />
      ) : null}
      {screen === "error" ? <ErrorScreen onAction={dispatch} state={state} /> : null}
      {actionError === undefined ? null : (
        <div aria-live="assertive" className="drever-studio-error" role="alert">
          {actionError}
        </div>
      )}
      {pendingNavigation === undefined ? null : (
        <RevisionConfirmation
          busy={false}
          confirmLabel="Discard edits"
          detail="The values you changed on this step have not been sent to the agent."
          eyebrow="Unsaved changes"
          onCancel={() => setPendingNavigation(undefined)}
          onConfirm={() => {
            setViewDirty(false);
            setViewedStep(pendingNavigation.viewedStep);
            setPendingNavigation(undefined);
          }}
          title="Leave this step?"
        />
      )}
    </div>
  );
};

import type { DreverDeckPlan } from "./deck-plan.ts";

export const DREVER_STUDIO_PROTOCOL_VERSION = 1 as const;

export type DreverStudioDensity = "concise" | "balanced" | "detailed";
export type DreverStudioMotionIntensity = "minimal" | "measured" | "expressive";

export type DreverStudioCommonBrief = Readonly<{
  topic: string;
  audience?: string;
  desiredChange?: string;
  durationMinutes?: number;
  language?: string;
  density?: DreverStudioDensity;
  motionIntensity?: DreverStudioMotionIntensity;
}>;

export type DreverStudioQuestionOption = Readonly<{
  id: string;
  label: string;
  description: string;
  recommended?: boolean;
}>;

export type DreverStudioQuestion = Readonly<{
  id: string;
  prompt: string;
  options: readonly DreverStudioQuestionOption[];
  multiple?: boolean;
}>;

export type DreverStudioAnswer = Readonly<{
  questionId: string;
  optionIds?: readonly string[];
  text?: string;
}>;

export type DreverStudioFeedbackScope =
  | Readonly<{ kind: "deck" }>
  | Readonly<{ kind: "slide"; slideId: string }>;

export type DreverStudioImprovementCategory = "content" | "design" | "motion" | "accessibility";
export type DreverStudioImprovementPriority = "must-fix" | "worth-improving" | "optional";

/** One analysis-only improvement idea. Applying it always requires a separate feedback action. */
export type DreverStudioImprovement = Readonly<{
  id: string;
  category: DreverStudioImprovementCategory;
  priority: DreverStudioImprovementPriority;
  scope: DreverStudioFeedbackScope;
  observation: string;
  reason: string;
  proposal: string;
  impact: string;
  /** Concrete rendered, source, or narrative evidence. Ideas without evidence must be optional. */
  evidence?: string;
}>;

export type DreverStudioDraftReview = Readonly<{
  actionRevision: number;
  suggestions: readonly DreverStudioImprovement[];
}>;

export type DreverStudioProgress = Readonly<{
  label: string;
  completed?: number;
  total?: number;
}>;

export type DreverStudioActivityStatus = "active" | "complete" | "error";

export type DreverStudioAgentApprovalKind = "command" | "file-change" | "permissions";

export type DreverStudioAgentApprovalDecision =
  | "accept"
  | "acceptForSession"
  | "decline"
  | "cancel";

/** A concise, user-facing approval request. Never include private model reasoning. */
export type DreverStudioAgentApprovalRequest = Readonly<{
  decisions?: readonly DreverStudioAgentApprovalDecision[];
  id: string;
  kind: DreverStudioAgentApprovalKind;
  reason?: string;
  detail?: string;
}>;

/** A concise, user-facing milestone. It must not contain private model reasoning. */
export type DreverStudioActivity = Readonly<{
  id: string;
  label: string;
  detail?: string;
  status: DreverStudioActivityStatus;
}>;

export type DreverStudioPhase =
  | "briefing"
  | "waiting-for-agent"
  | "adaptive-questions"
  | "plan-review"
  | "drafting"
  | "preview"
  | "refining"
  | "ready"
  | "error";

export type DreverStudioState = Readonly<{
  version: typeof DREVER_STUDIO_PROTOCOL_VERSION;
  revision: number;
  phase: DreverStudioPhase;
  /** Transient local-only Brief prefill. It is never part of the action journal or agent state. */
  initialTopic?: string;
  /** True after this Studio session has published its first live draft. */
  draftAvailable?: boolean;
  /** True when the development server owns a managed agent that can resume on the next action. */
  agentConfigured?: boolean;
  agentConnected: boolean;
  commonBrief?: DreverStudioCommonBrief;
  adaptiveQuestions?: readonly DreverStudioQuestion[];
  adaptiveAnswers?: readonly DreverStudioAnswer[];
  skippedRemainingQuestions?: boolean;
  plan?: DreverDeckPlan;
  /** A previous Storyboard remains visible but no longer reflects the latest upstream input. */
  storyboardOutdated?: boolean;
  /** A previous live draft remains visible but no longer reflects the latest approved work. */
  draftOutdated?: boolean;
  activity?: readonly DreverStudioActivity[];
  agentApprovals?: readonly DreverStudioAgentApprovalRequest[];
  progress?: DreverStudioProgress;
  draftReview?: DreverStudioDraftReview;
  message?: string;
  latestActionRevision: number;
  pendingActionCount: number;
}>;

type DreverStudioActionBase = Readonly<{
  version: typeof DREVER_STUDIO_PROTOCOL_VERSION;
  requestId: string;
  expectedRevision: number;
}>;

export type DreverStudioAction =
  | (DreverStudioActionBase &
      Readonly<{ type: "submit-common-brief"; brief: DreverStudioCommonBrief }>)
  | (DreverStudioActionBase &
      Readonly<{ type: "submit-adaptive-answers"; answers: readonly DreverStudioAnswer[] }>)
  | (DreverStudioActionBase & Readonly<{ type: "skip-remaining-questions" }>)
  | (DreverStudioActionBase & Readonly<{ type: "approve-plan" }>)
  /** Restarts the configured local agent and replays the existing pending journal entry. */
  | (DreverStudioActionBase & Readonly<{ type: "resume-pending" }>)
  | (DreverStudioActionBase &
      Readonly<{ type: "request-draft-review"; scope: DreverStudioFeedbackScope }>)
  | (DreverStudioActionBase &
      Readonly<{
        type: "respond-agent-approval";
        approvalId: string;
        decision: DreverStudioAgentApprovalDecision;
      }>)
  | (DreverStudioActionBase &
      Readonly<{ type: "submit-feedback"; scope: DreverStudioFeedbackScope; message: string }>);

export type DreverStudioActionAck = Readonly<{
  version: typeof DREVER_STUDIO_PROTOCOL_VERSION;
  requestId: string;
  accepted: boolean;
  revision: number;
  error?: Readonly<{
    code: string;
    message: string;
  }>;
}>;

export type DreverStudioActionRecord = Readonly<{
  version: typeof DREVER_STUDIO_PROTOCOL_VERSION;
  revision: number;
  receivedAt: string;
  action: DreverStudioAction;
  /** Server-owned context captured only after the corresponding browser action is validated. */
  context?: Readonly<{
    adaptiveQuestions?: readonly DreverStudioQuestion[];
    feedbackTarget?: "draft" | "storyboard";
  }>;
}>;

/** Agent-owned publication merged with browser actions and drever.plan.json by drever dev. */
export type DreverStudioAgentState = Readonly<{
  version: typeof DREVER_STUDIO_PROTOCOL_VERSION;
  phase: DreverStudioPhase;
  handledActionRevision?: number;
  adaptiveQuestions?: readonly DreverStudioQuestion[];
  activity?: readonly DreverStudioActivity[];
  progress?: DreverStudioProgress;
  draftReview?: DreverStudioDraftReview;
  message?: string;
}>;

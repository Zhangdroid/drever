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

export type DreverStudioProgress = Readonly<{
  label: string;
  completed?: number;
  total?: number;
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
  agentConnected: boolean;
  commonBrief?: DreverStudioCommonBrief;
  adaptiveQuestions?: readonly DreverStudioQuestion[];
  adaptiveAnswers?: readonly DreverStudioAnswer[];
  skippedRemainingQuestions?: boolean;
  plan?: DreverDeckPlan;
  progress?: DreverStudioProgress;
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
}>;

/** Agent-owned publication merged with browser actions and drever.plan.json by drever dev. */
export type DreverStudioAgentState = Readonly<{
  version: typeof DREVER_STUDIO_PROTOCOL_VERSION;
  phase: DreverStudioPhase;
  handledActionRevision?: number;
  adaptiveQuestions?: readonly DreverStudioQuestion[];
  progress?: DreverStudioProgress;
  message?: string;
}>;

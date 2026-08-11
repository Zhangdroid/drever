import {
  DREVER_STUDIO_PROTOCOL_VERSION,
  type DreverDeckPlan,
  type DreverStudioAction,
  type DreverStudioActionAck,
  type DreverStudioActionRecord,
  type DreverStudioActivity,
  type DreverStudioAgentApprovalDecision,
  type DreverStudioAgentApprovalRequest,
  type DreverStudioAgentState,
  type DreverStudioAnswer,
  type DreverStudioCommonBrief,
  type DreverStudioDraftReview,
  type DreverStudioFeedbackScope,
  type DreverStudioImprovement,
  type DreverStudioPhase,
  type DreverStudioQuestion,
  type DreverStudioState,
} from "@drever/schema";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { normalizePath, type Plugin, type ViteDevServer, type WebSocketClient } from "vite";
import { DREVER_DECK_PLAN_FILE, loadDreverDeckPlan } from "./deck-plan.ts";
import type {
  StudioAgentApprovalRequest,
  StudioAgentProvider,
  StudioAgentProviderSnapshot,
} from "./studio-agent-provider.ts";

export const DREVER_STUDIO_ACTION_EVENT = "drever:studio-action";
export const DREVER_STUDIO_ACTION_ACK_EVENT = "drever:studio-action-ack";
export const DREVER_STUDIO_STATE_EVENT = "drever:studio-state";
export const DREVER_STUDIO_STATE_REQUEST_EVENT = "drever:studio-state-request";
export const DREVER_STUDIO_DIRECTORY = ".drever/studio";
export const DREVER_STUDIO_AGENT_STATE_FILE = "state.json";
export const DREVER_STUDIO_AGENT_HEARTBEAT_FILE = "agent-heartbeat.json";
export const DREVER_STUDIO_ARTIFACT_CHECKPOINT_FILE = "artifacts.json";
export const DREVER_STUDIO_ACTIONS_DIRECTORY = "actions";
export const DREVER_STUDIO_AGENT_CONNECTION_TTL_MS = 5 * 60 * 1_000;

const MAX_PAYLOAD_BYTES = 32 * 1024;
const MAX_SHORT_TEXT = 240;
const MAX_LONG_TEXT = 4_000;
const MAX_ACTIVITY_ITEMS = 12;
const MAX_TRANSIENT_RECEIPTS = 64;
const MAX_QUESTIONS = 3;
const MAX_OPTIONS = 4;
const MAX_IMPROVEMENTS = 3;
const STUDIO_REFRESH_INTERVAL_MS = 250;
const REQUEST_ID = /^[\w.:-]{1,128}$/u;
const ID = /^[a-z][a-z\d]*(?:-[a-z\d]+)*$/u;
const PHASES = new Set<DreverStudioPhase>([
  "briefing",
  "waiting-for-agent",
  "adaptive-questions",
  "plan-review",
  "drafting",
  "preview",
  "refining",
  "ready",
  "error",
]);
const DENSITIES = new Set(["concise", "balanced", "detailed"]);
const MOTION_INTENSITIES = new Set(["minimal", "measured", "expressive"]);
const ACTIVITY_STATUSES = new Set(["active", "complete", "error"]);
const APPROVAL_DECISIONS = new Set<DreverStudioAgentApprovalDecision>([
  "accept",
  "acceptForSession",
  "decline",
  "cancel",
]);
const IMPROVEMENT_CATEGORIES = new Set(["content", "design", "motion", "accessibility"]);
const IMPROVEMENT_PRIORITIES = new Set(["must-fix", "worth-improving", "optional"]);

type JsonRecord = Record<string, unknown>;
type StudioSessionSnapshot = Readonly<{
  agentLeaseExpiresAt?: number;
  records: readonly DreverStudioActionRecord[];
  state: DreverStudioState;
}>;

type StudioArtifactCheckpoint = Readonly<{
  version: typeof DREVER_STUDIO_PROTOCOL_VERSION;
  storyboardRevision?: number;
  draftRevision?: number;
}>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const exactKeys = (value: JsonRecord, keys: readonly string[]): boolean =>
  Object.keys(value).every((key) => keys.includes(key));

const optionalText = (value: unknown, limit: number): value is string | undefined =>
  value === undefined ||
  (typeof value === "string" && value.trim().length > 0 && value.length <= limit);

const requiredText = (value: unknown, limit: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= limit;

const decodeCommonBrief = (value: unknown): DreverStudioCommonBrief | undefined => {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "topic",
      "audience",
      "desiredChange",
      "durationMinutes",
      "language",
      "density",
      "motionIntensity",
    ]) ||
    !requiredText(value.topic, MAX_LONG_TEXT) ||
    !optionalText(value.audience, MAX_LONG_TEXT) ||
    !optionalText(value.desiredChange, MAX_LONG_TEXT) ||
    !optionalText(value.language, MAX_SHORT_TEXT) ||
    (value.durationMinutes !== undefined &&
      !(
        typeof value.durationMinutes === "number" &&
        Number.isFinite(value.durationMinutes) &&
        value.durationMinutes > 0 &&
        value.durationMinutes <= 1_440
      )) ||
    (value.density !== undefined && !DENSITIES.has(value.density as string)) ||
    (value.motionIntensity !== undefined &&
      !MOTION_INTENSITIES.has(value.motionIntensity as string))
  ) {
    return;
  }
  if (typeof value.language === "string") {
    try {
      Intl.getCanonicalLocales(value.language);
    } catch {
      return;
    }
  }
  return Object.freeze(value as DreverStudioCommonBrief);
};

const decodeAnswer = (value: unknown): DreverStudioAnswer | undefined => {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["questionId", "optionIds", "text"]) ||
    !requiredText(value.questionId, MAX_SHORT_TEXT) ||
    (value.optionIds !== undefined &&
      (!Array.isArray(value.optionIds) ||
        value.optionIds.length === 0 ||
        value.optionIds.length > MAX_OPTIONS ||
        value.optionIds.some((id) => !requiredText(id, MAX_SHORT_TEXT)) ||
        new Set(value.optionIds).size !== value.optionIds.length)) ||
    !optionalText(value.text, MAX_LONG_TEXT) ||
    (value.optionIds === undefined && value.text === undefined)
  ) {
    return;
  }
  return Object.freeze(value as DreverStudioAnswer);
};

const decodeQuestion = (value: unknown): DreverStudioQuestion | undefined => {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["id", "prompt", "options", "multiple"]) ||
    !requiredText(value.id, MAX_SHORT_TEXT) ||
    !ID.test(value.id) ||
    !requiredText(value.prompt, MAX_LONG_TEXT) ||
    !Array.isArray(value.options) ||
    value.options.length < 2 ||
    value.options.length > MAX_OPTIONS ||
    (value.multiple !== undefined && typeof value.multiple !== "boolean")
  ) {
    return;
  }
  const options = value.options.map((option) => {
    if (
      !isRecord(option) ||
      !exactKeys(option, ["id", "label", "description", "recommended"]) ||
      !requiredText(option.id, MAX_SHORT_TEXT) ||
      !ID.test(option.id) ||
      !requiredText(option.label, MAX_SHORT_TEXT) ||
      !requiredText(option.description, MAX_LONG_TEXT) ||
      (option.recommended !== undefined && typeof option.recommended !== "boolean")
    ) {
      return;
    }
    return option;
  });
  if (
    options.some((option) => option === undefined) ||
    new Set(options.map((option) => option?.id)).size !== options.length ||
    options.filter((option) => option?.recommended === true).length > 1
  ) {
    return;
  }
  return Object.freeze(value as DreverStudioQuestion);
};

const decodeQuestions = (value: unknown): readonly DreverStudioQuestion[] | undefined => {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_QUESTIONS) return;
  const questions = value.map(decodeQuestion);
  if (
    questions.some((question) => question === undefined) ||
    new Set(questions.map((question) => question?.id)).size !== questions.length
  ) {
    return;
  }
  return Object.freeze(questions as readonly DreverStudioQuestion[]);
};

const decodeActivity = (value: unknown): DreverStudioActivity | undefined => {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["id", "label", "detail", "status"]) ||
    !requiredText(value.id, MAX_SHORT_TEXT) ||
    !ID.test(value.id) ||
    !requiredText(value.label, MAX_SHORT_TEXT) ||
    !optionalText(value.detail, MAX_LONG_TEXT) ||
    !ACTIVITY_STATUSES.has(value.status as string)
  ) {
    return;
  }
  return Object.freeze(value as DreverStudioActivity);
};

const decodeFeedbackScope = (value: unknown): DreverStudioFeedbackScope | undefined => {
  if (!isRecord(value)) return;
  if (value.kind === "deck" && exactKeys(value, ["kind"])) {
    return Object.freeze(value) as DreverStudioFeedbackScope;
  }
  return value.kind === "slide" &&
    exactKeys(value, ["kind", "slideId"]) &&
    requiredText(value.slideId, MAX_SHORT_TEXT) &&
    ID.test(value.slideId)
    ? (Object.freeze(value) as DreverStudioFeedbackScope)
    : undefined;
};

const decodeImprovement = (value: unknown): DreverStudioImprovement | undefined => {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "id",
      "category",
      "priority",
      "scope",
      "observation",
      "reason",
      "proposal",
      "impact",
      "evidence",
    ]) ||
    !requiredText(value.id, MAX_SHORT_TEXT) ||
    !ID.test(value.id) ||
    !IMPROVEMENT_CATEGORIES.has(value.category as string) ||
    !IMPROVEMENT_PRIORITIES.has(value.priority as string) ||
    decodeFeedbackScope(value.scope) === undefined ||
    !requiredText(value.observation, MAX_LONG_TEXT) ||
    !requiredText(value.reason, MAX_LONG_TEXT) ||
    !requiredText(value.proposal, MAX_LONG_TEXT) ||
    !requiredText(value.impact, MAX_LONG_TEXT) ||
    !optionalText(value.evidence, MAX_LONG_TEXT) ||
    (value.evidence === undefined && value.priority !== "optional")
  ) {
    return;
  }
  return Object.freeze(value as DreverStudioImprovement);
};

const decodeDraftReview = (value: unknown): DreverStudioDraftReview | undefined => {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["actionRevision", "suggestions"]) ||
    !Number.isSafeInteger(value.actionRevision) ||
    (value.actionRevision as number) <= 0 ||
    !Array.isArray(value.suggestions) ||
    value.suggestions.length > MAX_IMPROVEMENTS ||
    value.suggestions.some((suggestion) => decodeImprovement(suggestion) === undefined) ||
    new Set(value.suggestions.map((suggestion) => (suggestion as JsonRecord).id)).size !==
      value.suggestions.length
  ) {
    return;
  }
  return Object.freeze(value as DreverStudioDraftReview);
};

/** @internal Keeps analysis suggestions inside the requested, currently reviewable scope. */
export const draftReviewMatchesRequest = (
  review: DreverStudioDraftReview,
  record: DreverStudioActionRecord | undefined,
  plan: DreverDeckPlan | undefined,
): boolean => {
  if (
    record?.action.type !== "request-draft-review" ||
    review.actionRevision !== record.revision ||
    plan?.status !== "approved"
  ) {
    return false;
  }
  const requestedScope = record.action.scope;
  const currentSlideIds = new Set(plan.slides.map(({ id }) => id));
  if (requestedScope.kind === "slide" && !currentSlideIds.has(requestedScope.slideId)) {
    return false;
  }
  return review.suggestions.every(({ scope }) => {
    if (requestedScope.kind === "slide") {
      return scope.kind === "slide" && scope.slideId === requestedScope.slideId;
    }
    return scope.kind === "deck" || currentSlideIds.has(scope.slideId);
  });
};

export const decodeStudioAgentState = (value: unknown): DreverStudioAgentState | undefined => {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "version",
      "phase",
      "handledActionRevision",
      "adaptiveQuestions",
      "activity",
      "progress",
      "draftReview",
      "message",
    ]) ||
    value.version !== DREVER_STUDIO_PROTOCOL_VERSION ||
    !PHASES.has(value.phase as DreverStudioPhase) ||
    (value.handledActionRevision !== undefined &&
      !(
        typeof value.handledActionRevision === "number" &&
        Number.isSafeInteger(value.handledActionRevision) &&
        value.handledActionRevision >= 0
      )) ||
    !optionalText(value.message, MAX_LONG_TEXT)
  ) {
    return;
  }
  if (value.adaptiveQuestions !== undefined) {
    if (decodeQuestions(value.adaptiveQuestions) === undefined) return;
  }
  if (value.activity !== undefined) {
    if (
      !Array.isArray(value.activity) ||
      value.activity.length === 0 ||
      value.activity.length > MAX_ACTIVITY_ITEMS ||
      value.activity.some((item) => decodeActivity(item) === undefined) ||
      new Set(value.activity.map((item) => (item as JsonRecord).id)).size !==
        value.activity.length ||
      value.activity.filter((item) => (item as JsonRecord).status === "active").length > 1
    ) {
      return;
    }
  }
  if (value.progress !== undefined) {
    if (
      !isRecord(value.progress) ||
      !exactKeys(value.progress, ["label", "completed", "total"]) ||
      !requiredText(value.progress.label, MAX_SHORT_TEXT) ||
      (value.progress.completed !== undefined &&
        !(typeof value.progress.completed === "number" && value.progress.completed >= 0)) ||
      (value.progress.total !== undefined &&
        !(typeof value.progress.total === "number" && value.progress.total > 0)) ||
      (typeof value.progress.completed === "number" &&
        typeof value.progress.total === "number" &&
        value.progress.completed > value.progress.total)
    ) {
      return;
    }
  }
  if (value.draftReview !== undefined && decodeDraftReview(value.draftReview) === undefined) return;
  return Object.freeze(value as DreverStudioAgentState);
};

/** @internal Validates the complete browser-owned action payload before it reaches disk. */
export const decodeStudioAction = (value: unknown): DreverStudioAction | undefined => {
  if (
    !isRecord(value) ||
    value.version !== DREVER_STUDIO_PROTOCOL_VERSION ||
    !REQUEST_ID.test(typeof value.requestId === "string" ? value.requestId : "") ||
    !Number.isSafeInteger(value.expectedRevision) ||
    (value.expectedRevision as number) < 0 ||
    typeof value.type !== "string"
  ) {
    return;
  }
  const base = ["version", "requestId", "expectedRevision", "type"];
  if (value.type === "submit-common-brief") {
    const brief = decodeCommonBrief(value.brief);
    return brief !== undefined && exactKeys(value, [...base, "brief"])
      ? (Object.freeze({ ...value, brief }) as DreverStudioAction)
      : undefined;
  }
  if (value.type === "submit-adaptive-answers") {
    if (
      !exactKeys(value, [...base, "answers"]) ||
      !Array.isArray(value.answers) ||
      value.answers.length === 0 ||
      value.answers.length > MAX_QUESTIONS
    ) {
      return;
    }
    const answers = value.answers.map(decodeAnswer);
    if (
      answers.some((answer) => answer === undefined) ||
      new Set(answers.map((answer) => answer?.questionId)).size !== answers.length
    ) {
      return;
    }
    return Object.freeze({ ...value, answers: Object.freeze(answers) }) as DreverStudioAction;
  }
  if (
    value.type === "skip-remaining-questions" ||
    value.type === "approve-plan" ||
    value.type === "resume-pending"
  ) {
    return exactKeys(value, base) ? (Object.freeze(value) as DreverStudioAction) : undefined;
  }
  if (value.type === "request-draft-review") {
    return exactKeys(value, [...base, "scope"]) && decodeFeedbackScope(value.scope) !== undefined
      ? (Object.freeze(value) as DreverStudioAction)
      : undefined;
  }
  if (value.type === "respond-agent-approval") {
    return exactKeys(value, [...base, "approvalId", "decision"]) &&
      requiredText(value.approvalId, MAX_SHORT_TEXT) &&
      APPROVAL_DECISIONS.has(value.decision as DreverStudioAgentApprovalDecision)
      ? (Object.freeze(value) as DreverStudioAction)
      : undefined;
  }
  if (value.type === "submit-feedback") {
    if (
      !exactKeys(value, [...base, "scope", "message"]) ||
      !requiredText(value.message, MAX_LONG_TEXT) ||
      !isRecord(value.scope)
    ) {
      return;
    }
    if (decodeFeedbackScope(value.scope) !== undefined) {
      return Object.freeze(value) as DreverStudioAction;
    }
  }
  return;
};

const decodeStudioActionContext = (
  value: unknown,
): DreverStudioActionRecord["context"] | undefined => {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["adaptiveQuestions", "feedbackTarget"]) ||
    (value.feedbackTarget !== undefined &&
      value.feedbackTarget !== "draft" &&
      value.feedbackTarget !== "storyboard")
  ) {
    return;
  }
  const adaptiveQuestions =
    value.adaptiveQuestions === undefined ? undefined : decodeQuestions(value.adaptiveQuestions);
  if (value.adaptiveQuestions !== undefined && adaptiveQuestions === undefined) return;
  return Object.freeze({
    ...(adaptiveQuestions === undefined ? {} : { adaptiveQuestions }),
    ...(value.feedbackTarget === undefined ? {} : { feedbackTarget: value.feedbackTarget }),
  });
};

const readJson = async (path: string): Promise<unknown> => {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
};

const decodeStudioAgentHeartbeat = (
  value: unknown,
): Readonly<{ seenAt: string; version: typeof DREVER_STUDIO_PROTOCOL_VERSION }> | undefined => {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["version", "seenAt"]) ||
    value.version !== DREVER_STUDIO_PROTOCOL_VERSION ||
    typeof value.seenAt !== "string" ||
    Number.isNaN(Date.parse(value.seenAt))
  ) {
    return;
  }
  return Object.freeze({ version: DREVER_STUDIO_PROTOCOL_VERSION, seenAt: value.seenAt });
};

const readStudioAgentHeartbeat = async (
  path: string,
): Promise<ReturnType<typeof decodeStudioAgentHeartbeat>> => {
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  try {
    return decodeStudioAgentHeartbeat(JSON.parse(source) as unknown);
  } catch {
    return;
  }
};

/** @internal Renews the local coding-agent lease without exposing provider credentials. */
export const writeStudioAgentHeartbeat = async (root: string, seenAt: Date): Promise<void> => {
  const directory = join(root, DREVER_STUDIO_DIRECTORY);
  const path = join(directory, DREVER_STUDIO_AGENT_HEARTBEAT_FILE);
  const temporaryPath = `${path}.${randomUUID()}.next`;
  const heartbeat = Object.freeze({
    version: DREVER_STUDIO_PROTOCOL_VERSION,
    seenAt: seenAt.toISOString(),
  });
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(temporaryPath, `${JSON.stringify(heartbeat, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryPath, path);
};

const recordFileName = (revision: number): string => `${String(revision).padStart(8, "0")}.json`;

const readActionRecords = async (
  directory: string,
): Promise<readonly DreverStudioActionRecord[]> => {
  let names: readonly string[];
  try {
    names = (await readdir(directory)).filter((name) => /^\d{8}\.json$/u.test(name)).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return Promise.all(
    names.map(async (name, index) => {
      const value = await readJson(join(directory, name));
      if (
        !isRecord(value) ||
        value.version !== DREVER_STUDIO_PROTOCOL_VERSION ||
        value.revision !== index + 1 ||
        typeof value.receivedAt !== "string" ||
        Number.isNaN(Date.parse(value.receivedAt))
      ) {
        throw new TypeError(`Invalid Drever Studio action record: ${name}`);
      }
      const action = decodeStudioAction(value.action);
      if (action === undefined) {
        throw new TypeError(`Invalid Drever Studio action payload: ${name}`);
      }
      const context =
        value.context === undefined ? undefined : decodeStudioActionContext(value.context);
      if (value.context !== undefined && context === undefined) {
        throw new TypeError(`Invalid Drever Studio action context: ${name}`);
      }
      return Object.freeze({
        version: DREVER_STUDIO_PROTOCOL_VERSION,
        revision: value.revision,
        receivedAt: value.receivedAt,
        action,
        ...(context === undefined ? {} : { context }),
      });
    }),
  );
};

export const readStudioActionRecords = (
  root: string,
): Promise<readonly DreverStudioActionRecord[]> =>
  readActionRecords(join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_ACTIONS_DIRECTORY));

const decodeStudioArtifactCheckpoint = (value: unknown): StudioArtifactCheckpoint | undefined => {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["version", "storyboardRevision", "draftRevision"]) ||
    value.version !== DREVER_STUDIO_PROTOCOL_VERSION ||
    (value.storyboardRevision !== undefined &&
      !(
        typeof value.storyboardRevision === "number" &&
        Number.isSafeInteger(value.storyboardRevision) &&
        value.storyboardRevision >= 0
      )) ||
    (value.draftRevision !== undefined &&
      !(
        typeof value.draftRevision === "number" &&
        Number.isSafeInteger(value.draftRevision) &&
        value.draftRevision >= 0
      ))
  ) {
    return;
  }
  return Object.freeze(value as StudioArtifactCheckpoint);
};

const readStudioArtifactCheckpoint = async (
  root: string,
): Promise<StudioArtifactCheckpoint | undefined> => {
  const value = await readJson(
    join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_ARTIFACT_CHECKPOINT_FILE),
  );
  return value === undefined ? undefined : decodeStudioArtifactCheckpoint(value);
};

const latestRevisionMatching = (
  records: readonly DreverStudioActionRecord[],
  matches: (record: DreverStudioActionRecord) => boolean,
): number => {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (record !== undefined && matches(record)) return record.revision;
  }
  return 0;
};

const latestStoryboardInvalidationRevision = (
  records: readonly DreverStudioActionRecord[],
  planStatus: "approved" | "awaiting-approval" | "awaiting-input" | undefined,
): number =>
  latestRevisionMatching(records, ({ action, context }) => {
    if (
      action.type === "submit-common-brief" ||
      action.type === "submit-adaptive-answers" ||
      action.type === "skip-remaining-questions"
    ) {
      return true;
    }
    return (
      action.type === "submit-feedback" &&
      (context?.feedbackTarget === "storyboard" ||
        (context?.feedbackTarget === undefined && planStatus !== "approved"))
    );
  });

const latestDraftInvalidationRevision = (records: readonly DreverStudioActionRecord[]): number =>
  latestRevisionMatching(
    records,
    ({ action }) =>
      action.type === "submit-common-brief" ||
      action.type === "submit-adaptive-answers" ||
      action.type === "skip-remaining-questions" ||
      action.type === "approve-plan" ||
      action.type === "submit-feedback",
  );

const latestDraftRequestRevision = (records: readonly DreverStudioActionRecord[]): number =>
  latestRevisionMatching(
    records,
    ({ action, context }) =>
      action.type === "approve-plan" ||
      (action.type === "submit-feedback" && context?.feedbackTarget === "draft"),
  );

const planWasWrittenAfter = async (
  root: string,
  records: readonly DreverStudioActionRecord[],
  revision: number,
): Promise<boolean> => {
  if (revision === 0) return true;
  const record = records.find((candidate) => candidate.revision === revision);
  if (record === undefined) return false;
  try {
    const metadata = await stat(join(root, DREVER_DECK_PLAN_FILE));
    return metadata.mtimeMs >= Date.parse(record.receivedAt);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
};

const artifactRevisionsForPublication = async (
  root: string,
  records: readonly DreverStudioActionRecord[],
  state: DreverStudioAgentState,
): Promise<Readonly<{ storyboardRevision?: number; draftRevision?: number }>> => {
  const latestActionRevision = records.at(-1)?.revision ?? 0;
  const handled = state.handledActionRevision ?? (latestActionRevision === 0 ? 0 : undefined);
  if (handled === undefined || handled > latestActionRevision) return {};
  const plan = (await loadDreverDeckPlan({ root })).plan;
  if (plan === undefined || plan.status === "awaiting-input") return {};
  const storyboardInvalidation = latestStoryboardInvalidationRevision(records, plan.status);
  const storyboardPhaseMatches =
    (plan.status === "awaiting-approval" && state.phase === "plan-review") ||
    (plan.status === "approved" &&
      (state.phase === "drafting" ||
        state.phase === "preview" ||
        state.phase === "refining" ||
        state.phase === "ready"));
  const storyboardCurrent =
    storyboardPhaseMatches &&
    handled >= storyboardInvalidation &&
    (await planWasWrittenAfter(root, records, storyboardInvalidation));
  const draftInvalidation = latestDraftInvalidationRevision(records);
  const draftCurrent =
    storyboardCurrent &&
    plan.status === "approved" &&
    (state.phase === "preview" || state.phase === "ready") &&
    handled >= draftInvalidation;
  return Object.freeze({
    ...(storyboardCurrent ? { storyboardRevision: handled } : {}),
    ...(draftCurrent ? { draftRevision: handled } : {}),
  });
};

const writeStudioArtifactCheckpoint = async (
  root: string,
  revisions: Readonly<{ storyboardRevision?: number; draftRevision?: number }>,
): Promise<void> => {
  if (revisions.storyboardRevision === undefined && revisions.draftRevision === undefined) return;
  const existing = await readStudioArtifactCheckpoint(root);
  const checkpoint: StudioArtifactCheckpoint = Object.freeze({
    version: DREVER_STUDIO_PROTOCOL_VERSION,
    ...(existing?.storyboardRevision === undefined && revisions.storyboardRevision === undefined
      ? {}
      : {
          storyboardRevision: Math.max(
            existing?.storyboardRevision ?? 0,
            revisions.storyboardRevision ?? 0,
          ),
        }),
    ...(existing?.draftRevision === undefined && revisions.draftRevision === undefined
      ? {}
      : {
          draftRevision: Math.max(existing?.draftRevision ?? 0, revisions.draftRevision ?? 0),
        }),
  });
  const directory = join(root, DREVER_STUDIO_DIRECTORY);
  const path = join(directory, DREVER_STUDIO_ARTIFACT_CHECKPOINT_FILE);
  const temporaryPath = `${path}.${randomUUID()}.next`;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(temporaryPath, `${JSON.stringify(checkpoint, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryPath, path);
};

const validHandledActionRevision = (revision: number, latestActionRevision: number): boolean =>
  Number.isSafeInteger(revision) && revision >= 0 && revision <= latestActionRevision;

const agentStateWithinJournal = (
  state: DreverStudioAgentState | undefined,
  latestActionRevision: number,
): DreverStudioAgentState | undefined =>
  state?.handledActionRevision === undefined ||
  validHandledActionRevision(state.handledActionRevision, latestActionRevision)
    ? state
    : undefined;

const handledActionRevisionWithinJournal = (
  state: DreverStudioAgentState | undefined,
  latestActionRevision: number,
): number => agentStateWithinJournal(state, latestActionRevision)?.handledActionRevision ?? 0;

const readDurableHandledActionRevision = async (
  root: string,
  latestActionRevision: number,
): Promise<number> => {
  const path = join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_AGENT_STATE_FILE);
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
  let value: unknown;
  try {
    value = JSON.parse(source) as unknown;
  } catch {
    return 0;
  }
  return handledActionRevisionWithinJournal(decodeStudioAgentState(value), latestActionRevision);
};

/** @internal Forwards only actions not covered by live or validated durable agent state. */
export const forwardStudioAgentActions = async (
  root: string,
  agentProvider: Pick<StudioAgentProvider, "handleAction" | "snapshot">,
): Promise<void> => {
  const records = await readStudioActionRecords(root);
  const latestActionRevision = records.at(-1)?.revision ?? 0;
  const durableHandled = await readDurableHandledActionRevision(root, latestActionRevision);
  let liveSnapshot: StudioAgentProviderSnapshot;
  try {
    liveSnapshot = agentProvider.snapshot();
  } catch {
    liveSnapshot = Object.freeze({ connected: false });
  }
  const liveState =
    liveSnapshot.state === undefined ? undefined : decodeStudioAgentState(liveSnapshot.state);
  const liveHandled = handledActionRevisionWithinJournal(liveState, latestActionRevision);
  const handled = Math.max(durableHandled, liveHandled);
  for (const record of records) {
    if (record.revision > handled) await agentProvider.handleAction(record);
  }
};

/** @internal Atomically publishes only the fixed Studio agent-state file. */
export const writeStudioAgentState = async (
  root: string,
  value: unknown,
): Promise<DreverStudioAgentState> => {
  const state = decodeStudioAgentState(value);
  if (state === undefined) {
    throw new TypeError("The Drever Studio agent state is invalid.");
  }
  const records = await readStudioActionRecords(root);
  const latestActionRevision = records.at(-1)?.revision ?? 0;
  if ((state.handledActionRevision ?? 0) > latestActionRevision) {
    throw new TypeError(`handledActionRevision cannot exceed ${String(latestActionRevision)}.`);
  }
  if (state.draftReview !== undefined) {
    const reviewRecord = records.find(
      ({ revision }) => revision === state.draftReview?.actionRevision,
    );
    const { plan } = await loadDreverDeckPlan({ root });
    if (!draftReviewMatchesRequest(state.draftReview, reviewRecord, plan)) {
      throw new TypeError("The Drever Studio draft review does not match its requested scope.");
    }
  }
  const artifactRevisions = await artifactRevisionsForPublication(root, records, state);
  const directory = join(root, DREVER_STUDIO_DIRECTORY);
  const path = join(directory, DREVER_STUDIO_AGENT_STATE_FILE);
  const temporaryPath = `${path}.${randomUUID()}.next`;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryPath, path);
  await writeStudioArtifactCheckpoint(root, artifactRevisions);
  return state;
};

/** @internal Records the action that the local agent has just received without claiming it done. */
export const writeStudioAgentActivity = async (
  root: string,
  activity: DreverStudioActivity,
): Promise<DreverStudioAgentState> => {
  const path = join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_AGENT_STATE_FILE);
  const existingValue = await readJson(path);
  const existing = existingValue === undefined ? undefined : decodeStudioAgentState(existingValue);
  if (existingValue !== undefined && existing === undefined) {
    throw new TypeError(`Invalid Drever Studio agent state: ${path}`);
  }
  const previous =
    existing?.activity?.filter(({ id, status }) => id !== activity.id && status !== "active") ?? [];
  return writeStudioAgentState(root, {
    version: DREVER_STUDIO_PROTOCOL_VERSION,
    phase: "waiting-for-agent",
    ...(existing?.handledActionRevision === undefined
      ? {}
      : { handledActionRevision: existing.handledActionRevision }),
    activity: [...previous, activity].slice(-MAX_ACTIVITY_ITEMS),
  });
};

const reduceBrowserState = (records: readonly DreverStudioActionRecord[]) => {
  let adaptiveAnswers: readonly DreverStudioAnswer[] | undefined;
  let adaptiveQuestions: readonly DreverStudioQuestion[] | undefined;
  let commonBrief: DreverStudioCommonBrief | undefined;
  let commonBriefRevision = 0;
  let skippedRemainingQuestions = false;
  for (const { action, context, revision } of records) {
    if (action.type === "submit-common-brief") {
      commonBrief = action.brief;
      commonBriefRevision = revision;
      adaptiveAnswers = undefined;
      adaptiveQuestions = undefined;
      skippedRemainingQuestions = false;
    } else if (action.type === "submit-adaptive-answers") {
      adaptiveAnswers = action.answers;
      adaptiveQuestions = context?.adaptiveQuestions ?? adaptiveQuestions;
      skippedRemainingQuestions = false;
    } else if (action.type === "skip-remaining-questions") {
      adaptiveQuestions = context?.adaptiveQuestions ?? adaptiveQuestions;
      skippedRemainingQuestions = true;
    }
  }
  return {
    adaptiveAnswers,
    adaptiveQuestions,
    commonBrief,
    commonBriefRevision,
    skippedRemainingQuestions,
  };
};

const publicAgentApprovals = (
  approvals: readonly StudioAgentApprovalRequest[] | undefined,
  publicId: (id: string | number) => string,
): readonly DreverStudioAgentApprovalRequest[] | undefined => {
  if (approvals === undefined || approvals.length === 0) return;
  return Object.freeze(
    approvals.slice(0, MAX_ACTIVITY_ITEMS).map((approval) =>
      Object.freeze({
        id: publicId(approval.id),
        kind: approval.kind,
        ...(approval.decisions === undefined
          ? {}
          : { decisions: Object.freeze([...approval.decisions]) }),
        ...(approval.reason === undefined
          ? {}
          : { reason: approval.reason.slice(0, MAX_LONG_TEXT) }),
        ...(approval.detail === undefined
          ? {}
          : { detail: approval.detail.slice(0, MAX_LONG_TEXT) }),
      }),
    ),
  );
};

const stateWithoutRevision = async (
  root: string,
  records: readonly DreverStudioActionRecord[],
  now: Date,
  liveSnapshot?: StudioAgentProviderSnapshot,
  liveApprovals?: readonly StudioAgentApprovalRequest[],
  publicApprovalId: (id: string | number) => string = String,
  draftWasAvailable = false,
): Promise<
  Readonly<{
    agentLeaseExpiresAt?: number;
    state: Omit<DreverStudioState, "revision">;
  }>
> => {
  const agentPath = join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_AGENT_STATE_FILE);
  const heartbeatPath = join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_AGENT_HEARTBEAT_FILE);
  const [agentValue, heartbeat, persistedCheckpoint] = await Promise.all([
    readJson(agentPath),
    readStudioAgentHeartbeat(heartbeatPath),
    readStudioArtifactCheckpoint(root),
  ]);
  const latestActionRevision = records.at(-1)?.revision ?? 0;
  const decodedFileAgent =
    agentValue === undefined ? undefined : decodeStudioAgentState(agentValue);
  if (agentValue !== undefined && decodedFileAgent === undefined) {
    throw new TypeError(`Invalid Drever Studio agent state: ${agentPath}`);
  }
  const decodedLiveAgent =
    liveSnapshot?.state === undefined ? undefined : decodeStudioAgentState(liveSnapshot.state);
  const liveStateIsValid = liveSnapshot?.state === undefined || decodedLiveAgent !== undefined;
  const fileAgent = agentStateWithinJournal(decodedFileAgent, latestActionRevision);
  const liveAgent = agentStateWithinJournal(decodedLiveAgent, latestActionRevision);
  const agentLastSeenAt = heartbeat?.seenAt;
  const agentHeartbeatAge =
    agentLastSeenAt === undefined ? undefined : now.getTime() - Date.parse(agentLastSeenAt);
  const heartbeatConnected =
    agentHeartbeatAge !== undefined &&
    agentHeartbeatAge >= 0 &&
    agentHeartbeatAge < DREVER_STUDIO_AGENT_CONNECTION_TTL_MS;
  const liveAgentConnected = liveStateIsValid && liveSnapshot?.connected === true;
  const agentConnected = liveSnapshot === undefined ? heartbeatConnected : liveAgentConnected;
  const agentLeaseExpiresAt =
    heartbeatConnected && agentLastSeenAt !== undefined
      ? Date.parse(agentLastSeenAt) + DREVER_STUDIO_AGENT_CONNECTION_TTL_MS
      : undefined;
  const loadedPlan = await loadDreverDeckPlan({ root });
  const browser = reduceBrowserState(records);
  const handled = Math.max(
    handledActionRevisionWithinJournal(fileAgent, latestActionRevision),
    handledActionRevisionWithinJournal(liveAgent, latestActionRevision),
  );
  const pendingActionCount = records.filter(({ revision }) => revision > handled).length;
  const plan = loadedPlan.plan;
  const inferredCheckpoint =
    fileAgent === undefined ? {} : await artifactRevisionsForPublication(root, records, fileAgent);
  const checkpointStoryboardRevision =
    persistedCheckpoint?.storyboardRevision !== undefined &&
    persistedCheckpoint.storyboardRevision <= latestActionRevision
      ? persistedCheckpoint.storyboardRevision
      : undefined;
  const checkpointDraftRevision =
    persistedCheckpoint?.draftRevision !== undefined &&
    persistedCheckpoint.draftRevision <= latestActionRevision
      ? persistedCheckpoint.draftRevision
      : undefined;
  const storyboardRevision = Math.max(
    checkpointStoryboardRevision ?? -1,
    inferredCheckpoint.storyboardRevision ?? -1,
    plan !== undefined && latestActionRevision === 0 ? 0 : -1,
  );
  const draftRevision = Math.max(
    checkpointDraftRevision ?? -1,
    inferredCheckpoint.draftRevision ?? -1,
  );
  const storyboardInvalidationRevision = latestStoryboardInvalidationRevision(
    records,
    plan?.status,
  );
  const draftInvalidationRevision = latestDraftInvalidationRevision(records);
  const draftRequestRevision = latestDraftRequestRevision(records);
  const effectiveStoryboardRevision = Math.max(
    storyboardRevision,
    plan !== undefined && storyboardInvalidationRevision === 0 ? 0 : -1,
  );
  const storyboardOutdated =
    plan !== undefined && effectiveStoryboardRevision < storyboardInvalidationRevision;
  const agentApprovals = liveAgentConnected
    ? publicAgentApprovals(liveApprovals, publicApprovalId)
    : undefined;
  // The durable browser journal owns whether briefing is complete.
  const publishedPhase =
    browser.commonBrief !== undefined && fileAgent?.phase === "briefing"
      ? undefined
      : fileAgent?.phase;
  const livePhase =
    browser.commonBrief !== undefined && liveAgent?.phase === "briefing"
      ? undefined
      : liveAgent?.phase;
  const publishedArtifactPhase =
    publishedPhase === "preview" || publishedPhase === "ready" ? publishedPhase : undefined;
  const draftAvailable =
    draftWasAvailable ||
    draftRevision >= 0 ||
    publishedPhase === "preview" ||
    publishedPhase === "refining" ||
    publishedPhase === "ready";
  const draftOutdated = draftAvailable && draftRevision < draftInvalidationRevision;
  const draftWorkOutstanding =
    draftRequestRevision > 0 &&
    draftRequestRevision >= storyboardInvalidationRevision &&
    draftRequestRevision > draftRevision;
  const publishedArtifactIsCurrent =
    pendingActionCount === 0 && publishedArtifactPhase !== undefined && !draftOutdated;
  const publishedPlanReviewIsCurrent =
    pendingActionCount === 0 && plan?.status === "awaiting-approval" && !storyboardOutdated;
  const durableCheckpointIsCurrent = publishedArtifactIsCurrent || publishedPlanReviewIsCurrent;
  const agentPhase = publishedPlanReviewIsCurrent
    ? "plan-review"
    : publishedArtifactIsCurrent
      ? publishedArtifactPhase
      : livePhase === "error"
        ? livePhase
        : liveAgentConnected
          ? (livePhase ?? publishedPhase)
          : (publishedPhase ?? livePhase);
  const telemetryAgent =
    durableCheckpointIsCurrent ||
    liveSnapshot === undefined ||
    !liveStateIsValid ||
    liveAgent === undefined
      ? fileAgent
      : liveAgent;
  const draftReview = telemetryAgent?.draftReview;
  const latestDraftReviewRevision = latestRevisionMatching(
    records,
    ({ action }) => action.type === "request-draft-review",
  );
  const draftReviewRecord = records.find(
    ({ revision }) => revision === draftReview?.actionRevision,
  );
  const draftReviewIsCurrent =
    draftReview !== undefined &&
    draftReview.actionRevision === latestDraftReviewRevision &&
    draftReview.actionRevision >= draftInvalidationRevision &&
    draftReview.actionRevision <= handled &&
    draftReviewMatchesRequest(draftReview, draftReviewRecord, plan);
  const fileQuestionsAreCurrent =
    fileAgent?.adaptiveQuestions !== undefined &&
    (fileAgent.handledActionRevision ?? 0) >= browser.commonBriefRevision;
  const adaptiveQuestions = fileQuestionsAreCurrent
    ? fileAgent.adaptiveQuestions
    : browser.adaptiveQuestions;
  const currentPlan = storyboardOutdated ? undefined : plan;
  const phase: DreverStudioPhase =
    agentPhase === "error"
      ? "error"
      : draftWorkOutstanding
        ? draftAvailable
          ? "refining"
          : "drafting"
        : pendingActionCount > 0 && (agentPhase === "drafting" || agentPhase === "refining")
          ? agentPhase
          : pendingActionCount > 0
            ? "waiting-for-agent"
            : fileAgent?.phase === "adaptive-questions" && adaptiveQuestions !== undefined
              ? "adaptive-questions"
              : currentPlan?.status === "awaiting-approval"
                ? "plan-review"
                : agentPhase === "drafting" || agentPhase === "refining"
                  ? agentPhase
                  : browser.commonBrief === undefined && currentPlan === undefined
                    ? "briefing"
                    : currentPlan?.status === "approved"
                      ? agentPhase === "preview" || agentPhase === "ready"
                        ? agentPhase
                        : "waiting-for-agent"
                      : (agentPhase ?? "waiting-for-agent");
  return Object.freeze({
    ...(agentLeaseExpiresAt === undefined ? {} : { agentLeaseExpiresAt }),
    state: Object.freeze({
      version: DREVER_STUDIO_PROTOCOL_VERSION,
      phase,
      ...(draftAvailable ? { draftAvailable: true } : {}),
      ...(storyboardOutdated ? { storyboardOutdated: true } : {}),
      ...(draftOutdated ? { draftOutdated: true } : {}),
      ...(liveSnapshot === undefined ? {} : { agentConfigured: true }),
      agentConnected,
      latestActionRevision,
      pendingActionCount,
      ...(browser.commonBrief === undefined ? {} : { commonBrief: browser.commonBrief }),
      ...(adaptiveQuestions === undefined ? {} : { adaptiveQuestions }),
      ...(browser.adaptiveAnswers === undefined
        ? {}
        : { adaptiveAnswers: browser.adaptiveAnswers }),
      ...(browser.skippedRemainingQuestions ? { skippedRemainingQuestions: true } : {}),
      ...(plan === undefined ? {} : { plan }),
      ...(telemetryAgent?.activity === undefined ? {} : { activity: telemetryAgent.activity }),
      ...(agentApprovals === undefined ? {} : { agentApprovals }),
      ...(telemetryAgent?.progress === undefined ? {} : { progress: telemetryAgent.progress }),
      ...(draftReviewIsCurrent ? { draftReview } : {}),
      ...(telemetryAgent?.message === undefined ? {} : { message: telemetryAgent.message }),
    }),
  });
};

const comparableState = (state: DreverStudioState): string => {
  const { revision: _revision, ...value } = state;
  return JSON.stringify(value);
};

const comparableActionState = (state: DreverStudioState): string => {
  const {
    activity: _activity,
    agentConfigured: _agentConfigured,
    agentConnected: _agentConnected,
    agentApprovals: _agentApprovals,
    draftAvailable: _draftAvailable,
    message: _message,
    phase: _phase,
    progress: _progress,
    revision: _revision,
    ...value
  } = state;
  return JSON.stringify(value);
};

export type StudioSession = Readonly<{
  token: string;
  agentLeaseExpiresAt(): Promise<number | undefined>;
  read(): Promise<DreverStudioState>;
  refresh(): Promise<Readonly<{ changed: boolean; state: DreverStudioState }>>;
  accept(value: unknown, local: boolean): Promise<DreverStudioActionAck>;
}>;

const rejectedAck = (
  requestId: string,
  revision: number,
  code: string,
  message: string,
): DreverStudioActionAck =>
  Object.freeze({
    version: DREVER_STUDIO_PROTOCOL_VERSION,
    requestId,
    accepted: false,
    revision,
    error: Object.freeze({ code, message }),
  });

const readLiveAgentSnapshot = (
  provider:
    | (Pick<StudioAgentProvider, "snapshot"> &
        Partial<Pick<StudioAgentProvider, "approvals" | "respondToApproval">>)
    | undefined,
): StudioAgentProviderSnapshot | undefined => {
  if (provider === undefined) return;
  try {
    return provider.snapshot();
  } catch {
    return Object.freeze({ connected: false });
  }
};

const readLiveAgentApprovals = (
  provider:
    | (Pick<StudioAgentProvider, "snapshot"> &
        Partial<Pick<StudioAgentProvider, "approvals" | "respondToApproval">>)
    | undefined,
): readonly StudioAgentApprovalRequest[] | undefined => {
  try {
    return provider?.approvals?.();
  } catch {
    return;
  }
};

const validActionForState = (
  action: DreverStudioAction,
  state: DreverStudioState,
  records: readonly DreverStudioActionRecord[],
): Readonly<{ code: string; message: string }> | undefined => {
  if (action.type === "resume-pending") {
    if (state.agentConfigured !== true) {
      return {
        code: "DREVER_STUDIO_AGENT_UNAVAILABLE",
        message: "No managed Studio agent is configured for this session.",
      };
    }
    if (state.pendingActionCount === 0) {
      return {
        code: "DREVER_STUDIO_NOTHING_TO_RESUME",
        message: "There is no pending Studio action to resume.",
      };
    }
    if (state.agentConnected && state.phase !== "error") {
      return {
        code: "DREVER_STUDIO_AGENT_ACTIVE",
        message: "The managed Studio agent is already working on this action.",
      };
    }
    return;
  }
  const latestRecord = records.at(-1);
  const consecutiveBriefSkip =
    action.type === "skip-remaining-questions" &&
    state.pendingActionCount === 1 &&
    latestRecord?.action.type === "submit-common-brief";
  const upstreamMutation =
    action.type === "submit-common-brief" ||
    action.type === "submit-adaptive-answers" ||
    action.type === "skip-remaining-questions";
  if (
    upstreamMutation &&
    !consecutiveBriefSkip &&
    (state.pendingActionCount > 0 ||
      (state.agentConnected && (state.phase === "drafting" || state.phase === "refining")))
  ) {
    return {
      code: "DREVER_STUDIO_UPSTREAM_BUSY",
      message: "Wait for the agent to finish the current change before revising an earlier step.",
    };
  }
  if (action.type === "skip-remaining-questions" && state.commonBrief === undefined) {
    return {
      code: "DREVER_STUDIO_TOPIC_REQUIRED",
      message: "Choose a presentation topic before skipping the remaining questions.",
    };
  }
  if (action.type === "submit-adaptive-answers") {
    const questions = state.adaptiveQuestions;
    if (questions === undefined) {
      return {
        code: "DREVER_STUDIO_QUESTIONS_UNAVAILABLE",
        message: "No adaptive questions are active.",
      };
    }
    const byId = new Map(questions.map((question) => [question.id, question]));
    if (
      action.answers.length !== questions.length ||
      questions.some(
        (question) => !action.answers.some((answer) => answer.questionId === question.id),
      )
    ) {
      return {
        code: "DREVER_STUDIO_ANSWERS_INCOMPLETE",
        message: "Answer every question in this round, or skip the remaining questions.",
      };
    }
    for (const answer of action.answers) {
      const question = byId.get(answer.questionId);
      if (question === undefined) {
        return {
          code: "DREVER_STUDIO_QUESTION_UNKNOWN",
          message: `Unknown Studio question: ${answer.questionId}.`,
        };
      }
      if (
        answer.optionIds?.some(
          (optionId) => !question.options.some((option) => option.id === optionId),
        ) === true
      ) {
        return {
          code: "DREVER_STUDIO_OPTION_UNKNOWN",
          message: `An answer contains an unknown option for ${answer.questionId}.`,
        };
      }
      if (question.multiple !== true && (answer.optionIds?.length ?? 0) > 1) {
        return {
          code: "DREVER_STUDIO_ANSWER_INVALID",
          message: `${answer.questionId} accepts one option.`,
        };
      }
    }
  }
  if (action.type === "approve-plan" && state.plan?.status !== "awaiting-approval") {
    return {
      code: "DREVER_STUDIO_PLAN_NOT_REVIEWABLE",
      message: "No approval-ready plan is available.",
    };
  }
  if (action.type === "approve-plan" && state.pendingActionCount > 0) {
    return {
      code: "DREVER_STUDIO_PLAN_BUSY",
      message: "Wait for the agent to apply earlier changes before approving the story.",
    };
  }
  if (action.type === "approve-plan" && state.storyboardOutdated === true) {
    return {
      code: "DREVER_STUDIO_STORYBOARD_OUTDATED",
      message: "Wait for the agent to rebuild the Storyboard from the latest direction.",
    };
  }
  if (
    action.type === "respond-agent-approval" &&
    state.agentApprovals?.some(({ id }) => id === action.approvalId) !== true
  ) {
    return {
      code: "DREVER_STUDIO_AGENT_APPROVAL_UNKNOWN",
      message: "That agent approval is no longer waiting.",
    };
  }
  if (action.type === "respond-agent-approval") {
    const approval = state.agentApprovals?.find(({ id }) => id === action.approvalId);
    if (approval?.decisions !== undefined && !approval.decisions.includes(action.decision)) {
      return {
        code: "DREVER_STUDIO_AGENT_APPROVAL_UNSUPPORTED",
        message: "That approval choice is not available for this request.",
      };
    }
  }
  if (action.type === "submit-feedback" && state.plan === undefined) {
    return {
      code: "DREVER_STUDIO_FEEDBACK_UNAVAILABLE",
      message: "Feedback is available after the story plan exists.",
    };
  }
  if (action.type === "request-draft-review") {
    if (
      state.draftAvailable !== true ||
      state.draftOutdated === true ||
      state.phase !== "ready" ||
      state.pendingActionCount > 0
    ) {
      return {
        code: "DREVER_STUDIO_DRAFT_NOT_REVIEWABLE",
        message: "Wait for a current ready draft before asking the agent to find improvements.",
      };
    }
    if (action.scope.kind === "slide") {
      const slideId = action.scope.slideId;
      if (
        state.plan?.status === "awaiting-input" ||
        state.plan?.slides.some(({ id }) => id === slideId) !== true
      ) {
        return {
          code: "DREVER_STUDIO_SLIDE_UNKNOWN",
          message: `Unknown Studio slide: ${slideId}.`,
        };
      }
    }
  }
  if (action.type === "submit-feedback" && state.storyboardOutdated === true) {
    return {
      code: "DREVER_STUDIO_STORYBOARD_OUTDATED",
      message: "Wait for the agent to rebuild the Storyboard before sending more feedback.",
    };
  }
  if (action.type === "submit-feedback" && action.scope.kind === "slide") {
    const slideId = action.scope.slideId;
    if (
      state.plan?.status === "awaiting-input" ||
      state.plan?.slides.some(({ id }) => id === slideId) !== true
    ) {
      return {
        code: "DREVER_STUDIO_SLIDE_UNKNOWN",
        message: `Unknown Studio slide: ${slideId}.`,
      };
    }
  }
  return;
};

/** @internal Owns one local Studio action inbox and merged session state. */
export const createStudioSession = (
  root: string,
  options: Readonly<{
    agentProvider?: Pick<StudioAgentProvider, "snapshot"> &
      Partial<
        Pick<StudioAgentProvider, "approvals" | "handleAction" | "respondToApproval" | "start">
      >;
    initialTopic?: string;
    now?: () => Date;
    token?: string;
  }> = {},
): StudioSession => {
  if (options.initialTopic !== undefined && !requiredText(options.initialTopic, MAX_LONG_TEXT)) {
    throw new TypeError("The Drever Studio initial topic is invalid.");
  }
  const directory = join(root, DREVER_STUDIO_DIRECTORY);
  const actionsDirectory = join(directory, DREVER_STUDIO_ACTIONS_DIRECTORY);
  const token = options.token ?? randomUUID();
  const now = options.now ?? (() => new Date());
  const approvalIdKey = randomBytes(32);
  const publicApprovalId = (id: string | number): string =>
    createHmac("sha256", approvalIdKey)
      .update(`${typeof id}:${String(id)}`)
      .digest("base64url");
  const approvalReceipts = new Map<
    string,
    Readonly<{ ack: DreverStudioActionAck; action: DreverStudioAction }>
  >();
  const rememberApprovalReceipt = (
    action: DreverStudioAction,
    ack: DreverStudioActionAck,
  ): DreverStudioActionAck => {
    approvalReceipts.set(action.requestId, Object.freeze({ ack, action }));
    if (approvalReceipts.size > MAX_TRANSIENT_RECEIPTS) {
      const oldestRequestId = approvalReceipts.keys().next().value;
      if (oldestRequestId !== undefined) approvalReceipts.delete(oldestRequestId);
    }
    return ack;
  };
  let snapshot: StudioSessionSnapshot | undefined;

  const load = async (revision?: number): Promise<StudioSessionSnapshot> => {
    const records = await readActionRecords(actionsDirectory);
    const resolved = await stateWithoutRevision(
      root,
      records,
      now(),
      readLiveAgentSnapshot(options.agentProvider),
      readLiveAgentApprovals(options.agentProvider),
      publicApprovalId,
      snapshot?.state.draftAvailable === true,
    );
    const state = Object.freeze({
      ...resolved.state,
      ...(resolved.state.commonBrief !== undefined || options.initialTopic === undefined
        ? {}
        : { initialTopic: options.initialTopic.trim() }),
      revision: revision ?? Math.max(records.at(-1)?.revision ?? 0, snapshot?.state.revision ?? 0),
    });
    return Object.freeze({
      records,
      state,
      ...(resolved.agentLeaseExpiresAt === undefined
        ? {}
        : { agentLeaseExpiresAt: resolved.agentLeaseExpiresAt }),
    });
  };
  const current = async (): Promise<StudioSessionSnapshot> => {
    snapshot ??= await load();
    return snapshot;
  };

  return Object.freeze({
    token,
    async agentLeaseExpiresAt() {
      return (await current()).agentLeaseExpiresAt;
    },
    async read() {
      return (await current()).state;
    },
    async refresh() {
      const previous = await current();
      const candidate = await load(previous.state.revision);
      const changed = comparableState(previous.state) !== comparableState(candidate.state);
      const actionStateChanged =
        comparableActionState(previous.state) !== comparableActionState(candidate.state);
      snapshot = Object.freeze({
        ...candidate,
        state: Object.freeze({
          ...candidate.state,
          revision: actionStateChanged ? previous.state.revision + 1 : previous.state.revision,
        }),
      });
      return Object.freeze({ changed, state: snapshot.state });
    },
    async accept(value, local) {
      const before = await current();
      const requestId =
        isRecord(value) && isRecord(value.action) && typeof value.action.requestId === "string"
          ? value.action.requestId.slice(0, 128)
          : "invalid";
      if (!local) {
        return rejectedAck(
          requestId,
          before.state.revision,
          "DREVER_STUDIO_REMOTE_FORBIDDEN",
          "Drever Studio accepts changes only from this computer.",
        );
      }
      let encoded: string;
      try {
        encoded = JSON.stringify(value);
      } catch {
        encoded = "";
      }
      if (Buffer.byteLength(encoded) > MAX_PAYLOAD_BYTES) {
        return rejectedAck(
          requestId,
          before.state.revision,
          "DREVER_STUDIO_PAYLOAD_TOO_LARGE",
          "The Studio action exceeds the 32 KiB limit.",
        );
      }
      if (!isRecord(value) || !exactKeys(value, ["token", "action"]) || value.token !== token) {
        return rejectedAck(
          requestId,
          before.state.revision,
          "DREVER_STUDIO_TOKEN_INVALID",
          "The Studio session token is invalid.",
        );
      }
      const action = decodeStudioAction(value.action);
      if (action === undefined) {
        return rejectedAck(
          requestId,
          before.state.revision,
          "DREVER_STUDIO_ACTION_INVALID",
          "The Studio action is invalid.",
        );
      }
      const approvalReceipt = approvalReceipts.get(action.requestId);
      if (approvalReceipt !== undefined) {
        if (JSON.stringify(approvalReceipt.action) === JSON.stringify(action)) {
          return approvalReceipt.ack;
        }
        return rejectedAck(
          action.requestId,
          before.state.revision,
          "DREVER_STUDIO_REQUEST_ID_REUSED",
          "The Studio request id was already used for another action.",
        );
      }
      const existing = before.records.find(
        ({ action: recorded }) => recorded.requestId === action.requestId,
      );
      if (existing !== undefined) {
        if (JSON.stringify(existing.action) === JSON.stringify(action)) {
          return Object.freeze({
            version: DREVER_STUDIO_PROTOCOL_VERSION,
            requestId: action.requestId,
            accepted: true,
            revision: before.state.revision,
          });
        }
        return rejectedAck(
          action.requestId,
          before.state.revision,
          "DREVER_STUDIO_REQUEST_ID_REUSED",
          "The Studio request id was already used for another action.",
        );
      }
      if (action.expectedRevision !== before.state.revision) {
        return rejectedAck(
          action.requestId,
          before.state.revision,
          "DREVER_STUDIO_ACTION_STALE",
          "The Studio changed before this action arrived. Review the latest state and try again.",
        );
      }
      const semanticError = validActionForState(action, before.state, before.records);
      if (semanticError !== undefined) {
        return rejectedAck(
          action.requestId,
          before.state.revision,
          semanticError.code,
          semanticError.message,
        );
      }
      if (action.type === "resume-pending") {
        const provider = options.agentProvider;
        if (provider?.start === undefined || provider.handleAction === undefined) {
          return rejectedAck(
            action.requestId,
            before.state.revision,
            "DREVER_STUDIO_AGENT_UNAVAILABLE",
            "No resumable managed Studio agent is configured for this session.",
          );
        }
        return rememberApprovalReceipt(
          action,
          Object.freeze({
            version: DREVER_STUDIO_PROTOCOL_VERSION,
            requestId: action.requestId,
            accepted: true,
            revision: before.state.revision,
          }),
        );
      }
      if (action.type === "respond-agent-approval") {
        const provider = options.agentProvider;
        const approval = readLiveAgentApprovals(provider)?.find(
          ({ id }) => publicApprovalId(id) === action.approvalId,
        );
        if (provider?.respondToApproval === undefined || approval === undefined) {
          return rejectedAck(
            action.requestId,
            before.state.revision,
            "DREVER_STUDIO_AGENT_APPROVAL_UNKNOWN",
            "That agent approval is no longer waiting.",
          );
        }
        await provider.respondToApproval(approval.id, action.decision);
        snapshot = await load(before.state.revision);
        return rememberApprovalReceipt(
          action,
          Object.freeze({
            version: DREVER_STUDIO_PROTOCOL_VERSION,
            requestId: action.requestId,
            accepted: true,
            revision: snapshot.state.revision,
          }),
        );
      }
      const actionRevision = (before.records.at(-1)?.revision ?? 0) + 1;
      const adaptiveQuestions =
        action.type === "submit-adaptive-answers" || action.type === "skip-remaining-questions"
          ? before.state.adaptiveQuestions
          : undefined;
      const feedbackTarget =
        action.type === "submit-feedback"
          ? before.state.plan?.status === "approved"
            ? "draft"
            : "storyboard"
          : undefined;
      const context =
        adaptiveQuestions === undefined && feedbackTarget === undefined
          ? undefined
          : Object.freeze({
              ...(adaptiveQuestions === undefined ? {} : { adaptiveQuestions }),
              ...(feedbackTarget === undefined ? {} : { feedbackTarget }),
            });
      const record: DreverStudioActionRecord = Object.freeze({
        version: DREVER_STUDIO_PROTOCOL_VERSION,
        revision: actionRevision,
        receivedAt: now().toISOString(),
        action,
        ...(context === undefined ? {} : { context }),
      });
      await mkdir(actionsDirectory, { recursive: true, mode: 0o700 });
      const path = join(actionsDirectory, recordFileName(actionRevision));
      const temporaryPath = `${path}.${randomUUID()}.next`;
      await writeFile(temporaryPath, `${JSON.stringify(record, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temporaryPath, path);
      const records = Object.freeze([...before.records, record]);
      const resolvedAfter = await stateWithoutRevision(
        root,
        records,
        now(),
        readLiveAgentSnapshot(options.agentProvider),
        readLiveAgentApprovals(options.agentProvider),
        publicApprovalId,
        before.state.draftAvailable === true,
      );
      const state = Object.freeze({
        ...resolvedAfter.state,
        revision: before.state.revision + 1,
      });
      snapshot = Object.freeze({
        records,
        state,
        ...(resolvedAfter.agentLeaseExpiresAt === undefined
          ? {}
          : { agentLeaseExpiresAt: resolvedAfter.agentLeaseExpiresAt }),
      });
      return Object.freeze({
        version: DREVER_STUDIO_PROTOCOL_VERSION,
        requestId: action.requestId,
        accepted: true,
        revision: state.revision,
      });
    },
  });
};

/** @internal Normalizes Node's IPv4, IPv6, and IPv4-mapped loopback addresses. */
export const isLoopbackAddress = (address: string | undefined): boolean =>
  address === "::1" ||
  address === "127.0.0.1" ||
  address?.startsWith("127.") === true ||
  address?.startsWith("::ffff:127.") === true;

const isStudioRoute = (url: string | undefined): boolean => {
  if (url === undefined) return false;
  try {
    return /(?:^|\/)studio\/?$/u.test(new URL(url, "http://localhost").pathname);
  } catch {
    return false;
  }
};

const clientAddress = (client: WebSocketClient): string | undefined =>
  (
    client.socket as unknown as Readonly<{
      _socket?: Readonly<{ remoteAddress?: string }>;
    }>
  )._socket?.remoteAddress;

export const resolveStudioUrls = (
  resolvedUrls: ViteDevServer["resolvedUrls"],
  token: string,
  previewUrl: string,
): readonly string[] => {
  if (resolvedUrls === null) return [];
  const urls = new Set<string>();
  for (const audienceUrl of resolvedUrls.local) {
    const studioUrl = new URL(audienceUrl);
    studioUrl.pathname = `${studioUrl.pathname.replace(/\/+$/u, "")}/studio`;
    studioUrl.search = "";
    studioUrl.hash = new URLSearchParams({ access: token, preview: previewUrl }).toString();
    urls.add(studioUrl.href);
  }
  return [...urls];
};

/** @internal Adds the local, development-only Studio state and action protocol. */
export const createStudioPlugin = ({
  root,
  agentProvider,
  initialTopic,
  token,
}: Readonly<{
  root: string;
  agentProvider?: StudioAgentProvider;
  initialTopic?: string;
  token?: string;
}>): Plugin => {
  const session = createStudioSession(root, {
    ...(agentProvider === undefined ? {} : { agentProvider }),
    ...(initialTopic === undefined ? {} : { initialTopic }),
    ...(token === undefined ? {} : { token }),
  });
  const agentStatePath = normalizePath(
    join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_AGENT_STATE_FILE),
  );
  const agentHeartbeatPath = normalizePath(
    join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_AGENT_HEARTBEAT_FILE),
  );
  const planPath = normalizePath(join(root, DREVER_DECK_PLAN_FILE));
  const actionsPattern = `${normalizePath(join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_ACTIONS_DIRECTORY))}/**`;
  let server: ViteDevServer | undefined;
  let stopAgentSubscription: (() => void) | undefined;
  let agentUpdates = Promise.resolve();
  let updates = Promise.resolve();
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let refreshInterval: ReturnType<typeof setInterval> | undefined;
  let agentExpiryTimer: ReturnType<typeof setTimeout> | undefined;
  let publishQueued = false;
  let publishDirty = false;
  let cleanup: (() => void) | undefined;
  let lastLoggedSemanticState: string | undefined;
  const loggedAcceptedRequests = new Set<string>();
  const studioClients = new Set<WebSocketClient>();

  const logStudioState = (state: DreverStudioState): void => {
    const handledActionRevision = state.latestActionRevision - state.pendingActionCount;
    const semanticState = [
      state.phase,
      handledActionRevision,
      state.latestActionRevision,
      state.agentConnected,
    ].join(":");
    if (semanticState === lastLoggedSemanticState) return;
    lastLoggedSemanticState = semanticState;
    const terminal = state.phase === "ready" || state.phase === "error";
    server?.config.logger.info?.(
      `Drever Studio state: phase=${state.phase} handled=${String(handledActionRevision)} latest=${String(state.latestActionRevision)} agent=${state.agentConnected ? "connected" : "disconnected"}${terminal ? ` terminal=${state.phase}` : ""}.`,
    );
  };

  const logAcceptedAction = (action: DreverStudioAction, state: DreverStudioState): void => {
    if (loggedAcceptedRequests.has(action.requestId)) return;
    loggedAcceptedRequests.add(action.requestId);
    if (loggedAcceptedRequests.size > MAX_TRANSIENT_RECEIPTS) {
      const oldestRequestId = loggedAcceptedRequests.values().next().value;
      if (oldestRequestId !== undefined) loggedAcceptedRequests.delete(oldestRequestId);
    }
    server?.config.logger.info?.(
      `Drever Studio accepted browser action: type=${action.type} latest=${String(state.latestActionRevision)} state=${String(state.revision)}.`,
    );
  };

  const stopRefreshPollingIfIdle = (): void => {
    if (studioClients.size > 0 || refreshInterval === undefined) return;
    clearInterval(refreshInterval);
    refreshInterval = undefined;
  };

  const registerStudioClient = (client: WebSocketClient): boolean => {
    if (!isLoopbackAddress(clientAddress(client))) return false;
    if (studioClients.has(client)) return true;
    studioClients.add(client);
    client.socket.once("close", () => {
      studioClients.delete(client);
      stopRefreshPollingIfIdle();
    });
    return true;
  };

  const sendStudioState = (state: DreverStudioState): void => {
    const payload = { type: "custom" as const, event: DREVER_STUDIO_STATE_EVENT, data: state };
    for (const client of studioClients) {
      try {
        client.send(payload);
      } catch {
        studioClients.delete(client);
      }
    }
    stopRefreshPollingIfIdle();
  };

  const publish = async (): Promise<void> => {
    const { changed, state } = await session.refresh();
    scheduleAgentExpiry(await session.agentLeaseExpiresAt());
    logStudioState(state);
    if (!changed) return;
    sendStudioState(state);
  };

  const requestPublish = (): void => {
    publishDirty = true;
    if (publishQueued) return;
    publishQueued = true;
    updates = updates
      .then(async () => {
        publishDirty = false;
        await publish();
      })
      .catch((error: unknown) => {
        server?.config.logger.error(`Drever could not refresh Studio: ${String(error)}`);
      })
      .finally(() => {
        publishQueued = false;
        if (publishDirty) requestPublish();
      });
  };

  const scheduleAgentExpiry = (expiresAt: number | undefined): void => {
    if (agentExpiryTimer !== undefined) clearTimeout(agentExpiryTimer);
    agentExpiryTimer = undefined;
    if (expiresAt === undefined) return;
    const remaining = expiresAt - Date.now();
    agentExpiryTimer = setTimeout(
      () => {
        agentExpiryTimer = undefined;
        requestPublish();
      },
      Math.max(remaining + 25, 25),
    );
  };

  const forwardAgentActions = (restart = false): void => {
    if (agentProvider === undefined) return;
    agentUpdates = agentUpdates
      .then(async () => {
        if (restart) await agentProvider.start();
        await forwardStudioAgentActions(root, agentProvider);
      })
      .catch((error: unknown) => {
        server?.config.logger.error(`Drever could not forward a Studio action: ${String(error)}`);
      })
      .finally(requestPublish);
  };

  const startRefreshPolling = (): void => {
    if (refreshInterval !== undefined) return;
    refreshInterval = setInterval(requestPublish, STUDIO_REFRESH_INTERVAL_MS);
    refreshInterval.unref?.();
  };

  return {
    apply: "serve",
    name: "drever:studio",
    enforce: "pre",
    config: () => ({ server: { watch: { ignored: [actionsPattern] } } }),
    configureServer(value) {
      server = value;
      if (agentProvider !== undefined) {
        stopAgentSubscription = agentProvider.subscribe(requestPublish);
        void agentProvider
          .start()
          .then(() => {
            value.config.logger.info("Drever Studio agent connected.");
            forwardAgentActions();
            requestPublish();
          })
          .catch((error: unknown) => {
            value.config.logger.error(`Drever could not start the Studio agent: ${String(error)}`);
          });
      }
      value.middlewares.use((_request, response, next) => {
        response.setHeader("X-Frame-Options", "DENY");
        next();
      });
      value.middlewares.use((request, response, next) => {
        if (!isStudioRoute(request.url) || isLoopbackAddress(request.socket.remoteAddress)) {
          next();
          return;
        }
        response.statusCode = 403;
        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.end("Drever Studio is available only from this computer.\n");
      });
      value.watcher.add([agentStatePath, agentHeartbeatPath, planPath]);
      const update = (path: string): void => {
        const normalized = normalizePath(path);
        if (
          normalized !== agentStatePath &&
          normalized !== agentHeartbeatPath &&
          normalized !== planPath
        ) {
          return;
        }
        if (refreshTimer !== undefined) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          refreshTimer = undefined;
          requestPublish();
        }, 40);
      };
      value.watcher.on("add", update);
      value.watcher.on("change", update);
      value.watcher.on("unlink", update);
      value.ws.on(DREVER_STUDIO_ACTION_EVENT, (payload, client) => {
        const local = isLoopbackAddress(clientAddress(client));
        const authorized = local && isRecord(payload) && payload.token === session.token;
        const decodedAction =
          authorized && isRecord(payload) ? decodeStudioAction(payload.action) : undefined;
        if (authorized) {
          registerStudioClient(client);
          startRefreshPolling();
        }
        updates = updates
          .then(async () => {
            let ack: DreverStudioActionAck;
            try {
              ack = await session.accept(payload, local);
            } catch (error) {
              value.config.logger.error(`Drever could not store a Studio action: ${String(error)}`);
              const requestId =
                isRecord(payload) &&
                isRecord(payload.action) &&
                typeof payload.action.requestId === "string"
                  ? payload.action.requestId.slice(0, 128)
                  : "invalid";
              let revision = 0;
              try {
                revision = (await session.read()).revision;
              } catch {
                // The same storage failure can make the current revision unavailable.
              }
              ack = rejectedAck(
                requestId,
                revision,
                "DREVER_STUDIO_ACTION_FAILED",
                "Drever Studio could not persist the action.",
              );
            }
            const state = ack.accepted ? await session.read() : undefined;
            client.send({ type: "custom", event: DREVER_STUDIO_ACTION_ACK_EVENT, data: ack });
            if (state !== undefined) {
              if (decodedAction !== undefined) logAcceptedAction(decodedAction, state);
              logStudioState(state);
              sendStudioState(state);
              forwardAgentActions(
                decodedAction?.type === "resume-pending" && state.pendingActionCount > 0,
              );
            }
          })
          .catch((error: unknown) => {
            value.config.logger.error(`Drever could not publish Studio state: ${String(error)}`);
          });
      });
      value.ws.on(DREVER_STUDIO_STATE_REQUEST_EVENT, (payload, client) => {
        if (!isRecord(payload) || payload.token !== session.token) return;
        if (!registerStudioClient(client)) return;
        startRefreshPolling();
        updates = updates
          .then(async () => {
            const { state } = await session.refresh();
            scheduleAgentExpiry(await session.agentLeaseExpiresAt());
            logStudioState(state);
            client.send({
              type: "custom",
              event: DREVER_STUDIO_STATE_EVENT,
              data: state,
            });
          })
          .catch((error: unknown) => {
            value.config.logger.error(`Drever could not read Studio state: ${String(error)}`);
          });
      });
      const release = (): void => {
        if (cleanup === undefined) return;
        cleanup = undefined;
        if (refreshTimer !== undefined) clearTimeout(refreshTimer);
        if (refreshInterval !== undefined) clearInterval(refreshInterval);
        if (agentExpiryTimer !== undefined) clearTimeout(agentExpiryTimer);
        studioClients.clear();
        stopAgentSubscription?.();
        value.watcher.off("add", update);
        value.watcher.off("change", update);
        value.watcher.off("unlink", update);
      };
      cleanup = release;
      value.httpServer?.once("close", release);
    },
    closeBundle() {
      cleanup?.();
    },
  };
};

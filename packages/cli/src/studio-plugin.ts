import {
  DREVER_STUDIO_PROTOCOL_VERSION,
  type DreverStudioAction,
  type DreverStudioActionAck,
  type DreverStudioActionRecord,
  type DreverStudioActivity,
  type DreverStudioAgentApprovalDecision,
  type DreverStudioAgentApprovalRequest,
  type DreverStudioAgentState,
  type DreverStudioAnswer,
  type DreverStudioCommonBrief,
  type DreverStudioPhase,
  type DreverStudioQuestion,
  type DreverStudioState,
} from "@drever/schema";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
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
export const DREVER_STUDIO_ACTIONS_DIRECTORY = "actions";
export const DREVER_STUDIO_AGENT_CONNECTION_TTL_MS = 5 * 60 * 1_000;

const MAX_PAYLOAD_BYTES = 32 * 1024;
const MAX_SHORT_TEXT = 240;
const MAX_LONG_TEXT = 4_000;
const MAX_ACTIVITY_ITEMS = 12;
const MAX_TRANSIENT_RECEIPTS = 64;
const MAX_QUESTIONS = 3;
const MAX_OPTIONS = 4;
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

type JsonRecord = Record<string, unknown>;
type StudioSessionSnapshot = Readonly<{
  agentLeaseExpiresAt?: number;
  records: readonly DreverStudioActionRecord[];
  state: DreverStudioState;
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
    if (
      !Array.isArray(value.adaptiveQuestions) ||
      value.adaptiveQuestions.length === 0 ||
      value.adaptiveQuestions.length > MAX_QUESTIONS ||
      value.adaptiveQuestions.some((question) => decodeQuestion(question) === undefined) ||
      new Set(value.adaptiveQuestions.map((question) => (question as JsonRecord).id)).size !==
        value.adaptiveQuestions.length
    ) {
      return;
    }
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
  if (value.type === "skip-remaining-questions" || value.type === "approve-plan") {
    return exactKeys(value, base) ? (Object.freeze(value) as DreverStudioAction) : undefined;
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
    if (value.scope.kind === "deck" && exactKeys(value.scope, ["kind"])) {
      return Object.freeze(value) as DreverStudioAction;
    }
    if (
      value.scope.kind === "slide" &&
      exactKeys(value.scope, ["kind", "slideId"]) &&
      requiredText(value.scope.slideId, MAX_SHORT_TEXT) &&
      ID.test(value.scope.slideId)
    ) {
      return Object.freeze(value) as DreverStudioAction;
    }
  }
  return;
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
      return Object.freeze({
        version: DREVER_STUDIO_PROTOCOL_VERSION,
        revision: value.revision,
        receivedAt: value.receivedAt,
        action,
      });
    }),
  );
};

export const readStudioActionRecords = (
  root: string,
): Promise<readonly DreverStudioActionRecord[]> =>
  readActionRecords(join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_ACTIONS_DIRECTORY));

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
  agentProvider: StudioAgentProvider,
): Promise<void> => {
  const records = await readStudioActionRecords(root);
  const latestActionRevision = records.at(-1)?.revision ?? 0;
  const durableHandled = await readDurableHandledActionRevision(root, latestActionRevision);
  const liveHandled = handledActionRevisionWithinJournal(
    agentProvider.snapshot().state,
    latestActionRevision,
  );
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
  const directory = join(root, DREVER_STUDIO_DIRECTORY);
  const path = join(directory, DREVER_STUDIO_AGENT_STATE_FILE);
  const temporaryPath = `${path}.${randomUUID()}.next`;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryPath, path);
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
  let commonBrief: DreverStudioCommonBrief | undefined;
  let skippedRemainingQuestions = false;
  for (const { action } of records) {
    if (action.type === "submit-common-brief") {
      commonBrief = action.brief;
      adaptiveAnswers = undefined;
      skippedRemainingQuestions = false;
    } else if (action.type === "submit-adaptive-answers") {
      adaptiveAnswers = action.answers;
      skippedRemainingQuestions = false;
    } else if (action.type === "skip-remaining-questions") {
      skippedRemainingQuestions = true;
    }
  }
  return { adaptiveAnswers, commonBrief, skippedRemainingQuestions };
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
): Promise<
  Readonly<{
    agentLeaseExpiresAt?: number;
    state: Omit<DreverStudioState, "revision">;
  }>
> => {
  const agentPath = join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_AGENT_STATE_FILE);
  const heartbeatPath = join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_AGENT_HEARTBEAT_FILE);
  const [agentValue, heartbeat] = await Promise.all([
    readJson(agentPath),
    readStudioAgentHeartbeat(heartbeatPath),
  ]);
  const latestActionRevision = records.at(-1)?.revision ?? 0;
  const decodedFileAgent =
    agentValue === undefined ? undefined : decodeStudioAgentState(agentValue);
  if (agentValue !== undefined && decodedFileAgent === undefined) {
    throw new TypeError(`Invalid Drever Studio agent state: ${agentPath}`);
  }
  const decodedLiveAgent =
    liveSnapshot?.state === undefined ? undefined : decodeStudioAgentState(liveSnapshot.state);
  if (liveSnapshot?.state !== undefined && decodedLiveAgent === undefined) {
    throw new TypeError("The live Studio agent state is invalid.");
  }
  const fileAgent = agentStateWithinJournal(decodedFileAgent, latestActionRevision);
  const liveAgent = agentStateWithinJournal(decodedLiveAgent, latestActionRevision);
  const telemetryAgent = liveSnapshot === undefined ? fileAgent : liveAgent;
  const agentLastSeenAt = heartbeat?.seenAt;
  const agentHeartbeatAge =
    agentLastSeenAt === undefined ? undefined : now.getTime() - Date.parse(agentLastSeenAt);
  const heartbeatConnected =
    agentHeartbeatAge !== undefined &&
    agentHeartbeatAge >= 0 &&
    agentHeartbeatAge < DREVER_STUDIO_AGENT_CONNECTION_TTL_MS;
  const agentConnected = liveSnapshot === undefined ? heartbeatConnected : liveSnapshot.connected;
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
  const agentApprovals =
    liveSnapshot?.connected === true
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
  const agentPhase =
    livePhase === "error"
      ? livePhase
      : pendingActionCount === 0 && publishedArtifactPhase !== undefined
        ? publishedArtifactPhase
        : liveSnapshot?.connected === true
          ? (livePhase ?? publishedPhase)
          : (publishedPhase ?? livePhase);
  const phase: DreverStudioPhase =
    agentPhase === "error"
      ? "error"
      : pendingActionCount > 0 && (agentPhase === "drafting" || agentPhase === "refining")
        ? agentPhase
        : pendingActionCount > 0
          ? "waiting-for-agent"
          : fileAgent?.phase === "adaptive-questions" && fileAgent.adaptiveQuestions !== undefined
            ? "adaptive-questions"
            : plan?.status === "awaiting-approval"
              ? "plan-review"
              : agentPhase === "drafting" || agentPhase === "refining"
                ? agentPhase
                : browser.commonBrief === undefined && plan === undefined
                  ? "briefing"
                  : plan?.status === "approved"
                    ? agentPhase === "preview" || agentPhase === "ready"
                      ? agentPhase
                      : "waiting-for-agent"
                    : (agentPhase ?? "waiting-for-agent");
  return Object.freeze({
    ...(agentLeaseExpiresAt === undefined ? {} : { agentLeaseExpiresAt }),
    state: Object.freeze({
      version: DREVER_STUDIO_PROTOCOL_VERSION,
      phase,
      agentConnected,
      latestActionRevision,
      pendingActionCount,
      ...(browser.commonBrief === undefined ? {} : { commonBrief: browser.commonBrief }),
      ...(fileAgent?.adaptiveQuestions === undefined
        ? {}
        : { adaptiveQuestions: fileAgent.adaptiveQuestions }),
      ...(browser.adaptiveAnswers === undefined
        ? {}
        : { adaptiveAnswers: browser.adaptiveAnswers }),
      ...(browser.skippedRemainingQuestions ? { skippedRemainingQuestions: true } : {}),
      ...(plan === undefined ? {} : { plan }),
      ...(telemetryAgent?.activity === undefined ? {} : { activity: telemetryAgent.activity }),
      ...(agentApprovals === undefined ? {} : { agentApprovals }),
      ...(telemetryAgent?.progress === undefined ? {} : { progress: telemetryAgent.progress }),
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
    agentConnected: _agentConnected,
    agentApprovals: _agentApprovals,
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

const validActionForState = (
  action: DreverStudioAction,
  state: DreverStudioState,
): Readonly<{ code: string; message: string }> | undefined => {
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
      Partial<Pick<StudioAgentProvider, "approvals" | "respondToApproval">>;
    now?: () => Date;
    token?: string;
  }> = {},
): StudioSession => {
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
      options.agentProvider?.snapshot(),
      options.agentProvider?.approvals?.(),
      publicApprovalId,
    );
    const state = Object.freeze({
      ...resolved.state,
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
      const semanticError = validActionForState(action, before.state);
      if (semanticError !== undefined) {
        return rejectedAck(
          action.requestId,
          before.state.revision,
          semanticError.code,
          semanticError.message,
        );
      }
      if (action.type === "respond-agent-approval") {
        const provider = options.agentProvider;
        const approval = provider
          ?.approvals?.()
          .find(({ id }) => publicApprovalId(id) === action.approvalId);
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
      const record: DreverStudioActionRecord = Object.freeze({
        version: DREVER_STUDIO_PROTOCOL_VERSION,
        revision: actionRevision,
        receivedAt: now().toISOString(),
        action,
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
        options.agentProvider?.snapshot(),
        options.agentProvider?.approvals?.(),
        publicApprovalId,
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
  token,
}: Readonly<{ root: string; agentProvider?: StudioAgentProvider; token?: string }>): Plugin => {
  const session = createStudioSession(root, {
    ...(agentProvider === undefined ? {} : { agentProvider }),
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
  const studioClients = new Set<WebSocketClient>();

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

  const forwardAgentActions = (): void => {
    if (agentProvider === undefined) return;
    agentUpdates = agentUpdates
      .then(() => forwardStudioAgentActions(root, agentProvider))
      .catch((error: unknown) => {
        server?.config.logger.error(`Drever could not forward a Studio action: ${String(error)}`);
      });
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
              sendStudioState(state);
              forwardAgentActions();
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
      value.httpServer?.once("close", () => {
        if (refreshTimer !== undefined) clearTimeout(refreshTimer);
        if (refreshInterval !== undefined) clearInterval(refreshInterval);
        if (agentExpiryTimer !== undefined) clearTimeout(agentExpiryTimer);
        studioClients.clear();
        stopAgentSubscription?.();
        value.watcher.off("add", update);
        value.watcher.off("change", update);
        value.watcher.off("unlink", update);
      });
    },
  };
};

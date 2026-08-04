import {
  DREVER_STUDIO_PROTOCOL_VERSION,
  type DreverStudioAction,
  type DreverStudioActionAck,
  type DreverStudioActionRecord,
  type DreverStudioAgentState,
  type DreverStudioAnswer,
  type DreverStudioCommonBrief,
  type DreverStudioPhase,
  type DreverStudioQuestion,
  type DreverStudioState,
} from "@drever/schema";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { normalizePath, type Plugin, type ViteDevServer, type WebSocketClient } from "vite";
import { DREVER_DECK_PLAN_FILE, loadDreverDeckPlan } from "./deck-plan.ts";

export const DREVER_STUDIO_STATE_MODULE_ID = "virtual:drever/studio-state";
export const DREVER_STUDIO_ACTION_EVENT = "drever:studio-action";
export const DREVER_STUDIO_ACTION_ACK_EVENT = "drever:studio-action-ack";
export const DREVER_STUDIO_STATE_EVENT = "drever:studio-state";
export const DREVER_STUDIO_STATE_REQUEST_EVENT = "drever:studio-state-request";
export const DREVER_STUDIO_DIRECTORY = ".drever/studio";
export const DREVER_STUDIO_AGENT_STATE_FILE = "state.json";
export const DREVER_STUDIO_AGENT_HEARTBEAT_FILE = "agent-heartbeat.json";
export const DREVER_STUDIO_ACTIONS_DIRECTORY = "actions";
export const DREVER_STUDIO_AGENT_CONNECTION_TTL_MS = 5 * 60 * 1_000;

const RESOLVED_MODULE_ID = `\0${DREVER_STUDIO_STATE_MODULE_ID}`;
const MAX_PAYLOAD_BYTES = 32 * 1024;
const MAX_SHORT_TEXT = 240;
const MAX_LONG_TEXT = 4_000;
const MAX_QUESTIONS = 3;
const MAX_OPTIONS = 4;
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

export const decodeStudioAgentState = (value: unknown): DreverStudioAgentState | undefined => {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "version",
      "phase",
      "handledActionRevision",
      "adaptiveQuestions",
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

const stateWithoutRevision = async (
  root: string,
  records: readonly DreverStudioActionRecord[],
  now: Date,
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
  const agent = agentValue === undefined ? undefined : decodeStudioAgentState(agentValue);
  if (agentValue !== undefined && agent === undefined) {
    throw new TypeError(`Invalid Drever Studio agent state: ${agentPath}`);
  }
  const agentLastSeenAt = heartbeat?.seenAt;
  const agentHeartbeatAge =
    agentLastSeenAt === undefined ? undefined : now.getTime() - Date.parse(agentLastSeenAt);
  const agentConnected =
    agentHeartbeatAge !== undefined &&
    agentHeartbeatAge >= 0 &&
    agentHeartbeatAge < DREVER_STUDIO_AGENT_CONNECTION_TTL_MS;
  const agentLeaseExpiresAt =
    agentConnected && agentLastSeenAt !== undefined
      ? Date.parse(agentLastSeenAt) + DREVER_STUDIO_AGENT_CONNECTION_TTL_MS
      : undefined;
  const loadedPlan = await loadDreverDeckPlan({ root });
  const browser = reduceBrowserState(records);
  const handled = agent?.handledActionRevision ?? 0;
  const latestActionRevision = records.at(-1)?.revision ?? 0;
  const pendingActionCount = records.filter(({ revision }) => revision > handled).length;
  const plan = loadedPlan.plan;
  const phase: DreverStudioPhase =
    pendingActionCount > 0
      ? "waiting-for-agent"
      : (agent?.phase ??
        (plan?.status === "awaiting-approval"
          ? "plan-review"
          : plan?.status === "approved"
            ? "preview"
            : browser.commonBrief === undefined
              ? "briefing"
              : "waiting-for-agent"));
  return Object.freeze({
    ...(agentLeaseExpiresAt === undefined ? {} : { agentLeaseExpiresAt }),
    state: Object.freeze({
      version: DREVER_STUDIO_PROTOCOL_VERSION,
      phase,
      agentConnected,
      latestActionRevision,
      pendingActionCount,
      ...(browser.commonBrief === undefined ? {} : { commonBrief: browser.commonBrief }),
      ...(agent?.adaptiveQuestions === undefined
        ? {}
        : { adaptiveQuestions: agent.adaptiveQuestions }),
      ...(browser.adaptiveAnswers === undefined
        ? {}
        : { adaptiveAnswers: browser.adaptiveAnswers }),
      ...(browser.skippedRemainingQuestions ? { skippedRemainingQuestions: true } : {}),
      ...(plan === undefined ? {} : { plan }),
      ...(agent?.progress === undefined ? {} : { progress: agent.progress }),
      ...(agent?.message === undefined ? {} : { message: agent.message }),
    }),
  });
};

const comparableState = (state: DreverStudioState): string => {
  const { revision: _revision, ...value } = state;
  return JSON.stringify(value);
};

const comparableActionState = (state: DreverStudioState): string => {
  const { agentConnected: _agentConnected, revision: _revision, ...value } = state;
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
  options: Readonly<{ now?: () => Date; token?: string }> = {},
): StudioSession => {
  const directory = join(root, DREVER_STUDIO_DIRECTORY);
  const actionsDirectory = join(directory, DREVER_STUDIO_ACTIONS_DIRECTORY);
  const token = options.token ?? randomUUID();
  const now = options.now ?? (() => new Date());
  let snapshot: StudioSessionSnapshot | undefined;

  const load = async (revision?: number): Promise<StudioSessionSnapshot> => {
    const records = await readActionRecords(actionsDirectory);
    const resolved = await stateWithoutRevision(root, records, now());
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
      const resolvedAfter = await stateWithoutRevision(root, records, now());
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
): readonly string[] => {
  if (resolvedUrls === null) return [];
  const urls = new Set<string>();
  for (const audienceUrl of resolvedUrls.local) {
    const studioUrl = new URL(audienceUrl);
    studioUrl.pathname = `${studioUrl.pathname.replace(/\/+$/u, "")}/studio`;
    studioUrl.search = "";
    studioUrl.hash = "";
    urls.add(studioUrl.href);
  }
  return [...urls];
};

/** @internal Adds the local, development-only Studio state and action protocol. */
export const createStudioPlugin = ({ root }: Readonly<{ root: string }>): Plugin => {
  const session = createStudioSession(root);
  const agentStatePath = normalizePath(
    join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_AGENT_STATE_FILE),
  );
  const agentHeartbeatPath = normalizePath(
    join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_AGENT_HEARTBEAT_FILE),
  );
  const planPath = normalizePath(join(root, DREVER_DECK_PLAN_FILE));
  const actionsPattern = `${normalizePath(join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_ACTIONS_DIRECTORY))}/**`;
  let server: ViteDevServer | undefined;
  let updates = Promise.resolve();
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let agentExpiryTimer: ReturnType<typeof setTimeout> | undefined;

  const scheduleAgentExpiry = (expiresAt: number | undefined): void => {
    if (agentExpiryTimer !== undefined) clearTimeout(agentExpiryTimer);
    agentExpiryTimer = undefined;
    if (expiresAt === undefined) return;
    const remaining = expiresAt - Date.now();
    agentExpiryTimer = setTimeout(
      () => {
        agentExpiryTimer = undefined;
        updates = updates.then(publish).catch((error: unknown) => {
          server?.config.logger.error(`Drever could not refresh Studio: ${String(error)}`);
        });
      },
      Math.max(remaining + 25, 25),
    );
  };

  const publish = async (): Promise<void> => {
    const { changed, state } = await session.refresh();
    scheduleAgentExpiry(await session.agentLeaseExpiresAt());
    if (!changed) return;
    const module = server?.moduleGraph.getModuleById(RESOLVED_MODULE_ID);
    if (module !== undefined) server?.moduleGraph.invalidateModule(module);
    server?.ws.send({ type: "custom", event: DREVER_STUDIO_STATE_EVENT, data: state });
  };

  return {
    apply: "serve",
    name: "drever:studio",
    enforce: "pre",
    config: () => ({ server: { watch: { ignored: [actionsPattern] } } }),
    configureServer(value) {
      server = value;
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
          updates = updates.then(publish).catch((error: unknown) => {
            value.config.logger.error(`Drever could not refresh Studio: ${String(error)}`);
          });
        }, 40);
      };
      value.watcher.on("add", update);
      value.watcher.on("change", update);
      value.watcher.on("unlink", update);
      value.ws.on(DREVER_STUDIO_ACTION_EVENT, (payload, client) => {
        updates = updates
          .then(async () => {
            let ack: DreverStudioActionAck;
            try {
              ack = await session.accept(payload, isLoopbackAddress(clientAddress(client)));
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
            client.send({ type: "custom", event: DREVER_STUDIO_ACTION_ACK_EVENT, data: ack });
            if (!ack.accepted) return;
            const state = await session.read();
            value.ws.send({ type: "custom", event: DREVER_STUDIO_STATE_EVENT, data: state });
          })
          .catch((error: unknown) => {
            value.config.logger.error(`Drever could not publish Studio state: ${String(error)}`);
          });
      });
      value.ws.on(DREVER_STUDIO_STATE_REQUEST_EVENT, (_data, client) => {
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
        if (agentExpiryTimer !== undefined) clearTimeout(agentExpiryTimer);
        value.watcher.off("add", update);
        value.watcher.off("change", update);
        value.watcher.off("unlink", update);
      });
    },
    resolveId(source) {
      if (source === DREVER_STUDIO_STATE_MODULE_ID) return RESOLVED_MODULE_ID;
    },
    async load(id) {
      if (id !== RESOLVED_MODULE_ID) return;
      const state = await session.read();
      scheduleAgentExpiry(await session.agentLeaseExpiresAt());
      return `export const studioState = ${JSON.stringify(state)};\nexport const studioToken = ${JSON.stringify(session.token)};\n`;
    },
  };
};

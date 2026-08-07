import { spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import {
  PROTOCOL_VERSION,
  client,
  methods,
  ndJsonStream,
  type ClientConnection,
  type Implementation,
  type RequestPermissionResponse,
} from "@agentclientprotocol/sdk";
import type {
  DreverStudioActionRecord,
  DreverStudioActivity,
  DreverStudioAgentState,
  DreverStudioPhase,
} from "@drever/schema";
import {
  ACP_STDIO_AGENT_COMMANDS,
  normalizeAcpPermissionRequest,
  normalizeAcpSessionNotification,
  type AcpSafeEvent,
  type AcpStdioAgentCommand,
  type AcpStdioAgentName,
} from "./acp-agent-client.ts";
import { DREVER_VERSION } from "./package-version.ts";
import {
  createStudioActionPublicationVerifier,
  type StudioActionPublicationVerifier,
  withStudioActionPublicationGrace,
} from "./studio-agent-publication.ts";
import {
  phaseForStudioAction,
  signalStudioAgentProcess,
  studioAgentProcessOptions,
  studioActionAgentPayload,
  studioActionWorkflowInstructions,
  type StudioAgentApprovalDecision,
  type StudioAgentApprovalRequest,
  type StudioAgentProvider,
  type StudioAgentProviderSnapshot,
} from "./studio-agent-provider.ts";

const CLIENT_INFO: Implementation = Object.freeze({
  name: "drever-studio",
  title: "Drever Studio",
  version: DREVER_VERSION,
});

type AcpAgentProcess = Readonly<{
  input: Writable;
  output: Readable;
  closed: Promise<Readonly<{ code: number | null; signal: NodeJS.Signals | null }>>;
  stop(): Promise<void>;
}>;

export type LaunchAcpAgent = (command: AcpStdioAgentCommand, cwd: string) => AcpAgentProcess;

export type AcpStudioAgentProviderOptions = Readonly<{
  agent: AcpStdioAgentName;
  cwd: string;
  launch?: LaunchAcpAgent;
  sessionId?: string;
  shutdownTimeoutMs?: number;
  startupTimeoutMs?: number;
  turnTimeoutMs?: number;
  verifyActionHandled?: StudioActionPublicationVerifier;
}>;

export type AcpStudioAgentCapabilities = Readonly<{
  agentInfo?: Implementation | null;
  closeSession: boolean;
  loadSession: boolean;
  protocolVersion: number;
}>;

export type AcpStudioAgentProvider = StudioAgentProvider &
  Readonly<{
    capabilities(): AcpStudioAgentCapabilities | undefined;
  }>;

type PendingApproval = Readonly<{
  event: Extract<AcpSafeEvent, Readonly<{ kind: "permission-request" }>>;
  request: StudioAgentApprovalRequest;
  resolve(response: RequestPermissionResponse): void;
}>;

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 2_000;
const DEFAULT_STARTUP_TIMEOUT_MS = 30_000;
const DEFAULT_TURN_TIMEOUT_MS = 15 * 60_000;
const MAX_ACTION_ATTEMPTS = 2;
const PUBLIC_AGENT_ERROR =
  "The local agent could not complete this step. Check the terminal for details.";

class AcpRecoverableError extends Error {}

class AcpTimeoutError extends Error {}

const positiveTimeout = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive number.`);
  }
  return value;
};

const completeWithin = async <Result>(
  operation: Promise<Result>,
  timeoutMs: number,
  message: string,
): Promise<Result> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new AcpTimeoutError(message)), timeoutMs);
    timer.unref();
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

const settleWithin = async (operation: Promise<unknown>, timeoutMs: number): Promise<boolean> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
    timer.unref();
  });
  const settled = operation.then(
    () => true as const,
    () => true as const,
  );
  const result = await Promise.race([settled, timeout]);
  if (timer !== undefined) clearTimeout(timer);
  return result;
};

const launchNativeAcpAgent: LaunchAcpAgent = (command, cwd) => {
  const child = spawn(command.command, [...command.args], {
    ...studioAgentProcessOptions(cwd),
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stderr.on("data", (chunk: Buffer | string) => {
    process.stderr.write(chunk);
  });
  const closed = new Promise<Readonly<{ code: number | null; signal: NodeJS.Signals | null }>>(
    (resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => resolve(Object.freeze({ code, signal })));
    },
  );
  return Object.freeze({
    input: child.stdin,
    output: child.stdout,
    closed,
    async stop() {
      child.stdin.end();
      if (!child.killed) signalStudioAgentProcess(child, "SIGTERM");
      if (await settleWithin(closed, DEFAULT_SHUTDOWN_TIMEOUT_MS)) return;
      signalStudioAgentProcess(child, "SIGKILL");
      await settleWithin(closed, DEFAULT_SHUTDOWN_TIMEOUT_MS);
    },
  });
};

const approvalKind = (
  toolKind: Extract<AcpSafeEvent, Readonly<{ kind: "permission-request" }>>["toolCall"]["toolKind"],
): StudioAgentApprovalRequest["kind"] => {
  if (toolKind === "execute") return "command";
  if (toolKind === "edit" || toolKind === "delete" || toolKind === "move") {
    return "file-change";
  }
  return "permissions";
};

type AcpPermissionOption = Extract<
  AcpSafeEvent,
  Readonly<{ kind: "permission-request" }>
>["options"][number];

const approvalDecisions = (
  options: readonly AcpPermissionOption[],
): readonly StudioAgentApprovalDecision[] =>
  Object.freeze([
    ...(options.some(({ kind }) => kind === "allow_once") ? (["accept"] as const) : []),
    ...(options.some(({ kind }) => kind === "allow_always") ? (["acceptForSession"] as const) : []),
    ...(options.some(({ kind }) => kind === "reject_once" || kind === "reject_always")
      ? (["decline"] as const)
      : []),
    "cancel" as const,
  ]);

const approvalOption = (
  options: readonly AcpPermissionOption[],
  decision: StudioAgentApprovalDecision,
): AcpPermissionOption | undefined => {
  const preferred =
    decision === "accept"
      ? ["allow_once"]
      : decision === "acceptForSession"
        ? ["allow_always"]
        : decision === "decline"
          ? ["reject_once", "reject_always"]
          : [];
  return preferred.flatMap((kind) => options.filter((option) => option.kind === kind)).at(0);
};

const toolPresentation = (
  toolKind: Extract<AcpSafeEvent, Readonly<{ kind: "tool-call" }>>["toolKind"],
): Readonly<{ activityDetail: string; activityLabel: string; approvalReason: string }> => {
  switch (toolKind) {
    case "read":
      return {
        activityDetail: "Project read",
        activityLabel: "Reading project context",
        approvalReason: "Allow the agent to read project context?",
      };
    case "edit":
      return {
        activityDetail: "File update",
        activityLabel: "Updating the presentation",
        approvalReason: "Allow the agent to update project files?",
      };
    case "delete":
      return {
        activityDetail: "File removal",
        activityLabel: "Updating project files",
        approvalReason: "Allow the agent to remove project files?",
      };
    case "move":
      return {
        activityDetail: "File move",
        activityLabel: "Organizing project files",
        approvalReason: "Allow the agent to move project files?",
      };
    case "search":
      return {
        activityDetail: "Project search",
        activityLabel: "Searching project context",
        approvalReason: "Allow the agent to search project context?",
      };
    case "execute":
      return {
        activityDetail: "Project command",
        activityLabel: "Running a project task",
        approvalReason: "Allow the agent to run a project command?",
      };
    case "fetch":
      return {
        activityDetail: "Reference request",
        activityLabel: "Gathering reference material",
        approvalReason: "Allow the agent to fetch reference material?",
      };
    case "switch_mode":
      return {
        activityDetail: "Agent mode",
        activityLabel: "Updating the agent mode",
        approvalReason: "Allow the agent to change its working mode?",
      };
    case "think":
      return {
        activityDetail: "Planning",
        activityLabel: "Preparing the next step",
        approvalReason: "Allow the agent to continue planning?",
      };
    case "other":
    default:
      return {
        activityDetail: "Agent tool",
        activityLabel: "Working on the presentation",
        approvalReason: "Allow the agent to use this capability?",
      };
  }
};

const activityForAction = (record: DreverStudioActionRecord): DreverStudioActivity => {
  const shared = { id: `studio-action-${String(record.revision)}`, status: "active" as const };
  switch (record.action.type) {
    case "submit-common-brief":
      return Object.freeze({ ...shared, label: "Preparing tailored questions" });
    case "submit-adaptive-answers":
    case "skip-remaining-questions":
      return Object.freeze({ ...shared, label: "Shaping the storyboard" });
    case "approve-plan":
      return Object.freeze({ ...shared, label: "Building the first preview" });
    case "respond-agent-approval":
      return Object.freeze({ ...shared, label: "Resuming approved agent work" });
    case "submit-feedback":
      return Object.freeze({ ...shared, label: "Applying your feedback" });
  }
};

const promptForAction = (record: DreverStudioActionRecord): string =>
  [
    "Handle this Drever Studio action now.",
    "Before acting, read the available project contract: AGENTS.md and .agents/skills/drever-create-deck/SKILL.md, or CLAUDE.md and .claude/skills/drever-create-deck/SKILL.md when the Codex files are absent.",
    "Keep the browser informed through concise public progress updates. Never expose private reasoning.",
    "Follow the project-local Drever workflow and publication contract; do not wait for terminal input.",
    studioActionWorkflowInstructions(record),
    JSON.stringify(studioActionAgentPayload(record)),
  ]
    .filter((part) => part.length > 0)
    .join("\n\n");

const boundedText = (value: string, limit = 480): string => value.trim().slice(0, limit);

const boundedLabel = (value: string, fallback: string): string =>
  boundedText(value, 240) || fallback;

const safeId = (prefix: string, value: string | number): string => {
  const suffix = String(value)
    .toLowerCase()
    .replace(/[^a-z\d]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 180);
  return `${prefix}-${suffix.length === 0 ? "item" : suffix}`;
};

class AcpStudioAgentProviderImplementation implements AcpStudioAgentProvider {
  readonly #agent: AcpStdioAgentName;
  readonly #cwd: string;
  readonly #launch: LaunchAcpAgent;
  readonly #requestedSessionId: string | undefined;
  readonly #shutdownTimeoutMs: number;
  readonly #startupTimeoutMs: number;
  readonly #turnTimeoutMs: number;
  readonly #verifyActionHandled: StudioActionPublicationVerifier;
  readonly #listeners = new Set<() => void>();
  readonly #activities = new Map<string, DreverStudioActivity>();
  readonly #messages = new Map<string, string>();
  readonly #pendingApprovals = new Map<string | number, PendingApproval>();
  #capabilities: AcpStudioAgentCapabilities | undefined;
  #connection: ClientConnection | undefined;
  #connected = false;
  #approvalSequence = 0;
  #handledActionRevision?: number;
  #message: string | undefined;
  #phase: DreverStudioPhase = "waiting-for-agent";
  #process: AcpAgentProcess | undefined;
  #sessionId: string | undefined;
  #startPromise: Promise<void> | undefined;
  #stopping = false;
  #turnActive = false;
  #turns: Promise<void> = Promise.resolve();

  constructor(options: AcpStudioAgentProviderOptions) {
    this.#agent = options.agent;
    this.#cwd = options.cwd;
    this.#launch = options.launch ?? launchNativeAcpAgent;
    this.#requestedSessionId = options.sessionId;
    this.#shutdownTimeoutMs = positiveTimeout(
      options.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS,
      "shutdownTimeoutMs",
    );
    this.#startupTimeoutMs = positiveTimeout(
      options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS,
      "startupTimeoutMs",
    );
    this.#turnTimeoutMs = positiveTimeout(
      options.turnTimeoutMs ?? DEFAULT_TURN_TIMEOUT_MS,
      "turnTimeoutMs",
    );
    this.#verifyActionHandled =
      options.verifyActionHandled ??
      withStudioActionPublicationGrace(createStudioActionPublicationVerifier(options.cwd));
  }

  capabilities(): AcpStudioAgentCapabilities | undefined {
    return this.#capabilities;
  }

  snapshot(): StudioAgentProviderSnapshot {
    const state: DreverStudioAgentState = Object.freeze({
      version: 1,
      phase: this.#phase,
      ...(this.#handledActionRevision === undefined
        ? {}
        : { handledActionRevision: this.#handledActionRevision }),
      ...(this.#activities.size === 0 ? {} : { activity: [...this.#activities.values()] }),
      ...(this.#message === undefined ? {} : { message: this.#message }),
    });
    return Object.freeze({
      connected: this.#connected,
      ...(this.#sessionId === undefined ? {} : { sessionId: this.#sessionId }),
      state,
    });
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  approvals(): readonly StudioAgentApprovalRequest[] {
    return Object.freeze([...this.#pendingApprovals.values()].map(({ request }) => request));
  }

  async start(): Promise<void> {
    if (this.#connected) return;
    if (this.#stopping) throw new Error("The ACP Studio provider has stopped.");
    if (this.#startPromise !== undefined) return this.#startPromise;
    const start = this.#startProcess();
    this.#startPromise = start;
    try {
      await start;
    } finally {
      if (this.#startPromise === start) this.#startPromise = undefined;
    }
  }

  async #startProcess(): Promise<void> {
    if (this.#process !== undefined) throw new Error("ACP Studio provider is already starting.");
    const process = this.#launch(ACP_STDIO_AGENT_COMMANDS[this.#agent], this.#cwd);
    this.#process = process;
    const app = client({ name: "drever-studio" })
      .onRequest(methods.client.session.requestPermission, ({ params, requestId }) =>
        this.#requestPermission(requestId, params),
      )
      .onNotification(methods.client.session.update, ({ params }) => {
        this.#receiveSessionUpdate(params);
      });
    const stream = ndJsonStream(
      Writable.toWeb(process.input) as WritableStream<Uint8Array>,
      Readable.toWeb(process.output) as ReadableStream<Uint8Array>,
    );
    const connection = app.connect(stream);
    this.#connection = connection;

    try {
      const processExit = process.closed.then(({ code, signal }) => {
        throw new Error(
          `${ACP_STDIO_AGENT_COMMANDS[this.#agent].label} exited before connecting (${code === null ? String(signal) : String(code)}).`,
        );
      });
      const handshake = (async () => {
        const initialized = await Promise.race([
          connection.agent.request(methods.agent.initialize, {
            protocolVersion: PROTOCOL_VERSION,
            clientCapabilities: {},
            clientInfo: CLIENT_INFO,
          }),
          processExit,
        ]);
        if (initialized.protocolVersion !== PROTOCOL_VERSION) {
          throw new Error(
            `Agent negotiated unsupported ACP protocol ${String(initialized.protocolVersion)}.`,
          );
        }
        const capabilities = initialized.agentCapabilities;
        let sessionId: string;
        if (this.#requestedSessionId !== undefined) {
          if (capabilities?.loadSession !== true) {
            throw new Error(
              `${ACP_STDIO_AGENT_COMMANDS[this.#agent].label} cannot load ACP sessions.`,
            );
          }
          await Promise.race([
            connection.agent.request(methods.agent.session.load, {
              cwd: this.#cwd,
              mcpServers: [],
              sessionId: this.#requestedSessionId,
            }),
            processExit,
          ]);
          sessionId = this.#requestedSessionId;
        } else {
          const session = await Promise.race([
            connection.agent.request(methods.agent.session.new, {
              cwd: this.#cwd,
              mcpServers: [],
            }),
            processExit,
          ]);
          sessionId = session.sessionId;
        }
        return Object.freeze({ capabilities, initialized, sessionId });
      })();
      const { capabilities, initialized, sessionId } = await completeWithin(
        handshake,
        this.#startupTimeoutMs,
        `${ACP_STDIO_AGENT_COMMANDS[this.#agent].label} did not connect in time.`,
      );
      if (this.#process !== process || this.#stopping) {
        throw new Error("ACP Studio provider stopped while the agent was connecting.");
      }
      this.#capabilities = Object.freeze({
        ...(initialized.agentInfo === undefined ? {} : { agentInfo: initialized.agentInfo }),
        closeSession: capabilities?.sessionCapabilities?.close != null,
        loadSession: capabilities?.loadSession === true,
        protocolVersion: initialized.protocolVersion,
      });
      this.#sessionId = sessionId;
      this.#connected = true;
      this.#phase = "waiting-for-agent";
      this.#message = undefined;
      this.#emit();
      void process.closed.then(
        ({ code, signal }) => {
          void this.#handleProcessExit(
            process,
            connection,
            new Error(
              `${ACP_STDIO_AGENT_COMMANDS[this.#agent].label} exited (${code === null ? String(signal) : String(code)}).`,
            ),
          );
        },
        (error: unknown) => {
          void this.#handleProcessExit(process, connection, error);
        },
      );
    } catch (error) {
      this.#fail(error);
      await this.#releaseProcess(process, connection, error, false, false);
      throw new AcpRecoverableError(
        error instanceof Error ? error.message : "The ACP Studio agent could not connect.",
        { cause: error },
      );
    }
  }

  async stop(): Promise<void> {
    this.#stopping = true;
    const process = this.#process;
    const connection = this.#connection;
    if (process === undefined || connection === undefined) {
      this.#connected = false;
      this.#cancelApprovals();
      this.#emit();
      return;
    }
    await this.#releaseProcess(process, connection, undefined, true, true);
  }

  async handleAction(record: DreverStudioActionRecord): Promise<void> {
    const turn = this.#turns.then(() => this.#deliverAction(record));
    this.#turns = turn.catch(() => undefined);
    return turn;
  }

  async respondToApproval(
    requestId: string | number,
    decision: StudioAgentApprovalDecision,
  ): Promise<void> {
    const pending = this.#pendingApprovals.get(requestId);
    if (pending === undefined)
      throw new Error(`Unknown ACP permission request: ${String(requestId)}`);
    const decisions = pending.request.decisions;
    if (decisions !== undefined && !decisions.includes(decision)) {
      throw new TypeError(`ACP permission request does not support ${decision}.`);
    }
    let response: RequestPermissionResponse;
    if (decision === "cancel") {
      response = { outcome: { outcome: "cancelled" } };
    } else {
      const option = approvalOption(pending.event.options, decision);
      if (option === undefined) {
        throw new TypeError(`ACP permission request does not support ${decision}.`);
      }
      response = { outcome: { outcome: "selected", optionId: option.optionId } };
    }
    this.#pendingApprovals.delete(requestId);
    pending.resolve(response);
    this.#emit();
  }

  async #deliverAction(record: DreverStudioActionRecord): Promise<void> {
    if (
      this.#handledActionRevision !== undefined &&
      record.revision <= this.#handledActionRevision
    ) {
      return;
    }
    for (let attempt = 0; attempt < MAX_ACTION_ATTEMPTS; attempt += 1) {
      try {
        await this.start();
        await this.#runAction(record);
        return;
      } catch (error) {
        if (!(error instanceof AcpRecoverableError) || this.#stopping) {
          throw error;
        }
        let publicationVerified: boolean;
        try {
          publicationVerified = await this.#verifyActionHandled(record);
        } catch (cause) {
          const verificationError = new Error(
            "Drever could not verify the ACP Studio publication before retrying.",
            { cause },
          );
          this.#failTurn(verificationError);
          throw verificationError;
        }
        if (publicationVerified) {
          this.#markActionHandled(record);
          return;
        }
        if (attempt === MAX_ACTION_ATTEMPTS - 1) throw error;
      }
    }
  }

  async #runAction(record: DreverStudioActionRecord): Promise<void> {
    const connection = this.#connection;
    const process = this.#process;
    const sessionId = this.#sessionId;
    if (
      !this.#connected ||
      connection === undefined ||
      process === undefined ||
      sessionId === undefined
    ) {
      throw new Error("Start the ACP Studio provider before sending actions.");
    }
    this.#messages.clear();
    this.#message = undefined;
    this.#phase = phaseForStudioAction(record);
    this.#setActivity(activityForAction(record));
    this.#turnActive = true;
    try {
      let response;
      try {
        response = await completeWithin(
          connection.agent.request(methods.agent.session.prompt, {
            sessionId,
            prompt: [{ type: "text", text: promptForAction(record) }],
          }),
          this.#turnTimeoutMs,
          `${ACP_STDIO_AGENT_COMMANDS[this.#agent].label} did not finish the Studio action in time.`,
        );
      } catch (error) {
        if (this.#process === process) {
          this.#fail(error);
          await this.#releaseProcess(process, connection, error, true, false);
        }
        throw new AcpRecoverableError(
          error instanceof Error ? error.message : "The ACP Studio agent turn failed.",
          { cause: error },
        );
      }
      if (response.stopReason !== "end_turn") {
        const error = new Error(`ACP turn stopped with ${response.stopReason}.`);
        this.#failTurn(error);
        throw error;
      }
      let publicationVerified: boolean;
      try {
        publicationVerified = await this.#verifyActionHandled(record);
      } catch (cause) {
        const error = new Error("Drever could not verify the ACP Studio publication.", { cause });
        this.#failTurn(error);
        throw error;
      }
      if (!publicationVerified) {
        const error = new Error(
          `${ACP_STDIO_AGENT_COMMANDS[this.#agent].label} completed without publishing the handled Studio action.`,
        );
        this.#failTurn(error);
        throw error;
      }
      this.#markActionHandled(record);
    } finally {
      this.#turnActive = false;
      this.#emit();
    }
  }

  #requestPermission(
    requestId: string | number | null,
    params: Parameters<typeof normalizeAcpPermissionRequest>[1],
  ): Promise<RequestPermissionResponse> {
    const event = normalizeAcpPermissionRequest(requestId, params);
    this.#approvalSequence += 1;
    const publicId = `acp-permission-${String(this.#approvalSequence)}`;
    const presentation = toolPresentation(event.toolCall.toolKind);
    const publicDetail = [
      event.toolCall.title ?? presentation.activityDetail,
      event.toolCall.location,
    ]
      .filter((part): part is string => part !== undefined)
      .join(" · ")
      .slice(0, 240);
    const request = Object.freeze({
      id: publicId,
      kind: approvalKind(event.toolCall.toolKind),
      itemId: safeId("acp-item", event.toolCall.toolCallId),
      decisions: approvalDecisions(event.options),
      reason: presentation.approvalReason,
      detail: publicDetail,
    }) satisfies StudioAgentApprovalRequest;
    return new Promise((resolve) => {
      this.#pendingApprovals.set(publicId, Object.freeze({ event, request, resolve }));
      this.#emit();
    });
  }

  async #handleProcessExit(
    process: AcpAgentProcess,
    connection: ClientConnection,
    error: unknown,
  ): Promise<void> {
    if (this.#stopping || this.#process !== process) return;
    this.#fail(error);
    await this.#releaseProcess(process, connection, error, false, false);
  }

  async #releaseProcess(
    process: AcpAgentProcess,
    connection: ClientConnection,
    error: unknown,
    cancelTurn: boolean,
    closeSession: boolean,
  ): Promise<void> {
    if (this.#process !== process) return;
    const sessionId = this.#sessionId;
    const canCloseSession = this.#capabilities?.closeSession === true;
    const turnWasActive = this.#turnActive;
    this.#process = undefined;
    this.#connection = undefined;
    this.#sessionId = undefined;
    this.#capabilities = undefined;
    this.#connected = false;
    this.#turnActive = false;
    this.#cancelApprovals();

    if (sessionId !== undefined) {
      const gracefulShutdown = (async () => {
        if (cancelTurn && turnWasActive) {
          await connection.agent
            .notify(methods.agent.session.cancel, { sessionId })
            .catch(() => undefined);
        }
        if (closeSession && canCloseSession) {
          await connection.agent
            .request(methods.agent.session.close, { sessionId })
            .catch(() => undefined);
        }
      })();
      await settleWithin(gracefulShutdown, this.#shutdownTimeoutMs);
    }
    connection.close(error instanceof Error ? error : undefined);
    await settleWithin(process.stop(), this.#shutdownTimeoutMs);
    this.#emit();
  }

  #cancelApprovals(): void {
    for (const approval of this.#pendingApprovals.values()) {
      approval.resolve({ outcome: { outcome: "cancelled" } });
    }
    this.#pendingApprovals.clear();
  }

  #receiveSessionUpdate(notification: Parameters<typeof normalizeAcpSessionNotification>[0]): void {
    if (notification.sessionId !== this.#sessionId) return;
    for (const event of normalizeAcpSessionNotification(notification)) this.#receiveEvent(event);
  }

  #receiveEvent(event: AcpSafeEvent): void {
    if (event.kind === "agent-message") {
      const messageId = event.messageId ?? "current";
      const text = `${this.#messages.get(messageId) ?? ""}${event.text}`.slice(0, 4_000);
      this.#messages.set(messageId, text);
      const visibleText = text.trim();
      if (visibleText.length === 0) return;
      this.#message = visibleText;
      this.#setActivity(
        Object.freeze({
          id: safeId("acp-message", messageId),
          label: boundedText(visibleText, 240),
          status: "active",
        }),
      );
      return;
    }
    if (event.kind === "tool-call") {
      const id = safeId("acp-tool", event.toolCallId);
      const previous = this.#activities.get(id);
      const presentation = toolPresentation(event.toolKind);
      this.#setActivity(
        Object.freeze({
          id,
          label:
            event.toolKind === undefined && previous !== undefined
              ? previous.label
              : presentation.activityLabel,
          detail:
            event.toolKind === undefined && previous?.detail !== undefined
              ? previous.detail
              : presentation.activityDetail,
          status:
            event.status === "completed"
              ? "complete"
              : event.status === "failed"
                ? "error"
                : "active",
        }),
      );
      return;
    }
    if (event.kind === "plan") {
      const visibleEntries = event.entries.filter(({ status }) => status !== "pending");
      for (const [index, entry] of visibleEntries.entries()) {
        this.#setActivity(
          Object.freeze({
            id: `acp-plan-${String(index)}`,
            label: boundedLabel(entry.content, "Preparing the next step"),
            status: entry.status === "in_progress" ? "active" : "complete",
          }),
        );
      }
    }
  }

  #setActivity(activity: DreverStudioActivity): void {
    if (activity.status === "active") {
      for (const [id, existing] of this.#activities) {
        if (id !== activity.id && existing.status === "active") {
          this.#activities.set(id, Object.freeze({ ...existing, status: "complete" }));
        }
      }
    }
    this.#activities.set(activity.id, activity);
    while (this.#activities.size > 12) {
      const oldest = this.#activities.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.#activities.delete(oldest);
    }
    this.#emit();
  }

  #completeActivity(id: string): void {
    const activity = this.#activities.get(id);
    if (activity === undefined) return;
    this.#activities.set(id, Object.freeze({ ...activity, status: "complete" }));
  }

  #markActionHandled(record: DreverStudioActionRecord): void {
    this.#handledActionRevision = record.revision;
    this.#completeActivity(`studio-action-${String(record.revision)}`);
    this.#emit();
  }

  #fail(error: unknown): void {
    this.#publishFailure(error, true);
  }

  #failTurn(error: unknown): void {
    this.#publishFailure(error, false);
  }

  #publishFailure(error: unknown, disconnect: boolean): void {
    console.error(`[drever] ${ACP_STDIO_AGENT_COMMANDS[this.#agent].label} failed:`, error);
    if (disconnect) this.#connected = false;
    this.#phase = "error";
    this.#message = PUBLIC_AGENT_ERROR;
    for (const [id, activity] of this.#activities) {
      if (activity.status === "active") {
        this.#activities.set(id, Object.freeze({ ...activity, status: "error" }));
      }
    }
    this.#emit();
  }

  #emit(): void {
    for (const listener of this.#listeners) listener();
  }
}

/** Creates one persistent ACP v1 session backed by a verified native agent command. */
export const createAcpStudioAgentProvider = (
  options: AcpStudioAgentProviderOptions,
): AcpStudioAgentProvider => new AcpStudioAgentProviderImplementation(options);

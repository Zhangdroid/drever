import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type {
  DreverStudioActionRecord,
  DreverStudioActivity,
  DreverStudioAgentState,
  DreverStudioPhase,
  DreverStudioProgress,
} from "@drever/schema";
import { DREVER_STUDIO_PROTOCOL_VERSION } from "@drever/schema";
import {
  createCodexAppServerConnection,
  decodeCodexStudioEvent,
  type CodexAppServerConnection,
  type CodexAppServerRequestId,
  type CodexStudioEvent,
  type CodexStudioItem,
} from "./codex-app-server-protocol.ts";
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

type JsonRecord = Record<string, unknown>;

export type CodexAppServerProcess = Pick<
  ChildProcessWithoutNullStreams,
  "stdin" | "stdout" | "stderr" | "kill" | "once"
>;

export type CodexStudioAgentOptions = Readonly<{
  root: string;
  clientVersion?: string;
  requestTimeoutMs?: number;
  shutdownTimeoutMs?: number;
  spawnProcess?: (root: string) => CodexAppServerProcess;
  turnTimeoutMs?: number;
  verifyActionHandled?: StudioActionPublicationVerifier;
}>;

type Projection = Readonly<{
  apply(event: CodexStudioEvent): void;
  beginAction(record: DreverStudioActionRecord): void;
  fail(message: string): void;
  ready(): void;
  setHandledActionRevision(revision: number): void;
  snapshot(): DreverStudioAgentState;
}>;

type QueuedAction = Readonly<{
  record: DreverStudioActionRecord;
  reject(error: Error): void;
  resolve(): void;
}>;

type PendingApproval = Readonly<{
  message: JsonRecord;
  request: StudioAgentApprovalRequest;
  threadId: string;
}>;

const MAX_ACTIVITY_ITEMS = 12;
const MAX_LONG_TEXT = 4_000;
const MAX_SHORT_TEXT = 240;
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 1_000;
const DEFAULT_TURN_TIMEOUT_MS = 15 * 60_000;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const bounded = (value: string, limit: number): string => value.slice(0, limit);

const boundedTail = (value: string, limit: number): string => value.slice(-limit);

const activityId = (kind: string, id: string): string =>
  bounded(
    `codex-${kind}-${id}`
      .toLowerCase()
      .replace(/[^a-z\d-]+/gu, "-")
      .replace(/-+/gu, "-"),
    MAX_SHORT_TEXT,
  );

const createProjection = (changed: () => void): Projection => {
  const reasoning = new Map<string, string>();
  const messages = new Map<string, string>();
  const plans = new Map<string, string>();
  let activity: readonly DreverStudioActivity[] = [];
  let handledActionRevision = 0;
  let message: string | undefined;
  let phase: DreverStudioPhase = "waiting-for-agent";
  let workingPhase: DreverStudioPhase = "waiting-for-agent";
  let progress: DreverStudioProgress | undefined;

  const publishMessage = (value: string): void => {
    const next = bounded(value, MAX_LONG_TEXT).trim();
    message = next.length === 0 ? undefined : next;
  };

  const updateActivity = (next: DreverStudioActivity): void => {
    const remaining = activity.filter(
      (item) => item.id !== next.id && !(next.status === "active" && item.status === "active"),
    );
    activity = Object.freeze([...remaining, next].slice(-MAX_ACTIVITY_ITEMS));
  };

  const itemActivity = (
    item: CodexStudioItem,
    status: DreverStudioActivity["status"],
  ): DreverStudioActivity =>
    Object.freeze({
      id: activityId(item.kind, item.id),
      label: bounded(item.label, MAX_SHORT_TEXT),
      ...(item.detail === undefined ? {} : { detail: bounded(item.detail, MAX_LONG_TEXT) }),
      status,
    });

  const completeActive = (status: "complete" | "error"): void => {
    activity = Object.freeze(
      activity.map((item) => (item.status === "active" ? { ...item, status } : item)),
    );
  };

  const appendDelta = (store: Map<string, string>, itemId: string, delta: string): void => {
    const next = boundedTail(`${store.get(itemId) ?? ""}${delta}`, MAX_LONG_TEXT);
    store.set(itemId, next);
    publishMessage(next);
  };

  return Object.freeze({
    apply(event) {
      if (event.type === "turn-started") {
        phase = workingPhase;
        progress = undefined;
        reasoning.clear();
        messages.clear();
        plans.clear();
      } else if (event.type === "turn-completed") {
        const failed = event.status !== "completed";
        phase = failed ? "error" : "waiting-for-agent";
        completeActive(failed ? "error" : "complete");
        if (failed) publishMessage("Codex could not complete the Studio action.");
      } else if (event.type === "reasoning-summary-delta") {
        appendDelta(reasoning, event.itemId, event.delta);
      } else if (event.type === "reasoning-summary-boundary") {
        appendDelta(reasoning, event.itemId, "\n");
      } else if (event.type === "agent-message-delta") {
        appendDelta(messages, event.itemId, event.delta);
      } else if (event.type === "plan-delta") {
        appendDelta(plans, event.itemId, event.delta);
      } else if (event.type === "item-started" || event.type === "item-completed") {
        const status =
          event.type === "item-started"
            ? "active"
            : event.item.failed === true
              ? "error"
              : "complete";
        updateActivity(itemActivity(event.item, status));
        if (event.item.message !== undefined) publishMessage(event.item.message);
      } else if (event.type === "plan-updated") {
        const active = event.steps.find((step) => step.status === "inProgress");
        progress = Object.freeze({
          label: active?.step ?? "Plan updated",
        });
        if (active !== undefined) {
          updateActivity(
            Object.freeze({
              id: "codex-plan-step",
              label: bounded(active.step, MAX_SHORT_TEXT),
              status: "active",
            }),
          );
        }
      } else if (event.type === "diff-updated") {
        updateActivity(
          Object.freeze({
            id: "codex-diff",
            label: "Updating files",
            detail: event.summary,
            status: "active",
          }),
        );
      } else if (event.type === "approval-requested") {
        const detail = event.request.reason ?? event.request.detail;
        updateActivity(
          Object.freeze({
            id: activityId("approval", String(event.request.id)),
            label: "Approval needed",
            ...(detail === undefined ? {} : { detail: bounded(detail, MAX_LONG_TEXT) }),
            status: "active",
          }),
        );
        publishMessage(detail === undefined ? "Codex needs approval to continue." : detail);
      } else if (event.type === "approval-resolved") {
        const id = activityId("approval", String(event.requestId));
        activity = Object.freeze(
          activity.map((item) =>
            item.id === id
              ? ({ ...item, label: "Approval resolved", status: "complete" } as const)
              : item,
          ),
        );
      } else if (event.type === "error") {
        phase = event.willRetry ? workingPhase : "error";
        publishMessage(
          event.willRetry
            ? "Codex is retrying after an error."
            : "Codex encountered an error while working.",
        );
        if (!event.willRetry) completeActive("error");
      }
      changed();
    },
    beginAction(record) {
      workingPhase = phaseForStudioAction(record);
      phase = workingPhase;
      progress = undefined;
      publishMessage("Codex received the latest Studio action.");
      updateActivity(
        Object.freeze({
          id: `codex-action-${String(record.revision)}`,
          label:
            record.action.type === "submit-feedback"
              ? "Applying your feedback"
              : "Starting agent work",
          status: "active",
        }),
      );
      changed();
    },
    fail(value) {
      phase = "error";
      publishMessage(value);
      completeActive("error");
      changed();
    },
    ready() {
      workingPhase = "waiting-for-agent";
      phase = "waiting-for-agent";
      message = undefined;
      changed();
    },
    setHandledActionRevision(revision) {
      handledActionRevision = Math.max(handledActionRevision, revision);
      changed();
    },
    snapshot() {
      return Object.freeze({
        version: DREVER_STUDIO_PROTOCOL_VERSION,
        phase,
        handledActionRevision,
        ...(activity.length === 0 ? {} : { activity }),
        ...(progress === undefined ? {} : { progress }),
        ...(message === undefined ? {} : { message }),
      });
    },
  });
};

const defaultSpawn = (root: string): CodexAppServerProcess =>
  spawn("codex", ["app-server", "--stdio"], {
    ...studioAgentProcessOptions(root),
    stdio: ["pipe", "pipe", "pipe"],
  });

const requestKey = (id: CodexAppServerRequestId): string => `${typeof id}:${String(id)}`;

const actionPrompt = (record: DreverStudioActionRecord): string =>
  [
    "$drever-create-deck",
    "A structured action arrived from the local Drever Studio. Continue the deck workflow in this workspace and treat this action as authoritative.",
    "Use concise user-facing progress summaries. Never expose private chain-of-thought.",
    studioActionWorkflowInstructions(record),
    `Studio action revision ${String(record.revision)}:`,
    JSON.stringify(studioActionAgentPayload(record)),
  ]
    .filter((part) => part.length > 0)
    .join("\n\n");

const threadIdFromResponse = (value: unknown): string | undefined => {
  if (!isRecord(value) || !isRecord(value.thread) || typeof value.thread.id !== "string") return;
  return value.thread.id;
};

const turnInProgress = (value: unknown): boolean =>
  isRecord(value) && isRecord(value.turn) && value.turn.status === "inProgress";

const turnCompleted = (value: unknown): boolean =>
  isRecord(value) && isRecord(value.turn) && value.turn.status === "completed";

const waitFor = (promise: Promise<void>, timeoutMs: number): Promise<boolean> =>
  new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    void promise.then(() => finish(true));
  });

const permissionGrant = (
  message: JsonRecord,
  decision: StudioAgentApprovalDecision,
): Readonly<{ permissions: JsonRecord; scope: "turn" | "session" }> => {
  if (decision === "decline" || decision === "cancel") {
    return { permissions: {}, scope: "turn" };
  }
  const params = isRecord(message.params) ? message.params : undefined;
  const requested =
    params !== undefined && isRecord(params.permissions) ? params.permissions : undefined;
  const permissions: JsonRecord = {};
  if (requested?.network !== undefined && requested.network !== null) {
    permissions.network = requested.network;
  }
  if (requested?.fileSystem !== undefined && requested.fileSystem !== null) {
    permissions.fileSystem = requested.fileSystem;
  }
  return { permissions, scope: decision === "acceptForSession" ? "session" : "turn" };
};

/** @internal Experimental native Codex host for one local Studio session. */
export const createCodexStudioAgent = (options: CodexStudioAgentOptions): StudioAgentProvider => {
  const listeners = new Set<() => void>();
  const pendingApprovals = new Map<string, PendingApproval>();
  const actionDeliveries = new Map<number, Promise<void>>();
  const actionQueue: QueuedAction[] = [];
  const spawnProcess = options.spawnProcess ?? defaultSpawn;
  const verifyActionHandled =
    options.verifyActionHandled ??
    withStudioActionPublicationGrace(createStudioActionPublicationVerifier(options.root));
  let activeTurn = false;
  let connected = false;
  let connection: CodexAppServerConnection | undefined;
  let currentAction: QueuedAction | undefined;
  let currentTurnId: string | undefined;
  let handledActionRevision = 0;
  let process: CodexAppServerProcess | undefined;
  let processClosed: Promise<void> | undefined;
  let pumping = false;
  let settlingAction: QueuedAction | undefined;
  let startPromise: Promise<void> | undefined;
  let stateAvailable = false;
  let stopping = false;
  let threadId: string | undefined;
  let turnTimer: ReturnType<typeof setTimeout> | undefined;

  const changed = (): void => {
    for (const listener of listeners) listener();
  };
  const projection = createProjection(changed);

  const terminateProcess = async (
    child: CodexAppServerProcess,
    closed: Promise<void> | undefined,
  ): Promise<void> => {
    try {
      signalStudioAgentProcess(child, "SIGTERM");
    } catch {
      return;
    }
    if (
      closed !== undefined &&
      !(await waitFor(closed, options.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS))
    ) {
      try {
        signalStudioAgentProcess(child, "SIGKILL");
      } catch {
        return;
      }
      await waitFor(closed, options.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS);
    }
  };

  const clearTurnTimer = (): void => {
    if (turnTimer !== undefined) clearTimeout(turnTimer);
    turnTimer = undefined;
  };

  const rejectOutstanding = (error: Error): void => {
    const current = currentAction;
    currentAction = undefined;
    if (settlingAction === current) settlingAction = undefined;
    currentTurnId = undefined;
    activeTurn = false;
    clearTurnTimer();
    current?.reject(error);
    for (const queued of actionQueue.splice(0)) queued.reject(error);
  };

  const disconnect = (child: CodexAppServerProcess, error: Error, terminate = false): void => {
    if (stopping || process !== child) return;
    const hadOutstandingWork =
      currentAction !== undefined || settlingAction !== undefined || actionQueue.length > 0;
    const closed = processClosed;
    connected = false;
    stateAvailable = true;
    connection?.close(error);
    connection = undefined;
    process = undefined;
    processClosed = undefined;
    threadId = undefined;
    startPromise = undefined;
    pendingApprovals.clear();
    if (hadOutstandingWork) {
      rejectOutstanding(error);
      projection.fail("Codex disconnected before finishing the Studio action.");
    } else {
      projection.ready();
    }
    if (terminate) void terminateProcess(child, closed);
  };

  const touchTurn = (): void => {
    if (currentAction === undefined) return;
    clearTurnTimer();
    turnTimer = setTimeout(() => {
      const child = process;
      if (child === undefined || currentAction === undefined) return;
      disconnect(
        child,
        new Error("Codex stopped reporting progress for the active Studio action."),
        true,
      );
    }, options.turnTimeoutMs ?? DEFAULT_TURN_TIMEOUT_MS);
    turnTimer.unref?.();
  };

  const completeCurrent = async (): Promise<void> => {
    const current = currentAction;
    if (current === undefined || settlingAction !== undefined) return;
    settlingAction = current;
    currentTurnId = undefined;
    activeTurn = false;
    clearTurnTimer();
    try {
      if (!(await verifyActionHandled(current.record))) {
        if (currentAction === current) {
          failCurrent(
            new Error("Codex completed without publishing the handled Studio action."),
            "Codex finished without publishing the latest Studio state.",
          );
        }
        return;
      }
      if (currentAction !== current) return;
      currentAction = undefined;
      handledActionRevision = Math.max(handledActionRevision, current.record.revision);
      projection.setHandledActionRevision(handledActionRevision);
      current.resolve();
    } catch {
      if (currentAction === current) {
        failCurrent(
          new Error("Drever could not verify the Codex Studio publication."),
          "Drever could not verify Codex's Studio publication.",
        );
      }
    } finally {
      if (settlingAction === current) settlingAction = undefined;
      if (actionQueue.length > 0 && connected && !activeTurn && currentAction === undefined) {
        void pump();
      }
    }
  };

  const failCurrent = (
    error: Error,
    publicMessage = "Codex could not complete the Studio action.",
  ): void => {
    rejectOutstanding(error);
    projection.fail(publicMessage);
  };

  const applyMessage = (message: JsonRecord): void => {
    const event = decodeCodexStudioEvent(message);
    if (event === undefined || (threadId !== undefined && event.threadId !== threadId)) return;
    if (
      (event.type === "turn-started" || event.type === "turn-completed") &&
      currentAction === undefined
    ) {
      return;
    }
    touchTurn();
    if (event.type === "approval-requested") {
      pendingApprovals.set(requestKey(event.request.id), {
        message,
        request: event.request,
        threadId: event.threadId,
      });
    } else if (event.type === "approval-resolved") {
      pendingApprovals.delete(requestKey(event.requestId));
    } else if (event.type === "turn-started") {
      activeTurn = true;
      currentTurnId = event.turnId;
    } else if (event.type === "turn-completed") {
      if (currentTurnId !== undefined && event.turnId !== currentTurnId) return;
      pendingApprovals.clear();
    }
    projection.apply(event);
    if (event.type === "turn-completed") {
      if (event.status === "completed") void completeCurrent();
      else failCurrent(new Error("Codex did not complete the active Studio action."));
    }
  };

  const applyServerRequest = (message: JsonRecord): void => {
    const event = decodeCodexStudioEvent(message);
    if (
      event?.type === "approval-requested" &&
      currentAction !== undefined &&
      (threadId === undefined || event.threadId === threadId)
    ) {
      applyMessage(message);
      return;
    }
    if (typeof message.id === "string" || typeof message.id === "number") {
      connection?.respondError(
        message.id,
        -32_601,
        "Drever Studio does not support this Codex app-server request.",
      );
    }
  };

  const pump = async (): Promise<void> => {
    if (
      pumping ||
      settlingAction !== undefined ||
      activeTurn ||
      currentAction !== undefined ||
      !connected ||
      connection === undefined ||
      threadId === undefined
    ) {
      return;
    }
    pumping = true;
    try {
      while (!activeTurn && connected && actionQueue.length > 0) {
        const queued = actionQueue.shift();
        if (queued === undefined) break;
        currentAction = queued;
        projection.beginAction(queued.record);
        touchTurn();
        try {
          const response = await connection.request("turn/start", {
            threadId,
            input: [{ type: "text", text: actionPrompt(queued.record), text_elements: [] }],
            cwd: options.root,
            runtimeWorkspaceRoots: [options.root],
            summary: "concise",
          });
          if (currentAction !== queued || settlingAction === queued) return;
          activeTurn = turnInProgress(response);
          const turn = isRecord(response) && isRecord(response.turn) ? response.turn : undefined;
          currentTurnId = typeof turn?.id === "string" ? turn.id : currentTurnId;
          if (turnCompleted(response) && currentTurnId !== undefined) {
            projection.apply({
              type: "turn-completed",
              threadId,
              turnId: currentTurnId,
              status: "completed",
            });
            await completeCurrent();
          } else if (!activeTurn) {
            failCurrent(new Error("Codex returned an invalid Studio turn state."));
          }
        } catch (error) {
          if (currentAction === queued) {
            failCurrent(error as Error, "Codex could not start the Studio action.");
          }
        }
      }
    } finally {
      pumping = false;
      if (
        actionQueue.length > 0 &&
        connected &&
        settlingAction === undefined &&
        !activeTurn &&
        currentAction === undefined
      ) {
        void pump();
      }
    }
  };

  const start = async (): Promise<void> => {
    if (stopping) throw new Error("The Codex Studio agent has stopped.");
    if (startPromise !== undefined) return startPromise;
    const attempt = (async () => {
      let child: CodexAppServerProcess | undefined;
      try {
        child = spawnProcess(options.root);
        process = child;
        processClosed = new Promise<void>((resolve) => {
          let settled = false;
          const settle = (): void => {
            if (settled) return;
            settled = true;
            resolve();
          };
          child?.once("error", settle);
          child?.once("exit", settle);
        });
        child.stderr.resume();
        connection = createCodexAppServerConnection(
          { input: child.stdin, output: child.stdout },
          {
            onFailure: (error) => disconnect(child!, error, true),
            onNotification: applyMessage,
            onServerRequest: applyServerRequest,
            ...(options.requestTimeoutMs === undefined
              ? {}
              : { requestTimeoutMs: options.requestTimeoutMs }),
          },
        );
        child.once("error", (error) => {
          disconnect(child!, error);
        });
        child.once("exit", (code, signal) => {
          if (stopping) return;
          const error = new Error(
            `Codex app-server exited (${code === null ? signal : String(code)}).`,
          );
          disconnect(child!, error);
        });
        await connection.request("initialize", {
          clientInfo: {
            name: "drever_studio",
            title: "Drever Studio",
            version: options.clientVersion ?? "0.0.0",
          },
          capabilities: { experimentalApi: true, requestAttestation: false },
        });
        connection.notify("initialized");
        const response = await connection.request("thread/start", {
          cwd: options.root,
          runtimeWorkspaceRoots: [options.root],
          approvalPolicy: "on-request",
          approvalsReviewer: "auto_review",
          sandbox: "workspace-write",
          serviceName: "drever_studio",
          threadSource: "appServer",
          ephemeral: true,
        });
        const startedThreadId = threadIdFromResponse(response);
        if (startedThreadId === undefined) {
          throw new TypeError("Codex app-server returned no thread id.");
        }
        threadId = startedThreadId;
        connected = true;
        stateAvailable = true;
        projection.ready();
        await pump();
      } catch (error) {
        if (child !== undefined && process === child) disconnect(child, error as Error, true);
        else {
          stateAvailable = true;
          projection.fail(
            "Codex could not start. Make sure the Codex CLI is installed and signed in.",
          );
        }
        throw error;
      }
    })();
    startPromise = attempt;
    try {
      await attempt;
    } catch (error) {
      if (startPromise === attempt) startPromise = undefined;
      throw error;
    }
  };

  return Object.freeze({
    start,
    async stop() {
      if (stopping) return;
      stopping = true;
      connected = false;
      clearTurnTimer();
      const child = process;
      const closed = processClosed;
      connection?.close();
      connection = undefined;
      process = undefined;
      processClosed = undefined;
      threadId = undefined;
      pendingApprovals.clear();
      rejectOutstanding(new Error("The Codex Studio agent stopped before delivering the action."));
      if (child !== undefined) {
        await terminateProcess(child, closed);
      }
      changed();
    },
    snapshot(): StudioAgentProviderSnapshot {
      return Object.freeze({
        connected,
        ...(threadId === undefined ? {} : { sessionId: threadId }),
        ...(stateAvailable ? { state: projection.snapshot() } : {}),
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async handleAction(record) {
      await start();
      if (record.revision <= handledActionRevision) return;
      const existing = actionDeliveries.get(record.revision);
      if (existing !== undefined) return existing;
      const delivery = new Promise<void>((resolve, reject) => {
        actionQueue.push({ record, reject, resolve });
      });
      actionDeliveries.set(record.revision, delivery);
      void delivery.then(
        () => actionDeliveries.delete(record.revision),
        () => actionDeliveries.delete(record.revision),
      );
      void pump();
      return delivery;
    },
    approvals() {
      return Object.freeze([...pendingApprovals.values()].map(({ request }) => request));
    },
    async respondToApproval(requestId, decision) {
      const pending = pendingApprovals.get(requestKey(requestId));
      if (pending === undefined || connection === undefined) {
        throw new TypeError(`Unknown Studio agent approval request: ${String(requestId)}`);
      }
      if (
        pending.request.decisions !== undefined &&
        !pending.request.decisions.includes(decision)
      ) {
        throw new TypeError(`Codex does not support ${decision} for this approval request.`);
      }
      const method = pending.message.method;
      const result =
        method === "item/permissions/requestApproval"
          ? permissionGrant(pending.message, decision)
          : { decision };
      connection.respond(requestId, result);
      pendingApprovals.delete(requestKey(requestId));
      touchTurn();
      projection.apply({
        type: "approval-resolved",
        threadId: pending.threadId,
        requestId,
      });
    },
  });
};

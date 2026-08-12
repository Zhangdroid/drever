import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type {
  DreverStudioActionRecord,
  DreverStudioActivity,
  DreverStudioAgentState,
  DreverStudioPhase,
} from "@drever/schema";
import { DREVER_STUDIO_PROTOCOL_VERSION } from "@drever/schema";
import { ClaudeStreamDecoder, type ClaudeStreamSignal } from "./claude-stream-adapter.ts";
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
  type StudioAgentProvider,
  type StudioAgentProviderSnapshot,
} from "./studio-agent-provider.ts";

export type ClaudeCodeProcess = Pick<
  ChildProcessWithoutNullStreams,
  "stdin" | "stdout" | "stderr" | "kill" | "once"
>;

export type ClaudeStudioAgentOptions = Readonly<{
  root: string;
  shutdownTimeoutMs?: number;
  spawnProcess?: (root: string, args: readonly string[]) => ClaudeCodeProcess;
  turnTimeoutMs?: number;
  verifyActionHandled?: StudioActionPublicationVerifier;
}>;

/**
 * Claude's stream-json transport exposes progress but not a stable, bidirectional
 * permission protocol. Keep that limitation explicit instead of presenting a
 * Studio approval control that cannot reliably resume the CLI session.
 */
export const CLAUDE_STUDIO_AGENT_CAPABILITIES = Object.freeze({
  actionDelivery: true,
  interactiveApprovals: false,
  livePublicActivity: true,
  persistentConversation: true,
  sessionPersistence: false,
} as const);

const CLAUDE_ARGS = Object.freeze([
  "-p",
  "--input-format",
  "stream-json",
  "--output-format",
  "stream-json",
  "--include-partial-messages",
  "--verbose",
  "--permission-mode",
  "auto",
  "--no-session-persistence",
] as const);

const MAX_ACTIVITY_ITEMS = 12;
const MAX_LONG_TEXT = 4_000;
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 1_000;
const DEFAULT_TURN_TIMEOUT_MS = 15 * 60_000;

type QueuedAction = Readonly<{
  record: DreverStudioActionRecord;
  reject(error: Error): void;
  resolve(): void;
}>;

const bounded = (value: string, limit: number): string => value.slice(0, limit);

const boundedTail = (value: string, limit: number): string => value.slice(-limit);

/** @internal Prevents a managed Claude child from inheriting Claude Code's nesting guard. */
export const claudeStudioAgentProcessOptions = (
  root: string,
  environment: NodeJS.ProcessEnv = process.env,
): ReturnType<typeof studioAgentProcessOptions> => {
  const { CLAUDECODE: _claudeCode, ...childEnvironment } = environment;
  return studioAgentProcessOptions(root, childEnvironment);
};

const defaultSpawn = (root: string, args: readonly string[]): ClaudeCodeProcess =>
  spawn("claude", [...args], {
    ...claudeStudioAgentProcessOptions(root),
    stdio: ["pipe", "pipe", "pipe"],
  });

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

const actionPrompt = (record: DreverStudioActionRecord): string =>
  [
    "/drever-create-deck",
    "Continue the local Drever MDX/React project workflow using the project-local skill. Do not switch to an unrelated presentation artifact workflow.",
    "A structured action arrived from Drever Studio. Treat it as authoritative, publish the required Studio artifacts promptly, and keep public progress summaries concise.",
    "Never expose private chain-of-thought, secrets, raw command arguments, or raw tool output.",
    studioActionWorkflowInstructions(record),
    `Studio action revision ${String(record.revision)}:`,
    JSON.stringify(studioActionAgentPayload(record)),
  ]
    .filter((part) => part.length > 0)
    .join("\n\n");

const inputMessage = (record: DreverStudioActionRecord): string =>
  `${JSON.stringify({
    type: "user",
    message: { role: "user", content: actionPrompt(record) },
  })}\n`;

const safeToolName = (value: string): string => {
  const safe = bounded(
    value
      .replace(/[^a-z\d _.:/-]+/giu, " ")
      .replace(/\s+/gu, " ")
      .trim(),
    64,
  );
  return safe.length === 0 ? "tool" : safe;
};

const toolLabel = (toolName: string): string => {
  const normalized = toolName.toLowerCase();
  if (normalized === "read") return "Reading project context";
  if (normalized === "glob" || normalized === "grep") return "Finding project files";
  if (normalized === "write" || normalized === "edit" || normalized === "multiedit") {
    return "Updating the presentation";
  }
  if (normalized === "bash") return "Running a project command";
  if (normalized === "webfetch" || normalized === "websearch") {
    return "Researching source material";
  }
  if (normalized === "todowrite") return "Updating the work plan";
  if (normalized === "task") return "Running a focused task";
  return `Using ${safeToolName(toolName)}`;
};

const toolActivityId = (toolUseId: string): string => {
  const normalized = bounded(
    toolUseId
      .toLowerCase()
      .replace(/[^a-z\d]+/gu, "-")
      .replace(/^-+|-+$/gu, ""),
    96,
  ).replace(/-+$/u, "");
  return `claude-tool-${normalized.length === 0 ? "tool" : normalized}`;
};

/** @internal Native Claude Code host for one local Studio session. */
export const createClaudeStudioAgent = (options: ClaudeStudioAgentOptions): StudioAgentProvider => {
  let decoder = new ClaudeStreamDecoder();
  const listeners = new Set<() => void>();
  const actionDeliveries = new Map<number, Promise<void>>();
  const actionQueue: QueuedAction[] = [];
  const spawnProcess = options.spawnProcess ?? defaultSpawn;
  const verifyActionHandled =
    options.verifyActionHandled ??
    withStudioActionPublicationGrace(createStudioActionPublicationVerifier(options.root));
  let activity: readonly DreverStudioActivity[] = [];
  let activeTurn = false;
  let blockedByUnsupportedApproval = false;
  let completedTurn = false;
  let connected = false;
  let currentAction: QueuedAction | undefined;
  let handledActionRevision = 0;
  let message: string | undefined;
  let phase: DreverStudioPhase = "waiting-for-agent";
  let process: ClaudeCodeProcess | undefined;
  let processClosed: Promise<void> | undefined;
  let processExiting: ClaudeCodeProcess | undefined;
  let pumping = false;
  let publicText = "";
  let sessionId: string | undefined;
  let startPromise: Promise<void> | undefined;
  let stateAvailable = false;
  let settlingAction: QueuedAction | undefined;
  let settlingPromise: Promise<void> | undefined;
  let stopping = false;
  let terminalError: Error | undefined;
  let turnTimer: ReturnType<typeof setTimeout> | undefined;

  const changed = (): void => {
    for (const listener of listeners) listener();
  };

  const terminateProcess = async (
    child: ClaudeCodeProcess,
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

  const completeActive = (status: "complete" | "error"): void => {
    activity = Object.freeze(
      activity.map((item) => (item.status === "active" ? { ...item, status } : item)),
    );
  };

  const updateActivity = (next: DreverStudioActivity): void => {
    const previous = activity
      .filter((item) => item.id !== next.id)
      .map((item) => (item.status === "active" ? { ...item, status: "complete" as const } : item));
    activity = Object.freeze([...previous, next].slice(-MAX_ACTIVITY_ITEMS));
  };

  const publishMessage = (value: string): void => {
    const next = bounded(value, MAX_LONG_TEXT).trim();
    message = next.length === 0 ? undefined : next;
  };

  const clearTurnTimer = (): void => {
    if (turnTimer !== undefined) clearTimeout(turnTimer);
    turnTimer = undefined;
  };

  const rejectOutstanding = (error: Error): void => {
    const current = currentAction;
    currentAction = undefined;
    if (settlingAction === current) settlingAction = undefined;
    activeTurn = false;
    clearTurnTimer();
    current?.reject(error);
    for (const queued of actionQueue.splice(0)) queued.reject(error);
  };

  const disconnect = (child: ClaudeCodeProcess, error: Error, terminate = false): void => {
    if (stopping || process !== child) return;
    const closed = processClosed;
    connected = false;
    stateAvailable = true;
    process = undefined;
    processClosed = undefined;
    if (processExiting === child) processExiting = undefined;
    sessionId = undefined;
    startPromise = undefined;
    phase = "error";
    publishMessage("Claude Code disconnected before finishing the Studio session.");
    completeActive("error");
    rejectOutstanding(error);
    if (terminate) void terminateProcess(child, closed);
    changed();
  };

  const retire = (child: ClaudeCodeProcess): void => {
    if (stopping || process !== child) return;
    connected = false;
    process = undefined;
    processClosed = undefined;
    if (processExiting === child) processExiting = undefined;
    sessionId = undefined;
    startPromise = undefined;
    changed();
  };

  const continueQueuedActions = async (child: ClaudeCodeProcess): Promise<void> => {
    retire(child);
    if (stopping || actionQueue.length === 0) return;
    try {
      await start();
      void pump();
    } catch {
      const error = new Error("Claude Code could not restart for the next Studio action.");
      rejectOutstanding(error);
      phase = "error";
      publishMessage(error.message);
      completeActive("error");
      changed();
    }
  };

  const touchTurn = (): void => {
    if (currentAction === undefined) return;
    clearTurnTimer();
    turnTimer = setTimeout(() => {
      const child = process;
      if (child === undefined || currentAction === undefined) return;
      disconnect(
        child,
        new Error("Claude Code stopped reporting progress for the active Studio action."),
        true,
      );
    }, options.turnTimeoutMs ?? DEFAULT_TURN_TIMEOUT_MS);
    turnTimer.unref?.();
  };

  const completeCurrent = (): void => {
    const current = currentAction;
    if (current === undefined || settlingAction !== undefined) return;
    settlingAction = current;
    activeTurn = false;
    clearTurnTimer();
    const settlement = (async (): Promise<void> => {
      try {
        if (!(await verifyActionHandled(current.record))) {
          if (currentAction === current) {
            failCurrent(
              new Error("Claude Code completed without publishing the handled Studio action."),
            );
            publishMessage("Claude Code finished without publishing the latest Studio state.");
            changed();
          }
          return;
        }
        if (currentAction !== current) return;
        currentAction = undefined;
        handledActionRevision = Math.max(handledActionRevision, current.record.revision);
        completedTurn = true;
        current.resolve();
        changed();
      } catch {
        if (currentAction === current) {
          failCurrent(new Error("Drever could not verify the Claude Code Studio publication."));
          publishMessage("Drever could not verify Claude Code's Studio publication.");
          changed();
        }
      } finally {
        if (settlingAction === current) settlingAction = undefined;
        if (
          actionQueue.length > 0 &&
          connected &&
          processExiting !== process &&
          !activeTurn &&
          currentAction === undefined
        ) {
          void pump();
        }
      }
    })();
    settlingPromise = settlement;
    void settlement.finally(() => {
      if (settlingPromise === settlement) settlingPromise = undefined;
    });
  };

  const waitForActionSettlement = async (): Promise<void> => {
    const settlement = settlingPromise;
    if (settlement !== undefined) await settlement;
  };

  const failCurrent = (error: Error): void => {
    rejectOutstanding(error);
    phase = "error";
    publishMessage(error.message);
    completeActive("error");
  };

  const applySignal = (signal: ClaudeStreamSignal): void => {
    touchTurn();
    if (signal.kind === "session-start") {
      sessionId = signal.sessionId;
    } else if (signal.kind === "text-delta") {
      publicText = boundedTail(`${publicText}${signal.text}`, MAX_LONG_TEXT);
      publishMessage(publicText);
    } else if (signal.kind === "tool-start") {
      updateActivity(
        Object.freeze({
          id: toolActivityId(signal.toolUseId),
          label: toolLabel(signal.toolName),
          status: "active",
        }),
      );
    } else if (signal.kind === "tool-result") {
      const id = toolActivityId(signal.toolUseId);
      activity = Object.freeze(
        activity.map((item) =>
          item.id === id
            ? ({ ...item, status: signal.isError ? "error" : "complete" } as const)
            : item,
        ),
      );
    } else if (signal.kind === "approval-required") {
      blockedByUnsupportedApproval = true;
      terminalError = new Error(
        "Claude Code requested an approval that this Studio adapter cannot resume.",
      );
      phase = "error";
      completeActive("error");
      updateActivity(
        Object.freeze({
          id: "claude-unsupported-approval",
          label: "Claude Code needs an external approval",
          detail: "This Claude CLI transport cannot resume approvals from Studio yet.",
          status: "error",
        }),
      );
      publishMessage("Claude Code paused for an approval that this Studio adapter cannot resume.");
    } else if (signal.kind === "result") {
      if (signal.isError) {
        failCurrent(new Error("Claude Code stopped before completing the Studio action."));
      } else if (!blockedByUnsupportedApproval) {
        phase = "waiting-for-agent";
        completeActive("complete");
        completeCurrent();
      }
      if (blockedByUnsupportedApproval) {
        const child = process;
        if (child !== undefined) disconnect(child, terminalError!, true);
      }
    }
    stateAvailable = true;
    changed();
  };

  const applyChunk = (chunk: string): void => {
    try {
      for (const signal of decoder.push(chunk)) applySignal(signal);
    } catch {
      const child = process;
      if (child !== undefined) {
        disconnect(child, new Error("Claude Code emitted invalid streaming output."), true);
      }
    }
  };

  const writeAction = async (queued: QueuedAction): Promise<void> => {
    if (process === undefined) throw new Error("Claude Code is not running.");
    await new Promise<void>((resolve, reject) => {
      process?.stdin.write(inputMessage(queued.record), (error) => {
        if (error === null || error === undefined) resolve();
        else reject(error);
      });
    });
  };

  const pump = async (): Promise<void> => {
    if (
      pumping ||
      settlingAction !== undefined ||
      activeTurn ||
      !connected ||
      process === undefined ||
      processExiting === process
    ) {
      return;
    }
    const queued = actionQueue.shift();
    if (queued === undefined) return;
    pumping = true;
    currentAction = queued;
    blockedByUnsupportedApproval = false;
    activeTurn = true;
    publicText = "";
    phase = phaseForStudioAction(queued.record);
    publishMessage("Claude Code received the latest Studio action.");
    updateActivity(
      Object.freeze({
        id: `claude-action-${String(queued.record.revision)}`,
        label:
          queued.record.action.type === "submit-feedback"
            ? "Applying your feedback"
            : "Starting agent work",
        status: "active",
      }),
    );
    changed();
    touchTurn();
    try {
      await writeAction(queued);
    } catch {
      if (currentAction === queued) {
        failCurrent(new Error("Claude Code could not receive the Studio action."));
      }
      changed();
    } finally {
      pumping = false;
      if (
        actionQueue.length > 0 &&
        connected &&
        processExiting !== process &&
        settlingAction === undefined &&
        !activeTurn &&
        currentAction === undefined
      ) {
        void pump();
      }
    }
  };

  const start = async (): Promise<void> => {
    if (stopping) throw new Error("The Claude Studio agent has stopped.");
    if (terminalError !== undefined) throw terminalError;
    if (startPromise !== undefined) return startPromise;
    const attempt = Promise.resolve().then(() => {
      let child: ClaudeCodeProcess | undefined;
      try {
        child = spawnProcess(options.root, CLAUDE_ARGS);
        process = child;
        processExiting = undefined;
        completedTurn = false;
        decoder = new ClaudeStreamDecoder();
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
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
          if (process === child) applyChunk(chunk);
        });
        child.stdin.once("error", () => {
          disconnect(child!, new Error("Claude Code closed its Studio input stream."), true);
        });
        child.stdout.once("end", () => {
          void (async () => {
            if (stopping || process !== child) return;
            try {
              for (const signal of decoder.finish()) applySignal(signal);
            } catch {
              disconnect(child!, new Error("Claude Code emitted invalid streaming output."), true);
              return;
            }
            await waitForActionSettlement();
            if (stopping || process !== child) return;
            if (currentAction !== undefined) {
              disconnect(
                child!,
                new Error("Claude Code ended its output before completing the Studio action."),
                true,
              );
            }
          })();
        });
        child.once("error", () => {
          disconnect(
            child!,
            new Error(
              "Claude Code could not start. Make sure the Claude Code CLI is installed and signed in.",
            ),
          );
        });
        child.once("exit", () => {
          if (!stopping && process === child) processExiting = child;
          void (async () => {
            if (stopping || process !== child || terminalError !== undefined) return;
            await waitForActionSettlement();
            if (stopping || process !== child || terminalError !== undefined) return;
            if (currentAction === undefined && completedTurn) {
              await continueQueuedActions(child!);
            } else {
              disconnect(
                child!,
                new Error("Claude Code disconnected before finishing the Studio session."),
              );
            }
          })();
        });
        connected = true;
        stateAvailable = true;
        phase = "waiting-for-agent";
        message = undefined;
        changed();
      } catch {
        if (child !== undefined && process === child) {
          disconnect(
            child,
            new Error(
              "Claude Code could not start. Make sure the Claude Code CLI is installed and signed in.",
            ),
            true,
          );
        } else {
          stateAvailable = true;
          phase = "error";
          publishMessage(
            "Claude Code could not start. Make sure the Claude Code CLI is installed and signed in.",
          );
          changed();
        }
        throw new Error("Claude Code could not start.");
      }
    });
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
      process = undefined;
      processClosed = undefined;
      processExiting = undefined;
      sessionId = undefined;
      rejectOutstanding(new Error("The Claude Studio agent stopped before delivering the action."));
      if (child !== undefined) {
        await terminateProcess(child, closed);
      }
      changed();
    },
    snapshot(): StudioAgentProviderSnapshot {
      const state: DreverStudioAgentState = Object.freeze({
        version: DREVER_STUDIO_PROTOCOL_VERSION,
        phase,
        handledActionRevision,
        ...(activity.length === 0 ? {} : { activity }),
        ...(message === undefined ? {} : { message }),
      });
      return Object.freeze({
        connected,
        ...(sessionId === undefined ? {} : { sessionId }),
        ...(stateAvailable ? { state } : {}),
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async handleAction(record) {
      if (terminalError !== undefined) throw terminalError;
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
      return Object.freeze([]);
    },
    async respondToApproval() {
      throw new Error(
        "Claude Code stream-json does not expose a stable Studio approval response channel.",
      );
    },
  });
};

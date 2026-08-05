import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { StudioAgentApprovalRequest } from "./studio-agent-provider.ts";

type JsonRecord = Record<string, unknown>;
export type CodexAppServerRequestId = string | number;

export type CodexAppServerStreams = Readonly<{
  input: Writable;
  output: Readable;
}>;

export type CodexAppServerConnection = Readonly<{
  request(method: string, params: unknown): Promise<unknown>;
  notify(method: string, params?: unknown): void;
  respond(id: CodexAppServerRequestId, result: unknown): void;
  respondError(id: CodexAppServerRequestId, code: number, message: string): void;
  close(error?: Error): void;
}>;

export type CodexStudioItem = Readonly<{
  id: string;
  kind: string;
  label: string;
  detail?: string;
  message?: string;
  failed?: boolean;
}>;

export type CodexStudioPlanStep = Readonly<{
  step: string;
  status: "pending" | "inProgress" | "completed";
}>;

export type CodexStudioEvent =
  | Readonly<{ type: "turn-started"; threadId: string; turnId: string }>
  | Readonly<{
      type: "turn-completed";
      threadId: string;
      turnId: string;
      status: "completed" | "interrupted" | "failed";
      error?: string;
    }>
  | Readonly<{
      type: "reasoning-summary-delta";
      threadId: string;
      turnId: string;
      itemId: string;
      delta: string;
    }>
  | Readonly<{
      type: "reasoning-summary-boundary";
      threadId: string;
      turnId: string;
      itemId: string;
    }>
  | Readonly<{
      type: "agent-message-delta" | "plan-delta";
      threadId: string;
      turnId: string;
      itemId: string;
      delta: string;
    }>
  | Readonly<{
      type: "item-started" | "item-completed";
      threadId: string;
      turnId: string;
      item: CodexStudioItem;
    }>
  | Readonly<{
      type: "plan-updated";
      threadId: string;
      turnId: string;
      steps: readonly CodexStudioPlanStep[];
    }>
  | Readonly<{
      type: "diff-updated";
      threadId: string;
      turnId: string;
      summary: string;
    }>
  | Readonly<{
      type: "approval-requested";
      threadId: string;
      turnId: string;
      request: StudioAgentApprovalRequest;
    }>
  | Readonly<{
      type: "approval-resolved";
      threadId: string;
      requestId: CodexAppServerRequestId;
    }>
  | Readonly<{
      type: "error";
      threadId: string;
      turnId: string;
      message: string;
      willRetry: boolean;
    }>;

type PendingRequest = Readonly<{
  reject(error: Error): void;
  resolve(value: unknown): void;
  timer: ReturnType<typeof setTimeout>;
}>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isRequestId = (value: unknown): value is CodexAppServerRequestId =>
  typeof value === "string" || typeof value === "number";

const rpcError = (value: unknown): Error => {
  if (!isRecord(value)) return new Error("Codex app-server returned an unknown error.");
  const code = typeof value.code === "number" ? ` (${String(value.code)})` : "";
  const message =
    typeof value.message === "string" ? value.message : "Codex app-server request failed.";
  return new Error(`${message}${code}`);
};

/** @internal Owns JSONL framing and request correlation for one app-server process. */
export const createCodexAppServerConnection = (
  streams: CodexAppServerStreams,
  handlers: Readonly<{
    onFailure(error: Error): void;
    onNotification(message: JsonRecord): void;
    onServerRequest(message: JsonRecord): void;
    requestTimeoutMs?: number;
  }>,
): CodexAppServerConnection => {
  const pending = new Map<CodexAppServerRequestId, PendingRequest>();
  const lines = createInterface({
    input: streams.output,
    crlfDelay: Number.POSITIVE_INFINITY,
    terminal: false,
  });
  const requestTimeoutMs = handlers.requestTimeoutMs ?? 30_000;
  let closed = false;
  let nextRequestId = 1;

  const inputError = (error: Error): void => fail(error);
  const outputError = (error: Error): void => fail(error);

  const close = (error = new Error("Codex app-server connection closed.")): void => {
    if (closed) return;
    closed = true;
    lines.close();
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    pending.clear();
  };

  const fail = (error: Error): void => {
    if (closed) return;
    close(error);
    handlers.onFailure(error);
  };

  const send = (message: unknown): void => {
    if (closed) throw new Error("Codex app-server connection is closed.");
    try {
      streams.input.write(`${JSON.stringify(message)}\n`, (error) => {
        if (error !== null && error !== undefined) fail(error);
      });
    } catch (error) {
      fail(error as Error);
    }
  };

  streams.input.on("error", inputError);
  streams.output.on("error", outputError);

  lines.on("line", (line) => {
    if (line.trim().length === 0) return;
    let value: unknown;
    try {
      value = JSON.parse(line) as unknown;
    } catch {
      fail(new SyntaxError("Codex app-server emitted invalid JSONL."));
      return;
    }
    if (!isRecord(value)) return;
    if (isRequestId(value.id) && ("result" in value || "error" in value)) {
      const request = pending.get(value.id);
      if (request === undefined) return;
      pending.delete(value.id);
      clearTimeout(request.timer);
      if ("error" in value) request.reject(rpcError(value.error));
      else request.resolve(value.result);
      return;
    }
    if (typeof value.method !== "string") return;
    if (isRequestId(value.id)) handlers.onServerRequest(value);
    else handlers.onNotification(value);
  });

  return Object.freeze({
    request(method, params) {
      const id = nextRequestId;
      nextRequestId += 1;
      return new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Codex app-server request timed out: ${method}`));
        }, requestTimeoutMs);
        timer.unref?.();
        pending.set(id, { reject, resolve, timer });
        try {
          send({ method, id, params });
        } catch (error) {
          pending.delete(id);
          clearTimeout(timer);
          reject(error as Error);
        }
      });
    },
    notify(method, params) {
      send(params === undefined ? { method } : { method, params });
    },
    respond(id, result) {
      send({ id, result });
    },
    respondError(id, code, message) {
      send({ id, error: { code, message } });
    },
    close,
  });
};

const bounded = (value: string, limit = 4_000): string => value.slice(0, limit);

const optionalText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? bounded(value) : undefined;

const context = (value: unknown): Readonly<{ threadId: string; turnId: string }> | undefined => {
  if (!isRecord(value) || typeof value.threadId !== "string" || typeof value.turnId !== "string") {
    return;
  }
  return { threadId: value.threadId, turnId: value.turnId };
};

const failedItem = (item: JsonRecord): boolean => {
  if (item.status === "failed" || item.status === "declined") return true;
  return item.success === false;
};

const changesDetail = (item: JsonRecord): string | undefined => {
  if (!Array.isArray(item.changes)) return;
  const count = item.changes.length;
  return `${String(count)} ${count === 1 ? "file" : "files"}`;
};

const itemView = (value: unknown): CodexStudioItem | undefined => {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.type !== "string") {
    return;
  }
  const base = { id: value.id, kind: value.type, failed: failedItem(value) };
  if (value.type === "agentMessage") {
    const message = optionalText(value.text);
    return {
      ...base,
      label: "Writing the response",
      ...(message === undefined ? {} : { message }),
    };
  }
  if (value.type === "reasoning") {
    const summary = Array.isArray(value.summary)
      ? value.summary.filter((part): part is string => typeof part === "string").join("\n")
      : "";
    const message = optionalText(summary);
    return {
      ...base,
      label: "Developing the approach",
      ...(message === undefined ? {} : { message }),
    };
  }
  if (value.type === "plan") {
    const message = optionalText(value.text);
    return {
      ...base,
      label: "Planning the work",
      ...(message === undefined ? {} : { message }),
    };
  }
  if (value.type === "commandExecution") {
    return { ...base, label: "Running a command" };
  }
  if (value.type === "fileChange") {
    const detail = changesDetail(value);
    return {
      ...base,
      label: "Updating files",
      ...(detail === undefined ? {} : { detail }),
    };
  }
  if (value.type === "mcpToolCall") {
    const tool = optionalText(value.tool);
    const server = optionalText(value.server);
    return {
      ...base,
      label: tool === undefined ? "Using a connected tool" : `Using ${tool}`,
      ...(server === undefined ? {} : { detail: server }),
    };
  }
  if (value.type === "dynamicToolCall") {
    const tool = optionalText(value.tool);
    return { ...base, label: tool === undefined ? "Using a tool" : `Using ${tool}` };
  }
  if (value.type === "collabAgentToolCall" || value.type === "subAgentActivity") {
    return { ...base, label: "Coordinating agent work" };
  }
  if (value.type === "webSearch") {
    return { ...base, label: "Searching the web" };
  }
  if (value.type === "imageView") return { ...base, label: "Inspecting an image" };
  if (value.type === "imageGeneration") return { ...base, label: "Creating an image" };
  if (value.type === "contextCompaction") return { ...base, label: "Summarizing context" };
  return { ...base, label: "Working in Codex" };
};

export const summarizeUnifiedDiff = (diff: string): string => {
  const files = new Set<string>();
  let additions = 0;
  let deletions = 0;
  for (const line of diff.split("\n")) {
    const file = /^diff --git a\/.+ b\/(?<path>.+)$/u.exec(line)?.groups?.path;
    if (file !== undefined) files.add(file);
    else if (line.startsWith("+") && !line.startsWith("+++")) additions += 1;
    else if (line.startsWith("-") && !line.startsWith("---")) deletions += 1;
  }
  const fileCount = files.size;
  const parts = [
    `${String(fileCount)} ${fileCount === 1 ? "file" : "files"} changed`,
    `${String(additions)} ${additions === 1 ? "addition" : "additions"}`,
    `${String(deletions)} ${deletions === 1 ? "deletion" : "deletions"}`,
  ];
  return parts.join(" · ");
};

const decodeApproval = (
  message: JsonRecord,
  kind: StudioAgentApprovalRequest["kind"],
): CodexStudioEvent | undefined => {
  if (!isRequestId(message.id)) return;
  const requestContext = context(message.params);
  if (requestContext === undefined || !isRecord(message.params)) return;
  const itemId = message.params.itemId;
  if (typeof itemId !== "string") return;
  let detail: string | undefined;
  if (kind === "command") {
    const network = message.params.networkApprovalContext;
    detail = isRecord(network) ? "Network access requested" : "Command execution requested";
  } else if (kind === "file-change") {
    detail = "File changes requested";
  } else {
    detail = "Additional workspace permissions";
  }
  const reason = optionalText(message.params.reason);
  const decisions = Array.isArray(message.params.availableDecisions)
    ? message.params.availableDecisions.filter(
        (decision): decision is NonNullable<StudioAgentApprovalRequest["decisions"]>[number] =>
          decision === "accept" ||
          decision === "acceptForSession" ||
          decision === "decline" ||
          decision === "cancel",
      )
    : undefined;
  return {
    type: "approval-requested",
    ...requestContext,
    request: {
      id: message.id,
      kind,
      itemId,
      ...(decisions === undefined ? {} : { decisions: Object.freeze(decisions) }),
      ...(reason === undefined ? {} : { reason }),
      ...(detail === undefined ? {} : { detail }),
    },
  };
};

/**
 * @internal Projects only readable app-server events. Raw reasoning deltas and
 * raw reasoning-item content deliberately have no output path.
 */
export const decodeCodexStudioEvent = (value: unknown): CodexStudioEvent | undefined => {
  if (!isRecord(value) || typeof value.method !== "string") return;
  if (
    value.method === "item/reasoning/textDelta" ||
    value.method === "rawResponseItem/completed" ||
    value.method === "rawResponse/completed"
  ) {
    return;
  }
  if (value.method === "item/commandExecution/requestApproval") {
    return decodeApproval(value, "command");
  }
  if (value.method === "item/fileChange/requestApproval") {
    return decodeApproval(value, "file-change");
  }
  if (value.method === "item/permissions/requestApproval") {
    return decodeApproval(value, "permissions");
  }
  if (value.method === "serverRequest/resolved") {
    if (
      !isRecord(value.params) ||
      typeof value.params.threadId !== "string" ||
      !isRequestId(value.params.requestId)
    ) {
      return;
    }
    return {
      type: "approval-resolved",
      threadId: value.params.threadId,
      requestId: value.params.requestId,
    };
  }
  if (value.method === "turn/started" || value.method === "turn/completed") {
    if (!isRecord(value.params) || typeof value.params.threadId !== "string") return;
    const turn = value.params.turn;
    if (!isRecord(turn) || typeof turn.id !== "string") return;
    if (value.method === "turn/started") {
      return { type: "turn-started", threadId: value.params.threadId, turnId: turn.id };
    }
    if (turn.status !== "completed" && turn.status !== "interrupted" && turn.status !== "failed") {
      return;
    }
    const error = isRecord(turn.error) ? optionalText(turn.error.message) : undefined;
    return {
      type: "turn-completed",
      threadId: value.params.threadId,
      turnId: turn.id,
      status: turn.status,
      ...(error === undefined ? {} : { error }),
    };
  }
  const eventContext = context(value.params);
  if (eventContext === undefined || !isRecord(value.params)) return;
  if (
    value.method === "item/reasoning/summaryTextDelta" ||
    value.method === "item/agentMessage/delta" ||
    value.method === "item/plan/delta"
  ) {
    if (typeof value.params.itemId !== "string" || typeof value.params.delta !== "string") return;
    const type =
      value.method === "item/reasoning/summaryTextDelta"
        ? "reasoning-summary-delta"
        : value.method === "item/agentMessage/delta"
          ? "agent-message-delta"
          : "plan-delta";
    return { type, ...eventContext, itemId: value.params.itemId, delta: value.params.delta };
  }
  if (value.method === "item/reasoning/summaryPartAdded") {
    if (typeof value.params.itemId !== "string") return;
    return {
      type: "reasoning-summary-boundary",
      ...eventContext,
      itemId: value.params.itemId,
    };
  }
  if (value.method === "item/started" || value.method === "item/completed") {
    const item = itemView(value.params.item);
    if (item === undefined) return;
    return {
      type: value.method === "item/started" ? "item-started" : "item-completed",
      ...eventContext,
      item,
    };
  }
  if (value.method === "turn/plan/updated") {
    if (!Array.isArray(value.params.plan)) return;
    const steps = value.params.plan.flatMap((step): CodexStudioPlanStep[] => {
      if (
        !isRecord(step) ||
        typeof step.step !== "string" ||
        (step.status !== "pending" && step.status !== "inProgress" && step.status !== "completed")
      ) {
        return [];
      }
      return [{ step: bounded(step.step, 240), status: step.status }];
    });
    return { type: "plan-updated", ...eventContext, steps };
  }
  if (value.method === "turn/diff/updated") {
    if (typeof value.params.diff !== "string") return;
    return {
      type: "diff-updated",
      ...eventContext,
      summary: summarizeUnifiedDiff(value.params.diff),
    };
  }
  if (value.method === "error") {
    if (!isRecord(value.params.error) || typeof value.params.error.message !== "string") return;
    return {
      type: "error",
      ...eventContext,
      message: bounded(value.params.error.message),
      willRetry: value.params.willRetry === true,
    };
  }
  return;
};

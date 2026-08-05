import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { DreverStudioActionRecord } from "@drever/schema";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  CLAUDE_STUDIO_AGENT_CAPABILITIES,
  createClaudeStudioAgent,
  type ClaudeCodeProcess,
} from "./studio-claude-agent.ts";

class FakeClaudeProcess extends EventEmitter {
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly inputs: Record<string, unknown>[] = [];
  readonly signals: NodeJS.Signals[] = [];
  killed = false;
  #buffer = "";
  readonly #completeTurnInline: boolean;
  readonly #ignoreTerm: boolean;

  constructor(ignoreTerm = false, completeTurnInline = false) {
    super();
    this.#ignoreTerm = ignoreTerm;
    this.#completeTurnInline = completeTurnInline;
    this.stdin.setEncoding("utf8");
    this.stdin.on("data", (chunk: string) => {
      this.#buffer += chunk;
      let newline = this.#buffer.indexOf("\n");
      while (newline >= 0) {
        this.inputs.push(JSON.parse(this.#buffer.slice(0, newline)) as Record<string, unknown>);
        if (this.#completeTurnInline) {
          this.send({ type: "result", subtype: "success", session_id: "claude-session-1" });
        }
        this.#buffer = this.#buffer.slice(newline + 1);
        newline = this.#buffer.indexOf("\n");
      }
    });
  }

  kill(signal: NodeJS.Signals = "SIGTERM"): boolean {
    this.killed = true;
    this.signals.push(signal);
    if (!this.#ignoreTerm || signal === "SIGKILL") this.emit("exit", null, signal);
    return true;
  }

  send(message: unknown, split?: number): void {
    const line = `${JSON.stringify(message)}\n`;
    if (split === undefined) {
      this.stdout.write(line);
      return;
    }
    this.stdout.write(line.slice(0, split));
    this.stdout.write(line.slice(split));
  }
}

const actionRecord = (
  revision: number,
  type: "approve-plan" | "submit-common-brief" | "submit-feedback" = "submit-common-brief",
): DreverStudioActionRecord =>
  ({
    version: 1,
    revision,
    receivedAt: "2026-08-04T20:00:00.000Z",
    action:
      type === "approve-plan"
        ? {
            version: 1,
            requestId: `approve-${String(revision)}`,
            expectedRevision: revision - 1,
            type,
          }
        : type === "submit-common-brief"
          ? {
              version: 1,
              requestId: `brief-${String(revision)}`,
              expectedRevision: revision - 1,
              type,
              brief: { topic: "A safe streaming adapter" },
            }
          : {
              version: 1,
              requestId: `feedback-${String(revision)}`,
              expectedRevision: revision - 1,
              type,
              scope: { kind: "deck" },
              message: "Make the opening clearer.",
            },
  }) as DreverStudioActionRecord;

const createTestClaudeStudioAgent = (options: Parameters<typeof createClaudeStudioAgent>[0]) =>
  createClaudeStudioAgent({
    verifyActionHandled: async () => true,
    ...options,
  });

describe("native Claude Code Studio agent", () => {
  it("delivers the preview-first approve-plan contract to Claude Code", async () => {
    const child = new FakeClaudeProcess(false, true);
    const provider = createTestClaudeStudioAgent({
      root: "/workspace/deck",
      spawnProcess: () => child as unknown as ClaudeCodeProcess,
    });

    await provider.handleAction(actionRecord(2, "approve-plan"));
    const prompt = JSON.stringify(child.inputs[0]);
    expect(prompt).toContain("bounded, semantic, content-complete Draft 1");
    expect(prompt).toContain("embedded preview iframe");
    expect(prompt).toContain("do not start or restart another development server");
    expect(prompt).toContain("invoke Playwright");
    expect(prompt).toContain("isolated rendered review only after");
    await provider.stop();
  });

  it("starts a safe persistent stream-json session and delivers structured actions", async () => {
    const child = new FakeClaudeProcess();
    let args: readonly string[] = [];
    const provider = createTestClaudeStudioAgent({
      root: "/workspace/deck",
      spawnProcess: (_root, nextArgs) => {
        args = nextArgs;
        return child as unknown as ClaudeCodeProcess;
      },
    });

    await provider.start();
    expect(provider.snapshot()).toMatchObject({ connected: true });
    expect(args).toEqual([
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
    ]);
    expect(args).not.toContain("--dangerously-skip-permissions");

    const delivery = provider.handleAction(actionRecord(1));
    await vi.waitFor(() => expect(child.inputs).toHaveLength(1));
    expect(child.inputs).toHaveLength(1);
    expect(child.inputs[0]).toMatchObject({ type: "user", message: { role: "user" } });
    expect(JSON.stringify(child.inputs[0])).toContain("A safe streaming adapter");
    expect(provider.snapshot().state).toMatchObject({
      handledActionRevision: 0,
      phase: "waiting-for-agent",
    });
    child.send({
      type: "result",
      subtype: "success",
      session_id: "claude-session-1",
    });
    await delivery;
    expect(provider.snapshot().state).toMatchObject({
      handledActionRevision: 1,
      phase: "waiting-for-agent",
    });
  });

  it("streams only public text and safe tool labels", async () => {
    const child = new FakeClaudeProcess();
    const provider = createTestClaudeStudioAgent({
      root: "/workspace/deck",
      spawnProcess: () => child as unknown as ClaudeCodeProcess,
    });
    const delivery = provider.handleAction(actionRecord(1));
    await vi.waitFor(() => expect(child.inputs).toHaveLength(1));

    child.send({ type: "system", subtype: "init", session_id: "claude-session-1" }, 19);
    child.send({
      type: "stream_event",
      session_id: "claude-session-1",
      event: {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "Building the storyboard." },
      },
    });
    child.send({
      type: "stream_event",
      session_id: "claude-session-1",
      event: {
        type: "content_block_delta",
        delta: { type: "thinking_delta", thinking: "PRIVATE_THINKING" },
      },
    });
    child.send({
      type: "stream_event",
      session_id: "claude-session-1",
      event: {
        type: "content_block_start",
        content_block: {
          type: "tool_use",
          id: "tool-1",
          name: "Bash",
          input: { command: "echo SECRET_COMMAND" },
        },
      },
    });
    child.send({
      type: "stream_event",
      session_id: "claude-session-1",
      event: {
        type: "content_block_delta",
        delta: { type: "input_json_delta", partial_json: "SECRET_PARTIAL_ARGUMENT" },
      },
    });
    child.send({
      type: "stream_event",
      session_id: "claude-session-1",
      event: { type: "content_block_stop", index: 1 },
    });

    await vi.waitFor(() =>
      expect(provider.snapshot()).toMatchObject({
        connected: true,
        sessionId: "claude-session-1",
        state: {
          message: "Building the storyboard.",
          activity: expect.arrayContaining([
            expect.objectContaining({ label: "Running a project command", status: "active" }),
          ]),
        },
      }),
    );
    const serialized = JSON.stringify(provider.snapshot());
    expect(serialized).not.toContain("PRIVATE_THINKING");
    expect(serialized).not.toContain("SECRET_COMMAND");
    expect(serialized).not.toContain("SECRET_PARTIAL_ARGUMENT");
    child.send({
      type: "user",
      session_id: "claude-session-1",
      message: {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "tool-1", content: "SECRET_TOOL_RESULT" }],
      },
    });
    await vi.waitFor(() =>
      expect(provider.snapshot().state?.activity).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: "Running a project command", status: "complete" }),
        ]),
      ),
    );
    expect(JSON.stringify(provider.snapshot())).not.toContain("SECRET_TOOL_RESULT");
    child.send({ type: "result", subtype: "success", session_id: "claude-session-1" });
    await delivery;
  });

  it("keeps late public text visible after the bounded history fills", async () => {
    const child = new FakeClaudeProcess();
    const provider = createTestClaudeStudioAgent({
      root: "/workspace/deck",
      spawnProcess: () => child as unknown as ClaudeCodeProcess,
    });
    const delivery = provider.handleAction(actionRecord(1));
    await vi.waitFor(() => expect(child.inputs).toHaveLength(1));
    child.send({
      type: "stream_event",
      session_id: "claude-session-1",
      event: {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "a".repeat(4_000) },
      },
    });
    child.send({
      type: "stream_event",
      session_id: "claude-session-1",
      event: {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "LATEST_PUBLIC_UPDATE" },
      },
    });

    await vi.waitFor(() =>
      expect(provider.snapshot().state?.message).toContain("LATEST_PUBLIC_UPDATE"),
    );
    child.send({ type: "result", subtype: "success", session_id: "claude-session-1" });
    await delivery;
    await provider.stop();
  });

  it("queues the next action until the current result completes", async () => {
    const child = new FakeClaudeProcess();
    const provider = createTestClaudeStudioAgent({
      root: "/workspace/deck",
      spawnProcess: () => child as unknown as ClaudeCodeProcess,
    });
    const first = provider.handleAction(actionRecord(1));
    await vi.waitFor(() => expect(child.inputs).toHaveLength(1));
    const second = provider.handleAction(actionRecord(2, "submit-feedback"));
    expect(child.inputs).toHaveLength(1);

    child.send({
      type: "result",
      subtype: "success",
      session_id: "claude-session-1",
      result: "RAW_RESULT_MUST_NOT_BE_PROJECTED",
    });
    await first;
    await vi.waitFor(() => expect(child.inputs).toHaveLength(2));
    expect(child.inputs).toHaveLength(2);
    expect(provider.snapshot().state).toMatchObject({
      handledActionRevision: 1,
      phase: "refining",
    });
    expect(JSON.stringify(provider.snapshot())).not.toContain("RAW_RESULT_MUST_NOT_BE_PROJECTED");
    child.send({ type: "result", subtype: "success", session_id: "claude-session-1" });
    await second;
    expect(provider.snapshot().state).toMatchObject({
      handledActionRevision: 2,
      phase: "waiting-for-agent",
    });
  });

  it("states the approval limitation without exposing deferred tool input", async () => {
    const child = new FakeClaudeProcess();
    const provider = createTestClaudeStudioAgent({
      root: "/workspace/deck",
      spawnProcess: () => child as unknown as ClaudeCodeProcess,
    });
    const delivery = provider.handleAction(actionRecord(1));
    await vi.waitFor(() => expect(child.inputs).toHaveLength(1));
    child.send({
      type: "result",
      subtype: "success",
      session_id: "claude-session-1",
      stop_reason: "tool_deferred",
      deferred_tool_use: {
        id: "tool-2",
        name: "SensitiveTool",
        input: { token: "SECRET_DEFERRED_INPUT" },
      },
    });

    await vi.waitFor(() => expect(provider.snapshot().state?.phase).toBe("error"));
    expect(CLAUDE_STUDIO_AGENT_CAPABILITIES.interactiveApprovals).toBe(false);
    expect(provider.approvals()).toEqual([]);
    await expect(provider.respondToApproval("tool-2", "accept")).rejects.toThrowError(
      "does not expose a stable Studio approval response channel",
    );
    await expect(delivery).rejects.toThrowError("cannot resume");
    expect(JSON.stringify(provider.snapshot())).not.toContain("SECRET_DEFERRED_INPUT");
  });

  it("does not handle a malformed deferred result as success", async () => {
    const child = new FakeClaudeProcess();
    const provider = createTestClaudeStudioAgent({
      root: "/workspace/deck",
      spawnProcess: () => child as unknown as ClaudeCodeProcess,
    });
    const delivery = provider.handleAction(actionRecord(1));
    await vi.waitFor(() => expect(child.inputs).toHaveLength(1));
    child.send({
      type: "result",
      subtype: "success",
      session_id: "claude-session-1",
      stop_reason: "tool_deferred",
      deferred_tool_use: { name: "AskUserQuestion" },
    });

    await expect(delivery).rejects.toThrowError("stopped before completing");
    expect(provider.snapshot().state).toMatchObject({ handledActionRevision: 0, phase: "error" });
  });

  it("reports lifecycle failure without forwarding stderr", async () => {
    const child = new FakeClaudeProcess();
    const provider = createTestClaudeStudioAgent({
      root: "/workspace/deck",
      spawnProcess: () => child as unknown as ClaudeCodeProcess,
    });
    await provider.start();
    child.stderr.write("SECRET_STDERR_TOKEN");
    child.emit("error", new Error("SECRET_START_PATH /Users/private/deck"));

    await vi.waitFor(() => expect(provider.snapshot().connected).toBe(false));
    expect(provider.snapshot().state).toMatchObject({
      phase: "error",
      message: "Claude Code disconnected before finishing the Studio session.",
    });
    expect(JSON.stringify(provider.snapshot())).not.toContain("SECRET_STDERR_TOKEN");
    expect(JSON.stringify(provider.snapshot())).not.toContain("SECRET_START_PATH");
    expect(JSON.stringify(provider.snapshot())).not.toContain("/Users/private/deck");
    await provider.stop();
    expect(child.killed).toBe(false);
  });

  it("keeps an interrupted action unhandled and can replay it after reconnecting", async () => {
    const first = new FakeClaudeProcess();
    const second = new FakeClaudeProcess();
    const children = [first, second];
    const provider = createTestClaudeStudioAgent({
      root: "/workspace/deck",
      spawnProcess: () => children.shift() as unknown as ClaudeCodeProcess,
    });

    const interrupted = provider.handleAction(actionRecord(1));
    const interruptedResult = expect(interrupted).rejects.toThrowError("disconnected");
    await vi.waitFor(() => expect(first.inputs).toHaveLength(1));
    first.emit("exit", 1, null);
    await interruptedResult;
    expect(provider.snapshot()).toMatchObject({
      connected: false,
      state: { handledActionRevision: 0, phase: "error" },
    });

    const replayed = provider.handleAction(actionRecord(1));
    await vi.waitFor(() => expect(second.inputs).toHaveLength(1));
    second.send({ type: "result", subtype: "success", session_id: "claude-session-2" });
    await replayed;
    expect(provider.snapshot().state).toMatchObject({ handledActionRevision: 1 });
    await provider.stop();
  });

  it("fails a silent turn within the configured watchdog without marking it handled", async () => {
    const child = new FakeClaudeProcess(true);
    const provider = createTestClaudeStudioAgent({
      root: "/workspace/deck",
      shutdownTimeoutMs: 10,
      turnTimeoutMs: 20,
      spawnProcess: () => child as unknown as ClaudeCodeProcess,
    });

    const delivery = provider.handleAction(actionRecord(1));
    await expect(delivery).rejects.toThrowError("stopped reporting progress");
    await vi.waitFor(() => expect(child.signals).toEqual(["SIGTERM", "SIGKILL"]));
    expect(provider.snapshot().state).toMatchObject({ handledActionRevision: 0, phase: "error" });
  });

  it("rejects the active action when Claude closes its input stream", async () => {
    const child = new FakeClaudeProcess();
    const provider = createTestClaudeStudioAgent({
      root: "/workspace/deck",
      spawnProcess: () => child as unknown as ClaudeCodeProcess,
    });

    const delivery = provider.handleAction(actionRecord(1));
    const result = expect(delivery).rejects.toThrowError("closed its Studio input stream");
    await vi.waitFor(() => expect(child.inputs).toHaveLength(1));
    child.stdin.emit("error", new Error("EPIPE"));
    await result;
    expect(provider.snapshot()).toMatchObject({
      connected: false,
      state: { handledActionRevision: 0, phase: "error" },
    });
    expect(child.killed).toBe(true);
  });

  it("allows startup to be retried after a synchronous launch failure", async () => {
    const child = new FakeClaudeProcess();
    let attempts = 0;
    const provider = createTestClaudeStudioAgent({
      root: "/workspace/deck",
      spawnProcess: () => {
        attempts += 1;
        if (attempts === 1) throw new Error("launch failed");
        return child as unknown as ClaudeCodeProcess;
      },
    });

    await expect(provider.start()).rejects.toThrowError("could not start");
    expect(provider.snapshot()).toMatchObject({
      connected: false,
      state: {
        phase: "error",
        message:
          "Claude Code could not start. Make sure the Claude Code CLI is installed and signed in.",
      },
    });
    await expect(provider.start()).resolves.toBeUndefined();
    expect(provider.snapshot()).toMatchObject({
      connected: true,
      state: { phase: "waiting-for-agent" },
    });
    await provider.stop();
  });

  it("allows startup to be retried after an asynchronous process error", async () => {
    const first = new FakeClaudeProcess();
    const second = new FakeClaudeProcess();
    const children = [first, second];
    const provider = createTestClaudeStudioAgent({
      root: "/workspace/deck",
      spawnProcess: () => children.shift() as unknown as ClaudeCodeProcess,
    });

    await provider.start();
    first.emit("error", new Error("ENOENT"));
    await vi.waitFor(() =>
      expect(provider.snapshot()).toMatchObject({ connected: false, state: { phase: "error" } }),
    );

    await expect(provider.start()).resolves.toBeUndefined();
    expect(provider.snapshot()).toMatchObject({
      connected: true,
      state: { phase: "waiting-for-agent" },
    });
    await provider.stop();
  });

  it("escalates shutdown when Claude Code ignores SIGTERM", async () => {
    const child = new FakeClaudeProcess(true);
    const provider = createTestClaudeStudioAgent({
      root: "/workspace/deck",
      shutdownTimeoutMs: 10,
      spawnProcess: () => child as unknown as ClaudeCodeProcess,
    });

    await provider.start();
    await provider.stop();
    expect(child.signals).toEqual(["SIGTERM", "SIGKILL"]);
  });

  it("keeps an action pending when Claude finishes without publishing its revision", async () => {
    const child = new FakeClaudeProcess();
    const verifyActionHandled = vi.fn(async () => false);
    const provider = createTestClaudeStudioAgent({
      root: "/workspace/deck",
      spawnProcess: () => child as unknown as ClaudeCodeProcess,
      verifyActionHandled,
    });

    const delivery = provider.handleAction(actionRecord(1));
    await vi.waitFor(() => expect(child.inputs).toHaveLength(1));
    child.send({ type: "result", subtype: "success", session_id: "claude-session-1" });

    await expect(delivery).rejects.toThrowError("without publishing");
    expect(verifyActionHandled).toHaveBeenCalledWith(actionRecord(1));
    expect(provider.snapshot().state).toMatchObject({
      handledActionRevision: 0,
      message: "Claude Code finished without publishing the latest Studio state.",
      phase: "error",
    });
    await provider.stop();
  });

  it("finishes publication verification before handling stdout end", async () => {
    const child = new FakeClaudeProcess();
    let finishVerification: ((handled: boolean) => void) | undefined;
    const verifyActionHandled = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishVerification = resolve;
        }),
    );
    const provider = createClaudeStudioAgent({
      root: "/workspace/deck",
      spawnProcess: () => child as unknown as ClaudeCodeProcess,
      verifyActionHandled,
    });

    const delivery = provider.handleAction(actionRecord(1));
    const delivered = expect(delivery).resolves.toBeUndefined();
    await vi.waitFor(() => expect(child.inputs).toHaveLength(1));
    child.send({ type: "result", subtype: "success", session_id: "claude-session-1" });
    await vi.waitFor(() => expect(verifyActionHandled).toHaveBeenCalledOnce());
    const ended = new Promise<void>((resolve) => child.stdout.once("end", resolve));
    child.stdout.end();
    await ended;
    finishVerification?.(true);

    await delivered;
    expect(provider.snapshot()).toMatchObject({
      connected: true,
      state: { handledActionRevision: 1, phase: "waiting-for-agent" },
    });
    await provider.stop();
  });

  it("finishes publication verification before handling process exit", async () => {
    const child = new FakeClaudeProcess();
    let finishVerification: ((handled: boolean) => void) | undefined;
    const verifyActionHandled = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishVerification = resolve;
        }),
    );
    const provider = createClaudeStudioAgent({
      root: "/workspace/deck",
      spawnProcess: () => child as unknown as ClaudeCodeProcess,
      verifyActionHandled,
    });

    const delivery = provider.handleAction(actionRecord(1));
    const delivered = expect(delivery).resolves.toBeUndefined();
    await vi.waitFor(() => expect(child.inputs).toHaveLength(1));
    child.send({ type: "result", subtype: "success", session_id: "claude-session-1" });
    await vi.waitFor(() => expect(verifyActionHandled).toHaveBeenCalledOnce());
    child.emit("exit", 0, null);
    finishVerification?.(true);

    await delivered;
    await vi.waitFor(() =>
      expect(provider.snapshot()).toMatchObject({
        connected: false,
        state: { handledActionRevision: 1, phase: "waiting-for-agent" },
      }),
    );
  });

  it("continues the queue when Claude reports a result before the write callback", async () => {
    const child = new FakeClaudeProcess(false, true);
    const provider = createTestClaudeStudioAgent({
      root: "/workspace/deck",
      spawnProcess: () => child as unknown as ClaudeCodeProcess,
    });

    await Promise.all([
      provider.handleAction(actionRecord(1)),
      provider.handleAction(actionRecord(2, "submit-feedback")),
    ]);
    expect(child.inputs).toHaveLength(2);
    expect(provider.snapshot().state).toMatchObject({ handledActionRevision: 2 });
    await provider.stop();
  });
});

import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { DreverStudioActionRecord } from "@drever/schema";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  createCodexAppServerConnection,
  decodeCodexStudioEvent,
  summarizeUnifiedDiff,
} from "./codex-app-server-protocol.ts";
import { createCodexStudioAgent, type CodexAppServerProcess } from "./studio-codex-agent.ts";

class FakeAppServerProcess extends EventEmitter {
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly messages: Record<string, unknown>[] = [];
  readonly signals: NodeJS.Signals[] = [];
  killed = false;
  private readonly autoRespond: boolean;
  private buffer = "";
  private readonly completeTurnInline: boolean;
  private readonly ignoreTerm: boolean;

  constructor(ignoreTerm = false, autoRespond = true, completeTurnInline = false) {
    super();
    this.ignoreTerm = ignoreTerm;
    this.autoRespond = autoRespond;
    this.completeTurnInline = completeTurnInline;
    this.stdin.setEncoding("utf8");
    this.stdin.on("data", (chunk: string) => {
      this.buffer += chunk;
      let newline = this.buffer.indexOf("\n");
      while (newline >= 0) {
        const line = this.buffer.slice(0, newline);
        this.buffer = this.buffer.slice(newline + 1);
        const message = JSON.parse(line) as Record<string, unknown>;
        this.messages.push(message);
        this.respondToClientRequest(message);
        newline = this.buffer.indexOf("\n");
      }
    });
  }

  kill(signal: NodeJS.Signals = "SIGTERM"): boolean {
    this.killed = true;
    this.signals.push(signal);
    if (!this.ignoreTerm || signal === "SIGKILL") this.emit("exit", null, signal);
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

  private respondToClientRequest(message: Record<string, unknown>): void {
    if (!this.autoRespond) return;
    if (typeof message.id !== "number") return;
    if (message.method === "initialize") {
      this.send({ id: message.id, result: { userAgent: "Codex test" } });
    } else if (message.method === "thread/start") {
      this.send({ id: message.id, result: { thread: { id: "thread-1" } } });
    } else if (message.method === "turn/start") {
      if (this.completeTurnInline) {
        this.send({
          method: "turn/completed",
          params: {
            threadId: "thread-1",
            turn: { id: "turn-1", status: "completed", error: null },
          },
        });
      }
      this.send({
        id: message.id,
        result: { turn: { id: "turn-1", status: "inProgress", items: [], error: null } },
      });
    }
  }
}

const actionRecord = {
  version: 1,
  revision: 1,
  receivedAt: "2026-08-04T20:00:00.000Z",
  action: {
    version: 1,
    requestId: "brief-1",
    expectedRevision: 0,
    type: "submit-common-brief",
    brief: { topic: "A safe streaming adapter" },
  },
} as const satisfies DreverStudioActionRecord;

const approvePlanRecord = {
  version: 1,
  revision: 2,
  receivedAt: "2026-08-05T08:00:00.000Z",
  action: {
    version: 1,
    requestId: "approve-2",
    expectedRevision: 1,
    type: "approve-plan",
  },
} as const satisfies DreverStudioActionRecord;

const directionRecord = {
  version: 1,
  revision: 2,
  receivedAt: "2026-08-05T08:00:00.000Z",
  action: {
    version: 1,
    requestId: "answers-2",
    expectedRevision: 1,
    type: "submit-adaptive-answers",
    answers: [{ questionId: "proof", optionIds: ["demo"] }],
  },
} as const satisfies DreverStudioActionRecord;

const createTestCodexStudioAgent = (options: Parameters<typeof createCodexStudioAgent>[0]) =>
  createCodexStudioAgent({
    verifyActionHandled: async () => true,
    ...options,
  });

describe("Codex app-server protocol", () => {
  it("correlates split JSONL responses without a jsonrpc envelope", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const connection = createCodexAppServerConnection(
      { input, output },
      {
        onFailure: vi.fn(),
        onNotification: vi.fn(),
        onServerRequest: vi.fn(),
        requestTimeoutMs: 1_000,
      },
    );
    let request = "";
    input.setEncoding("utf8");
    input.on("data", (chunk: string) => {
      request += chunk;
    });

    const result = connection.request("thread/start", { ephemeral: true });
    await vi.waitFor(() => expect(request).toContain("\n"));
    expect(JSON.parse(request) as unknown).toEqual({
      method: "thread/start",
      id: 1,
      params: { ephemeral: true },
    });
    const response = '{"id":1,"result":{"thread":{"id":"thread-1"}}}\n';
    output.write(response.slice(0, 13));
    output.write(response.slice(13));
    await expect(result).resolves.toEqual({ thread: { id: "thread-1" } });
    connection.close();
  });

  it("rejects pending requests when the app-server input stream fails", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const onFailure = vi.fn();
    const connection = createCodexAppServerConnection(
      { input, output },
      {
        onFailure,
        onNotification: vi.fn(),
        onServerRequest: vi.fn(),
        requestTimeoutMs: 1_000,
      },
    );

    const pending = connection.request("thread/start", { ephemeral: true });
    input.emit("error", new Error("EPIPE"));
    await expect(pending).rejects.toThrowError("EPIPE");
    expect(onFailure).toHaveBeenCalledWith(expect.objectContaining({ message: "EPIPE" }));
  });

  it("projects readable summaries but drops raw reasoning and reasoning content", () => {
    expect(
      decodeCodexStudioEvent({
        method: "item/reasoning/summaryTextDelta",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "reasoning-1",
          delta: "Checking the deck structure",
          summaryIndex: 0,
        },
      }),
    ).toMatchObject({ type: "reasoning-summary-delta", delta: "Checking the deck structure" });
    expect(
      decodeCodexStudioEvent({
        method: "item/reasoning/textDelta",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "reasoning-1",
          delta: "private reasoning must not escape",
          contentIndex: 0,
        },
      }),
    ).toBeUndefined();
    const completed = decodeCodexStudioEvent({
      method: "item/completed",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        item: {
          type: "reasoning",
          id: "reasoning-1",
          summary: ["Readable summary"],
          content: ["private reasoning must not escape"],
        },
      },
    });
    expect(completed).toMatchObject({ item: { message: "Readable summary" } });
    expect(JSON.stringify(completed)).not.toContain("private reasoning");
  });

  it("summarizes diff events without forwarding patch text", () => {
    expect(
      summarizeUnifiedDiff("diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n-old\n+new\n+next\n"),
    ).toBe("1 file changed · 2 additions · 1 deletion");
  });
});

describe("native Codex Studio agent", () => {
  it("keeps managed Codex sandboxed while auto-reviewing eligible approvals", async () => {
    const child = new FakeAppServerProcess();
    const provider = createTestCodexStudioAgent({
      root: "/workspace/deck",
      requestTimeoutMs: 1_000,
      spawnProcess: () => child as unknown as CodexAppServerProcess,
    });

    await provider.start();
    const threadStart = child.messages.find(({ method }) => method === "thread/start");
    expect(threadStart).toEqual({
      id: 2,
      method: "thread/start",
      params: {
        cwd: "/workspace/deck",
        runtimeWorkspaceRoots: ["/workspace/deck"],
        approvalPolicy: "on-request",
        approvalsReviewer: "auto_review",
        sandbox: "workspace-write",
        serviceName: "drever_studio",
        threadSource: "appServer",
        ephemeral: true,
      },
    });
    expect(JSON.stringify(threadStart)).not.toMatch(/dangerFullAccess|fullAccess|networkAccess/);
    await provider.stop();
  });

  it("delivers the preview-first approve-plan contract to Codex", async () => {
    const child = new FakeAppServerProcess(false, true, true);
    const provider = createTestCodexStudioAgent({
      root: "/workspace/deck",
      requestTimeoutMs: 1_000,
      spawnProcess: () => child as unknown as CodexAppServerProcess,
    });

    await provider.handleAction(approvePlanRecord);
    const turnStart = child.messages.find(({ method }) => method === "turn/start");
    const prompt = JSON.stringify(turnStart);
    expect(prompt).toContain("bounded, semantic, content-complete Draft 1");
    expect(prompt).toContain("preserve the exact approved or configured canvas");
    expect(prompt).toContain("embedded preview iframe");
    expect(prompt).toContain("do not start or restart another development server");
    expect(prompt).toContain("invoke Playwright");
    expect(prompt).toContain("isolated rendered review only after");
    expect(prompt).toContain("user-owned session resources");
    expect(prompt).toContain("never use broad process cleanup");
    expect(prompt).toContain("isolated ephemeral loopback preview");
    expect(prompt).toContain("Never use data:, blob:, or javascript: URLs as CSS @import");
    await provider.stop();
  });

  it("delivers the Storyboard-first direction contract to Codex", async () => {
    const child = new FakeAppServerProcess(false, true, true);
    const provider = createTestCodexStudioAgent({
      root: "/workspace/deck",
      requestTimeoutMs: 1_000,
      spawnProcess: () => child as unknown as CodexAppServerProcess,
    });

    await provider.handleAction(directionRecord);
    const turnStart = child.messages.find(({ method }) => method === "turn/start");
    const prompt = JSON.stringify(turnStart);
    expect(prompt).toContain("Storyboard handoff as latency-sensitive");
    expect(prompt).toContain("publish plan-review immediately");
    expect(prompt).toContain("version-2 drever.plan.json");
    expect(prompt).toContain("Storyboard is a content contract");
    expect(prompt).toContain("do not browse, research facts or assets");
    expect(prompt).toContain("return this managed child turn at the human approval gate");
    expect(prompt).not.toContain("content-complete Draft 1");
    await provider.stop();
  });

  it("owns a thread and streams safe live state, lifecycle, plans, diffs, and approvals", async () => {
    const child = new FakeAppServerProcess();
    const provider = createTestCodexStudioAgent({
      root: "/workspace/deck",
      requestTimeoutMs: 1_000,
      spawnProcess: () => child as unknown as CodexAppServerProcess,
    });

    await provider.start();
    expect(provider.snapshot()).toMatchObject({ connected: true, sessionId: "thread-1" });
    expect(child.messages.slice(0, 3).map(({ method }) => method)).toEqual([
      "initialize",
      "initialized",
      "thread/start",
    ]);

    const delivery = provider.handleAction(actionRecord);
    await vi.waitFor(() =>
      expect(child.messages.some(({ method }) => method === "turn/start")).toBe(true),
    );
    const turnStart = child.messages.find(({ method }) => method === "turn/start");
    expect(turnStart).toMatchObject({
      params: {
        threadId: "thread-1",
        summary: "concise",
        input: [expect.objectContaining({ type: "text" })],
      },
    });
    expect(JSON.stringify(turnStart)).toContain("A safe streaming adapter");
    expect(provider.snapshot().state).toMatchObject({ handledActionRevision: 0 });

    child.send({
      method: "turn/started",
      params: { threadId: "thread-1", turn: { id: "turn-1", status: "inProgress" } },
    });
    child.send(
      {
        method: "item/reasoning/summaryTextDelta",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "reasoning-1",
          delta: "Reviewing the story flow ✨",
          summaryIndex: 0,
        },
      },
      37,
    );
    child.send({
      method: "item/reasoning/textDelta",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "reasoning-1",
        delta: "SECRET_RAW_REASONING",
        contentIndex: 0,
      },
    });
    child.send({
      method: "item/started",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        item: {
          type: "commandExecution",
          id: "command-1",
          command: "vp test",
          status: "inProgress",
        },
      },
    });
    child.send({
      method: "turn/plan/updated",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        explanation: null,
        plan: [
          { step: "Inspect the story", status: "completed" },
          { step: "Build the draft", status: "inProgress" },
        ],
      },
    });
    child.send({
      method: "turn/diff/updated",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        diff: "diff --git a/slides.mdx b/slides.mdx\n--- a/slides.mdx\n+++ b/slides.mdx\n-old\n+new\n",
      },
    });
    child.send({
      method: "item/tool/requestUserInput",
      id: 77,
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        prompt: "RAW_UNSUPPORTED_PROMPT",
      },
    });
    await vi.waitFor(() =>
      expect(child.messages).toContainEqual({
        id: 77,
        error: {
          code: -32_601,
          message: "Drever Studio does not support this Codex app-server request.",
        },
      }),
    );
    child.send({
      method: "item/commandExecution/requestApproval",
      id: 99,
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "command-1",
        startedAtMs: 1,
        reason: "Allow the verification command",
        command: "vp test",
        availableDecisions: ["accept", "decline", "cancel"],
      },
    });

    await vi.waitFor(() =>
      expect(provider.snapshot().state).toMatchObject({
        phase: "waiting-for-agent",
        handledActionRevision: 0,
        progress: { label: "Build the draft" },
        activity: [expect.objectContaining({ label: "Approval needed", status: "active" })],
        message: "Allow the verification command",
      }),
    );
    expect(provider.snapshot().state?.progress).not.toHaveProperty("completed");
    expect(provider.snapshot().state?.progress).not.toHaveProperty("total");
    expect(JSON.stringify(provider.snapshot())).not.toContain("SECRET_RAW_REASONING");
    expect(provider.approvals()).toEqual([
      expect.objectContaining({
        id: 99,
        kind: "command",
        itemId: "command-1",
        decisions: ["accept", "decline", "cancel"],
      }),
    ]);

    await expect(provider.respondToApproval(99, "acceptForSession")).rejects.toThrowError(
      "does not support acceptForSession",
    );
    await provider.respondToApproval(99, "decline");
    expect(child.messages).toContainEqual({ id: 99, result: { decision: "decline" } });
    child.send({
      method: "item/agentMessage/delta",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "message-1",
        delta: "Draft ready for review.",
      },
    });
    child.send({
      method: "turn/completed",
      params: {
        threadId: "thread-1",
        turn: { id: "turn-1", status: "completed", error: null },
      },
    });
    await delivery;
    await vi.waitFor(() =>
      expect(provider.snapshot().state).toMatchObject({
        handledActionRevision: 1,
        phase: "waiting-for-agent",
        message: "Draft ready for review.",
      }),
    );

    await provider.stop();
    expect(child.killed).toBe(true);
    expect(provider.snapshot().connected).toBe(false);
  });

  it("treats an idle app-server exit as resumable and reconnects for the next action", async () => {
    const first = new FakeAppServerProcess();
    const second = new FakeAppServerProcess();
    const children = [first, second];
    const provider = createTestCodexStudioAgent({
      root: "/workspace/deck",
      requestTimeoutMs: 1_000,
      spawnProcess: () => children.shift() as unknown as CodexAppServerProcess,
    });

    const firstDelivery = provider.handleAction(actionRecord);
    await vi.waitFor(() =>
      expect(first.messages.some(({ method }) => method === "turn/start")).toBe(true),
    );
    first.send({
      method: "turn/completed",
      params: {
        threadId: "thread-1",
        turn: { id: "turn-1", status: "completed", error: null },
      },
    });
    await firstDelivery;

    first.emit("exit", 0, null);
    expect(provider.snapshot()).toMatchObject({
      connected: false,
      state: { handledActionRevision: 1, phase: "waiting-for-agent" },
    });
    expect(provider.snapshot().state?.message).toBeUndefined();

    const secondDelivery = provider.handleAction(approvePlanRecord);
    await vi.waitFor(() =>
      expect(second.messages.some(({ method }) => method === "turn/start")).toBe(true),
    );
    second.send({
      method: "turn/completed",
      params: {
        threadId: "thread-1",
        turn: { id: "turn-1", status: "completed", error: null },
      },
    });
    await secondDelivery;
    expect(provider.snapshot()).toMatchObject({
      connected: true,
      state: { handledActionRevision: 2, phase: "waiting-for-agent" },
    });
    await provider.stop();
  });

  it("keeps late public summary deltas visible after the bounded history fills", async () => {
    const child = new FakeAppServerProcess();
    const provider = createTestCodexStudioAgent({
      root: "/workspace/deck",
      requestTimeoutMs: 1_000,
      spawnProcess: () => child as unknown as CodexAppServerProcess,
    });
    const delivery = provider.handleAction(actionRecord);
    await vi.waitFor(() =>
      expect(child.messages.some(({ method }) => method === "turn/start")).toBe(true),
    );
    child.send({
      method: "turn/started",
      params: { threadId: "thread-1", turn: { id: "turn-1", status: "inProgress" } },
    });
    child.send({
      method: "item/reasoning/summaryTextDelta",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "reasoning-1",
        delta: "a".repeat(4_000),
        summaryIndex: 0,
      },
    });
    child.send({
      method: "item/reasoning/summaryTextDelta",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "reasoning-1",
        delta: "LATEST_PUBLIC_UPDATE",
        summaryIndex: 0,
      },
    });

    await vi.waitFor(() =>
      expect(provider.snapshot().state?.message).toContain("LATEST_PUBLIC_UPDATE"),
    );
    child.send({
      method: "turn/completed",
      params: {
        threadId: "thread-1",
        turn: { id: "turn-1", status: "completed", error: null },
      },
    });
    await delivery;
    await provider.stop();
  });

  it("keeps an interrupted action unhandled and can replay it after reconnecting", async () => {
    const first = new FakeAppServerProcess();
    const second = new FakeAppServerProcess();
    const children = [first, second];
    const provider = createTestCodexStudioAgent({
      root: "/workspace/deck",
      requestTimeoutMs: 1_000,
      spawnProcess: () => children.shift() as unknown as CodexAppServerProcess,
    });

    const interrupted = provider.handleAction(actionRecord);
    const interruptedResult = expect(interrupted).rejects.toThrowError("exited");
    await vi.waitFor(() =>
      expect(first.messages.some(({ method }) => method === "turn/start")).toBe(true),
    );
    first.emit("exit", 1, null);
    await interruptedResult;
    expect(provider.snapshot()).toMatchObject({
      connected: false,
      state: { handledActionRevision: 0, phase: "error" },
    });

    const replayed = provider.handleAction(actionRecord);
    await vi.waitFor(() =>
      expect(second.messages.some(({ method }) => method === "turn/start")).toBe(true),
    );
    second.send({
      method: "turn/completed",
      params: {
        threadId: "thread-1",
        turn: { id: "turn-1", status: "completed", error: null },
      },
    });
    await replayed;
    expect(provider.snapshot().state).toMatchObject({ handledActionRevision: 1 });
    await provider.stop();
  });

  it("fails a silent turn within the configured watchdog without marking it handled", async () => {
    const child = new FakeAppServerProcess(true);
    const provider = createTestCodexStudioAgent({
      root: "/workspace/deck",
      requestTimeoutMs: 1_000,
      shutdownTimeoutMs: 10,
      turnTimeoutMs: 20,
      spawnProcess: () => child as unknown as CodexAppServerProcess,
    });

    const delivery = provider.handleAction(actionRecord);
    await expect(delivery).rejects.toThrowError("stopped reporting progress");
    await vi.waitFor(() => expect(child.signals).toEqual(["SIGTERM", "SIGKILL"]));
    expect(provider.snapshot().state).toMatchObject({ handledActionRevision: 0, phase: "error" });
  });

  it("allows startup to be retried after a synchronous launch failure", async () => {
    const child = new FakeAppServerProcess();
    let attempts = 0;
    const provider = createTestCodexStudioAgent({
      root: "/workspace/deck",
      requestTimeoutMs: 1_000,
      spawnProcess: () => {
        attempts += 1;
        if (attempts === 1) throw new Error("launch failed");
        return child as unknown as CodexAppServerProcess;
      },
    });

    await expect(provider.start()).rejects.toThrowError("launch failed");
    expect(provider.snapshot()).toMatchObject({
      connected: false,
      state: {
        phase: "error",
        message: "Codex could not start. Make sure the Codex CLI is installed and signed in.",
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
    const first = new FakeAppServerProcess(false, false);
    const second = new FakeAppServerProcess();
    const children = [first, second];
    const provider = createTestCodexStudioAgent({
      root: "/workspace/deck",
      requestTimeoutMs: 1_000,
      spawnProcess: () => children.shift() as unknown as CodexAppServerProcess,
    });

    const firstStart = provider.start();
    await vi.waitFor(() => expect(first.messages).toHaveLength(1));
    first.emit("error", new Error("SECRET_START_PATH /Users/private/deck"));
    await expect(firstStart).rejects.toThrowError("SECRET_START_PATH");
    expect(provider.snapshot()).toMatchObject({ connected: false, state: { phase: "error" } });
    expect(JSON.stringify(provider.snapshot())).not.toContain("SECRET_START_PATH");
    expect(JSON.stringify(provider.snapshot())).not.toContain("/Users/private/deck");

    await expect(provider.start()).resolves.toBeUndefined();
    expect(provider.snapshot()).toMatchObject({
      connected: true,
      state: { phase: "waiting-for-agent" },
    });
    await provider.stop();
  });

  it("escalates shutdown when the app-server ignores SIGTERM", async () => {
    const child = new FakeAppServerProcess(true);
    const provider = createTestCodexStudioAgent({
      root: "/workspace/deck",
      requestTimeoutMs: 1_000,
      shutdownTimeoutMs: 10,
      spawnProcess: () => child as unknown as CodexAppServerProcess,
    });

    await provider.start();
    await provider.stop();
    expect(child.signals).toEqual(["SIGTERM", "SIGKILL"]);
  });

  it("keeps an action pending when Codex finishes without publishing its revision", async () => {
    const child = new FakeAppServerProcess();
    const verifyActionHandled = vi.fn(async () => false);
    const provider = createTestCodexStudioAgent({
      root: "/workspace/deck",
      requestTimeoutMs: 1_000,
      spawnProcess: () => child as unknown as CodexAppServerProcess,
      verifyActionHandled,
    });

    const delivery = provider.handleAction(actionRecord);
    await vi.waitFor(() =>
      expect(child.messages.some(({ method }) => method === "turn/start")).toBe(true),
    );
    child.send({
      method: "turn/completed",
      params: {
        threadId: "thread-1",
        turn: { id: "turn-1", status: "completed", error: null },
      },
    });

    await expect(delivery).rejects.toThrowError("without publishing");
    expect(verifyActionHandled).toHaveBeenCalledWith(actionRecord);
    expect(provider.snapshot().state).toMatchObject({
      handledActionRevision: 0,
      message: "Codex finished without publishing the latest Studio state.",
      phase: "error",
    });
    await provider.stop();
  });

  it("continues the queue when a turn completes before turn/start returns", async () => {
    const child = new FakeAppServerProcess(false, true, true);
    const provider = createTestCodexStudioAgent({
      root: "/workspace/deck",
      requestTimeoutMs: 1_000,
      spawnProcess: () => child as unknown as CodexAppServerProcess,
    });
    const secondRecord = {
      ...actionRecord,
      revision: 2,
      action: { ...actionRecord.action, requestId: "brief-2", expectedRevision: 1 },
    } as const satisfies DreverStudioActionRecord;

    await Promise.all([provider.handleAction(actionRecord), provider.handleAction(secondRecord)]);
    expect(child.messages.filter(({ method }) => method === "turn/start")).toHaveLength(2);
    expect(provider.snapshot().state).toMatchObject({ handledActionRevision: 2 });
    await provider.stop();
  });
});

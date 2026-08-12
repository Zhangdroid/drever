import { PassThrough, Readable, Writable } from "node:stream";
import {
  PROTOCOL_VERSION,
  agent,
  methods,
  ndJsonStream,
  type AgentConnection,
  type PermissionOptionId,
  type PromptRequest,
  type StopReason,
} from "@agentclientprotocol/sdk";
import type { DreverStudioActionRecord } from "@drever/schema";
import { describe, expect, it, vi } from "vite-plus/test";
import { createAcpStudioAgentProvider, type LaunchAcpAgent } from "./acp-studio-agent-provider.ts";

const actionRecord = (
  revision = 1,
  type: "approve-plan" | "submit-common-brief" = "submit-common-brief",
): DreverStudioActionRecord =>
  Object.freeze({
    version: 1,
    revision,
    receivedAt: "2026-08-04T12:00:00.000Z",
    action:
      type === "approve-plan"
        ? Object.freeze({
            version: 1,
            type,
            requestId: `approve-${String(revision)}`,
            expectedRevision: revision - 1,
          })
        : Object.freeze({
            version: 1,
            type,
            requestId: `request-${String(revision)}`,
            expectedRevision: revision - 1,
            brief: Object.freeze({ topic: "Why black holes are not cosmic vacuum cleaners" }),
          }),
  });

const waitFor = async (condition: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (condition()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Timed out waiting for the fake ACP agent.");
};

const fakeProcess = (
  createAgent: (setConnection: (connection: AgentConnection) => void) => ReturnType<typeof agent>,
) => {
  const clientToAgent = new PassThrough();
  const agentToClient = new PassThrough();
  let agentConnection: AgentConnection | undefined;
  let resolveClosed: (
    exit: Readonly<{ code: number | null; signal: NodeJS.Signals | null }>,
  ) => void = () => undefined;
  const closed = new Promise<Readonly<{ code: number | null; signal: NodeJS.Signals | null }>>(
    (resolve) => {
      resolveClosed = resolve;
    },
  );
  const app = createAgent((connection) => {
    agentConnection = connection;
  });
  const connection = app.connect(
    ndJsonStream(
      Writable.toWeb(agentToClient) as WritableStream<Uint8Array>,
      Readable.toWeb(clientToAgent) as ReadableStream<Uint8Array>,
    ),
  );
  agentConnection = connection;

  return Object.freeze({
    input: clientToAgent,
    output: agentToClient,
    closed,
    async stop() {
      agentConnection?.close();
      clientToAgent.end();
      agentToClient.end();
      resolveClosed(Object.freeze({ code: 0, signal: null }));
    },
  });
};

const createTestAcpStudioAgentProvider = (
  options: Parameters<typeof createAcpStudioAgentProvider>[0],
) =>
  createAcpStudioAgentProvider({
    verifyActionHandled: async () => true,
    ...options,
  });

describe("ACP Studio agent provider", () => {
  it("delivers the preview-first approve-plan contract over ACP", async () => {
    const prompts: PromptRequest[] = [];
    const launch: LaunchAcpAgent = () =>
      fakeProcess(() =>
        agent({ name: "fake-agent" })
          .onRequest(methods.agent.initialize, () => ({
            protocolVersion: PROTOCOL_VERSION,
            agentCapabilities: {},
          }))
          .onRequest(methods.agent.session.new, () => ({ sessionId: "session-1" }))
          .onRequest(methods.agent.session.prompt, (request) => {
            prompts.push(request.params);
            return { stopReason: "end_turn" };
          }),
      );
    const provider = createTestAcpStudioAgentProvider({
      agent: "cline",
      cwd: "/project",
      launch,
    });

    await provider.handleAction(actionRecord(2, "approve-plan"));
    const prompt = JSON.stringify(prompts[0]);
    expect(prompt).toContain("bounded, semantic, content-complete Draft 1");
    expect(prompt).toContain("preserve the exact approved or configured canvas");
    expect(prompt).toContain("embedded preview iframe");
    expect(prompt).toContain("do not start or restart another development server");
    expect(prompt).toContain("invoke Playwright");
    expect(prompt).toContain("isolated rendered review only after");
    expect(prompt).toContain("user-owned session resources");
    expect(prompt).toContain("never use broad process cleanup");
    expect(prompt).toContain("isolated ephemeral loopback preview");
    expect(provider.snapshot()).toMatchObject({
      connected: true,
      state: { handledActionRevision: 2, phase: "waiting-for-agent" },
    });
    await provider.stop();
  });

  it("runs a verified command, streams safe activity, and maps browser approval", async () => {
    const launches: Array<{ command: string; args: readonly string[]; cwd: string }> = [];
    const prompts: PromptRequest[] = [];
    let permissionOption: PermissionOptionId | undefined;
    const launch: LaunchAcpAgent = (command, cwd) => {
      launches.push({ command: command.command, args: command.args, cwd });
      return fakeProcess(() =>
        agent({ name: "fake-agent" })
          .onRequest(methods.agent.initialize, () => ({
            protocolVersion: PROTOCOL_VERSION,
            agentCapabilities: { sessionCapabilities: { close: {} } },
            agentInfo: { name: "fake-agent", title: "Fake Agent", version: "1.0.0" },
          }))
          .onRequest(methods.agent.session.new, () => ({ sessionId: "session-1" }))
          .onRequest(methods.agent.session.prompt, async ({ client, params }) => {
            prompts.push(params);
            await client.notify(methods.client.session.update, {
              sessionId: params.sessionId,
              update: {
                sessionUpdate: "agent_message_chunk",
                messageId: "message-1",
                content: { type: "text", text: "Choosing the strongest story arc" },
              },
            });
            await client.notify(methods.client.session.update, {
              sessionId: params.sessionId,
              update: {
                sessionUpdate: "agent_thought_chunk",
                content: { type: "text", text: "private chain of thought" },
              },
            });
            await client.notify(methods.client.session.update, {
              sessionId: params.sessionId,
              update: {
                sessionUpdate: "plan",
                entries: [
                  { content: "Understand the audience", priority: "high", status: "completed" },
                  { content: "Shape the visual story", priority: "high", status: "in_progress" },
                  { content: "Polish the deck", priority: "medium", status: "pending" },
                  { content: "   ", priority: "low", status: "completed" },
                ],
              },
            });
            await client.notify(methods.client.session.update, {
              sessionId: params.sessionId,
              update: {
                sessionUpdate: "tool_call",
                toolCallId: "tool-1",
                title: "Write /private/project/brief.md with a hidden command",
                kind: "edit",
                status: "pending",
                rawInput: { command: "hidden-command --token secret" },
                locations: [{ path: "/private/project/brief.md" }],
              },
            });
            const permission = await client.request(methods.client.session.requestPermission, {
              sessionId: params.sessionId,
              toolCall: {
                toolCallId: "tool-1",
                title: "Write /private/project/brief.md with a hidden command",
                kind: "edit",
                status: "pending",
                rawInput: { command: "hidden-command --token secret" },
                locations: [{ path: "/private/project/brief.md" }],
              },
              options: [
                { optionId: "once", name: "Allow hidden-command once", kind: "allow_once" },
                { optionId: "session", name: "Always allow hidden-command", kind: "allow_always" },
                { optionId: "reject", name: "Reject", kind: "reject_once" },
              ],
            });
            if (permission.outcome.outcome === "selected") {
              permissionOption = permission.outcome.optionId;
            }
            await client.notify(methods.client.session.update, {
              sessionId: params.sessionId,
              update: {
                sessionUpdate: "tool_call_update",
                toolCallId: "tool-1",
                status: "completed",
              },
            });
            return { stopReason: "end_turn" };
          })
          .onRequest(methods.agent.session.close, () => ({})),
      );
    };
    const provider = createTestAcpStudioAgentProvider({
      agent: "gemini",
      cwd: "/project",
      launch,
    });

    await provider.start();
    expect(provider.snapshot()).toMatchObject({ connected: true, sessionId: "session-1" });
    expect(provider.capabilities()).toMatchObject({
      loadSession: false,
      closeSession: true,
      protocolVersion: 1,
    });
    expect(launches).toEqual([{ command: "gemini", args: ["--acp"], cwd: "/project" }]);

    const action = provider.handleAction(actionRecord());
    await waitFor(() => provider.approvals().length === 1);
    expect(provider.approvals()).toEqual([
      {
        decisions: ["accept", "acceptForSession", "decline", "cancel"],
        id: expect.anything(),
        kind: "file-change",
        itemId: "acp-item-tool-1",
        reason: "Allow the agent to update project files?",
        detail: "Write brief.md with a hidden command · brief.md",
      },
    ]);
    const activeActivities = provider
      .snapshot()
      .state?.activity?.filter(({ status }) => status === "active");
    expect(provider.snapshot().state?.phase).toBe("waiting-for-agent");
    expect(activeActivities).toHaveLength(1);
    expect(JSON.stringify(provider.snapshot())).not.toContain("Polish the deck");
    await provider.respondToApproval(provider.approvals()[0]!.id, "acceptForSession");
    await action;

    expect(permissionOption).toBe("session");
    expect(prompts[0]?.prompt[0]).toMatchObject({ type: "text" });
    expect(JSON.stringify(prompts[0])).toContain("submit-common-brief");
    expect(JSON.stringify(prompts[0])).toContain("AGENTS.md");
    expect(JSON.stringify(prompts[0])).toContain(".agents/skills/drever-create-deck/SKILL.md");
    expect(JSON.stringify(prompts[0])).toContain(".claude/skills/drever-create-deck/SKILL.md");
    const snapshot = provider.snapshot();
    expect(snapshot.state).toMatchObject({ handledActionRevision: 1 });
    expect(JSON.stringify(snapshot)).toContain("Choosing the strongest story arc");
    expect(JSON.stringify(snapshot)).toContain("Updating the presentation");
    expect(
      snapshot.state?.activity?.every(({ id, label }) => id.length > 0 && label.length > 0),
    ).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain("private chain of thought");
    expect(JSON.stringify(snapshot)).not.toContain("hidden-command");
    expect(JSON.stringify(snapshot)).not.toContain("/private/project");
    expect(JSON.stringify(snapshot)).not.toContain("secret");

    await provider.stop();
    expect(provider.snapshot().connected).toBe(false);
  });

  it.each<Readonly<{ completes: boolean; stopReason: StopReason }>>([
    { completes: true, stopReason: "end_turn" },
    { completes: false, stopReason: "cancelled" },
    { completes: false, stopReason: "refusal" },
    { completes: false, stopReason: "max_tokens" },
    { completes: false, stopReason: "max_turn_requests" },
  ])("handles ACP stop reason $stopReason truthfully", async ({ completes, stopReason }) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const launch: LaunchAcpAgent = () =>
      fakeProcess(() =>
        agent({ name: "fake-agent" })
          .onRequest(methods.agent.initialize, () => ({
            protocolVersion: PROTOCOL_VERSION,
            agentCapabilities: {},
          }))
          .onRequest(methods.agent.session.new, () => ({ sessionId: "session-1" }))
          .onRequest(methods.agent.session.prompt, () => ({ stopReason })),
      );
    const provider = createTestAcpStudioAgentProvider({ agent: "cline", cwd: "/project", launch });

    try {
      await provider.start();
      const action = provider.handleAction(actionRecord());
      if (completes) {
        await expect(action).resolves.toBeUndefined();
        expect(provider.snapshot().state).toMatchObject({ handledActionRevision: 1 });
        expect(provider.snapshot().state?.phase).not.toBe("error");
        expect(log).not.toHaveBeenCalled();
      } else {
        await expect(action).rejects.toThrow(`ACP turn stopped with ${stopReason}.`);
        expect(provider.snapshot().state).toMatchObject({
          phase: "error",
          message: "The local agent could not complete this step. Check the terminal for details.",
        });
        expect(provider.snapshot().connected).toBe(true);
        expect(provider.snapshot().state).not.toHaveProperty("handledActionRevision");
        expect(log).toHaveBeenCalled();
      }
      await provider.stop();
    } finally {
      log.mockRestore();
    }
  });

  it("keeps a healthy ACP session available after an incomplete turn", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let turn = 0;
    const launch: LaunchAcpAgent = () =>
      fakeProcess(() =>
        agent({ name: "fake-agent" })
          .onRequest(methods.agent.initialize, () => ({
            protocolVersion: PROTOCOL_VERSION,
            agentCapabilities: {},
          }))
          .onRequest(methods.agent.session.new, () => ({ sessionId: "session-1" }))
          .onRequest(methods.agent.session.prompt, () => ({
            stopReason: turn++ === 0 ? "cancelled" : "end_turn",
          })),
      );
    const provider = createTestAcpStudioAgentProvider({ agent: "gemini", cwd: "/project", launch });

    try {
      await provider.start();
      await expect(provider.handleAction(actionRecord())).rejects.toThrow(
        "ACP turn stopped with cancelled.",
      );
      expect(provider.snapshot()).toMatchObject({ connected: true, sessionId: "session-1" });

      await expect(provider.handleAction(actionRecord())).resolves.toBeUndefined();
      expect(provider.snapshot()).toMatchObject({
        connected: true,
        state: { handledActionRevision: 1 },
      });
      await provider.stop();
    } finally {
      log.mockRestore();
    }
  });

  it("completes only after a validated publication covers the action revision", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const verifyActionHandled = vi
      .fn(async () => true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const launch: LaunchAcpAgent = () =>
      fakeProcess(() =>
        agent({ name: "fake-agent" })
          .onRequest(methods.agent.initialize, () => ({
            protocolVersion: PROTOCOL_VERSION,
            agentCapabilities: {},
          }))
          .onRequest(methods.agent.session.new, () => ({ sessionId: "session-1" }))
          .onRequest(methods.agent.session.prompt, () => ({ stopReason: "end_turn" })),
      );
    const provider = createTestAcpStudioAgentProvider({
      agent: "opencode",
      cwd: "/project",
      launch,
      verifyActionHandled,
    });
    const record = actionRecord(1);

    try {
      await provider.start();
      await expect(provider.handleAction(record)).rejects.toThrow(
        "completed without publishing the handled Studio action",
      );
      expect(provider.snapshot()).toMatchObject({
        connected: true,
        state: { phase: "error" },
      });
      expect(provider.snapshot().state).not.toHaveProperty("handledActionRevision");

      await expect(provider.handleAction(record)).resolves.toBeUndefined();
      expect(provider.snapshot()).toMatchObject({
        connected: true,
        state: { handledActionRevision: 1 },
      });
      expect(verifyActionHandled).toHaveBeenNthCalledWith(1, record);
      expect(verifyActionHandled).toHaveBeenNthCalledWith(2, record);
      await provider.stop();
    } finally {
      log.mockRestore();
    }
  });

  it("preserves message chunk boundaries and resets accumulation between turns", async () => {
    let turn = 0;
    const launch: LaunchAcpAgent = () =>
      fakeProcess(() =>
        agent({ name: "fake-agent" })
          .onRequest(methods.agent.initialize, () => ({
            protocolVersion: PROTOCOL_VERSION,
            agentCapabilities: {},
          }))
          .onRequest(methods.agent.session.new, () => ({ sessionId: "session-1" }))
          .onRequest(methods.agent.session.prompt, async ({ client, params }) => {
            const chunks =
              turn++ === 0 ? ["Building", " ", "the sto", "ry"] : ["Refining ", "the", " deck"];
            for (const text of chunks) {
              await client.notify(methods.client.session.update, {
                sessionId: params.sessionId,
                update: {
                  sessionUpdate: "agent_message_chunk",
                  messageId: "reused-message-id",
                  content: { type: "text", text },
                },
              });
            }
            return { stopReason: "end_turn" };
          }),
      );
    const provider = createTestAcpStudioAgentProvider({ agent: "cursor", cwd: "/project", launch });

    await provider.start();
    await provider.handleAction(actionRecord(1));
    expect(provider.snapshot().state?.message).toBe("Building the story");

    await provider.handleAction(actionRecord(2));
    expect(provider.snapshot().state?.message).toBe("Refining the deck");
    expect(provider.snapshot().state?.message).not.toContain("Building");
    await provider.stop();
  });

  it("never downgrades a session approval to an allow-once option", async () => {
    let permissionOption: PermissionOptionId | undefined;
    const launch: LaunchAcpAgent = () =>
      fakeProcess(() =>
        agent({ name: "fake-agent" })
          .onRequest(methods.agent.initialize, () => ({
            protocolVersion: PROTOCOL_VERSION,
            agentCapabilities: {},
          }))
          .onRequest(methods.agent.session.new, () => ({ sessionId: "session-1" }))
          .onRequest(methods.agent.session.prompt, async ({ client, params }) => {
            const permission = await client.request(methods.client.session.requestPermission, {
              sessionId: params.sessionId,
              toolCall: {
                toolCallId: "tool-1",
                title: "Run a private command",
                kind: "execute",
              },
              options: [
                { optionId: "once", name: "Allow once", kind: "allow_once" },
                { optionId: "reject", name: "Reject", kind: "reject_once" },
              ],
            });
            if (permission.outcome.outcome === "selected") {
              permissionOption = permission.outcome.optionId;
            }
            return { stopReason: "end_turn" };
          }),
      );
    const provider = createTestAcpStudioAgentProvider({ agent: "cline", cwd: "/project", launch });

    await provider.start();
    const action = provider.handleAction(actionRecord());
    await waitFor(() => provider.approvals().length === 1);
    const [approval] = provider.approvals();
    expect(approval?.decisions).toEqual(["accept", "decline", "cancel"]);
    await expect(provider.respondToApproval(approval!.id, "acceptForSession")).rejects.toThrow(
      "does not support acceptForSession",
    );
    expect(provider.approvals()).toHaveLength(1);

    await provider.respondToApproval(approval!.id, "accept");
    await action;
    expect(permissionOption).toBe("once");
    await provider.stop();
  });

  it("assigns monotonic public IDs to overlapping approval requests", async () => {
    const launch: LaunchAcpAgent = () =>
      fakeProcess(() =>
        agent({ name: "fake-agent" })
          .onRequest(methods.agent.initialize, () => ({
            protocolVersion: PROTOCOL_VERSION,
            agentCapabilities: {},
          }))
          .onRequest(methods.agent.session.new, () => ({ sessionId: "session-1" }))
          .onRequest(methods.agent.session.prompt, async ({ client, params }) => {
            await Promise.all([
              client.request(methods.client.session.requestPermission, {
                sessionId: params.sessionId,
                toolCall: { toolCallId: "tool-1", title: "Update the title", kind: "edit" },
                options: [{ optionId: "once-1", name: "Allow once", kind: "allow_once" }],
              }),
              client.request(methods.client.session.requestPermission, {
                sessionId: params.sessionId,
                toolCall: { toolCallId: "tool-2", title: "Update the chart", kind: "edit" },
                options: [{ optionId: "once-2", name: "Allow once", kind: "allow_once" }],
              }),
            ]);
            return { stopReason: "end_turn" };
          }),
      );
    const provider = createTestAcpStudioAgentProvider({ agent: "cline", cwd: "/project", launch });

    await provider.start();
    const action = provider.handleAction(actionRecord());
    await waitFor(() => provider.approvals().length === 2);
    expect(provider.approvals().map(({ id }) => id)).toEqual([
      "acp-permission-1",
      "acp-permission-2",
    ]);
    await Promise.all(
      provider.approvals().map(({ id }) => provider.respondToApproval(id, "accept")),
    );
    await action;
    await provider.stop();
  });

  it("bounds startup and can start cleanly after a timed-out handshake", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let launches = 0;
    let stops = 0;
    const launch: LaunchAcpAgent = () => {
      launches += 1;
      const process = fakeProcess(() => {
        const app = agent({ name: "fake-agent" }).onRequest(
          methods.agent.initialize,
          launches === 1
            ? () => new Promise<never>(() => undefined)
            : () => ({ protocolVersion: PROTOCOL_VERSION, agentCapabilities: {} }),
        );
        return app.onRequest(methods.agent.session.new, () => ({
          sessionId: `session-${String(launches)}`,
        }));
      });
      return Object.freeze({
        ...process,
        async stop() {
          stops += 1;
          await process.stop();
        },
      });
    };
    const provider = createTestAcpStudioAgentProvider({
      agent: "gemini",
      cwd: "/project",
      launch,
      shutdownTimeoutMs: 20,
      startupTimeoutMs: 10,
    });

    try {
      await expect(provider.start()).rejects.toThrow("did not connect in time");
      expect(provider.snapshot().connected).toBe(false);
      expect(stops).toBe(1);

      await expect(provider.start()).resolves.toBeUndefined();
      expect(provider.snapshot()).toMatchObject({ connected: true, sessionId: "session-2" });
      expect(launches).toBe(2);
      await provider.stop();
    } finally {
      log.mockRestore();
    }
  });

  it("cancels a timed-out turn, restarts, and replays only the unacknowledged action", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const verifyActionHandled = vi
      .fn(async () => true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    let launches = 0;
    let prompts = 0;
    let cancellations = 0;
    const launch: LaunchAcpAgent = () => {
      launches += 1;
      const launchNumber = launches;
      return fakeProcess(() =>
        agent({ name: "fake-agent" })
          .onRequest(methods.agent.initialize, () => ({
            protocolVersion: PROTOCOL_VERSION,
            agentCapabilities: {},
          }))
          .onRequest(methods.agent.session.new, () => ({
            sessionId: `session-${String(launchNumber)}`,
          }))
          .onNotification(methods.agent.session.cancel, () => {
            cancellations += 1;
          })
          .onRequest(methods.agent.session.prompt, () => {
            prompts += 1;
            return launchNumber === 1
              ? new Promise<never>(() => undefined)
              : { stopReason: "end_turn" as const };
          }),
      );
    };
    const provider = createTestAcpStudioAgentProvider({
      agent: "opencode",
      cwd: "/project",
      launch,
      shutdownTimeoutMs: 20,
      turnTimeoutMs: 10,
      verifyActionHandled,
    });
    const record = actionRecord();

    try {
      await provider.start();
      await expect(provider.handleAction(record)).resolves.toBeUndefined();
      expect({ cancellations, launches, prompts }).toEqual({
        cancellations: 1,
        launches: 2,
        prompts: 2,
      });
      expect(provider.snapshot()).toMatchObject({
        connected: true,
        sessionId: "session-2",
        state: { handledActionRevision: 1 },
      });
      expect(verifyActionHandled).toHaveBeenNthCalledWith(1, record);
      expect(verifyActionHandled).toHaveBeenNthCalledWith(2, record);
      await provider.stop();
    } finally {
      log.mockRestore();
    }
  });

  it("keeps raw provider errors in server logs while publishing a generic browser error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let rejectClosed: (error: Error) => void = () => undefined;
    const launch: LaunchAcpAgent = () => {
      const process = fakeProcess(() =>
        agent({ name: "fake-agent" })
          .onRequest(methods.agent.initialize, () => ({
            protocolVersion: PROTOCOL_VERSION,
            agentCapabilities: {},
          }))
          .onRequest(methods.agent.session.new, () => ({ sessionId: "session-1" })),
      );
      const closed = new Promise<never>((_resolve, reject) => {
        rejectClosed = reject;
      });
      return Object.freeze({ ...process, closed });
    };
    const provider = createTestAcpStudioAgentProvider({
      agent: "opencode",
      cwd: "/project",
      launch,
    });

    try {
      await provider.start();
      rejectClosed(new Error("private /project/path and command --secret"));
      await waitFor(() => provider.snapshot().state?.phase === "error");
      expect(provider.snapshot().state).toMatchObject({
        phase: "error",
        message: "The local agent could not complete this step. Check the terminal for details.",
      });
      expect(JSON.stringify(provider.snapshot())).not.toContain("/project/path");
      expect(log).toHaveBeenCalledWith(
        "[drever] OpenCode failed:",
        expect.objectContaining({ message: expect.stringContaining("private /project/path") }),
      );
      await provider.stop();
    } finally {
      log.mockRestore();
    }
  });

  it("bounds shutdown when an ACP process does not exit", async () => {
    const launch: LaunchAcpAgent = () => {
      const process = fakeProcess(() =>
        agent({ name: "fake-agent" })
          .onRequest(methods.agent.initialize, () => ({
            protocolVersion: PROTOCOL_VERSION,
            agentCapabilities: {},
          }))
          .onRequest(methods.agent.session.new, () => ({ sessionId: "session-1" })),
      );
      return Object.freeze({
        ...process,
        stop: () => new Promise<void>(() => undefined),
      });
    };
    const provider = createTestAcpStudioAgentProvider({
      agent: "cursor",
      cwd: "/project",
      launch,
      shutdownTimeoutMs: 5,
    });

    await provider.start();
    await provider.stop();
    expect(provider.snapshot().connected).toBe(false);
  });

  it("loads an existing session only when the agent advertises support", async () => {
    let loadedSession: string | undefined;
    const launch: LaunchAcpAgent = () =>
      fakeProcess(() =>
        agent({ name: "fake-agent" })
          .onRequest(methods.agent.initialize, () => ({
            protocolVersion: PROTOCOL_VERSION,
            agentCapabilities: { loadSession: true },
          }))
          .onRequest(methods.agent.session.load, ({ params }) => {
            loadedSession = params.sessionId;
            return {};
          }),
      );
    const provider = createTestAcpStudioAgentProvider({
      agent: "cline",
      cwd: "/project",
      launch,
      sessionId: "saved-session",
    });

    await provider.start();
    expect(loadedSession).toBe("saved-session");
    expect(provider.snapshot()).toMatchObject({ connected: true, sessionId: "saved-session" });
    await provider.stop();
  });
});

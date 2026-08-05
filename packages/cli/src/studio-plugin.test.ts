import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { ViteDevServer, WebSocketClient } from "vite";
import type { StudioAgentProvider } from "./studio-agent-provider.ts";
import {
  DREVER_STUDIO_ACTION_EVENT,
  DREVER_STUDIO_ACTIONS_DIRECTORY,
  DREVER_STUDIO_AGENT_CONNECTION_TTL_MS,
  DREVER_STUDIO_AGENT_HEARTBEAT_FILE,
  DREVER_STUDIO_AGENT_STATE_FILE,
  DREVER_STUDIO_DIRECTORY,
  DREVER_STUDIO_STATE_EVENT,
  DREVER_STUDIO_STATE_REQUEST_EVENT,
  createStudioPlugin,
  createStudioSession,
  decodeStudioAction,
  decodeStudioAgentState,
  forwardStudioAgentActions,
  isLoopbackAddress,
  resolveStudioUrls,
  writeStudioAgentActivity,
  writeStudioAgentState,
  writeStudioAgentHeartbeat,
} from "./studio-plugin.ts";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

const createRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "drever-studio-"));
  directories.push(root);
  return root;
};

const writeBriefActions = async (root: string, count: number): Promise<void> => {
  const token = "studio-action-test-token";
  const session = createStudioSession(root, { token });
  for (let revision = 1; revision <= count; revision += 1) {
    const result = await session.accept(
      {
        token,
        action: {
          version: 1,
          requestId: `request-${String(revision)}`,
          expectedRevision: revision - 1,
          type: "submit-common-brief",
          brief: { topic: `Topic ${String(revision)}` },
        },
      },
      true,
    );
    if (!result.accepted) throw new Error(`Could not persist Studio action ${String(revision)}.`);
  }
};

const forwardingProvider = (handledActionRevision?: number) => {
  const handleAction = vi.fn<StudioAgentProvider["handleAction"]>(async () => undefined);
  return {
    handleAction,
    provider: {
      approvals: () => [],
      handleAction,
      respondToApproval: vi.fn(async () => undefined),
      snapshot: () => ({
        connected: true,
        state: {
          version: 1 as const,
          phase: "waiting-for-agent" as const,
          ...(handledActionRevision === undefined ? {} : { handledActionRevision }),
        },
      }),
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      subscribe: () => () => undefined,
    },
  };
};

const action = (value: Readonly<Record<string, unknown>>) => ({
  version: 1,
  requestId: "request-1",
  expectedRevision: 0,
  ...value,
});

const studioClient = (
  send: ReturnType<typeof vi.fn>,
  remoteAddress = "127.0.0.1",
): WebSocketClient =>
  ({
    send,
    socket: { _socket: { remoteAddress }, once: vi.fn() },
  }) as unknown as WebSocketClient;

const plan = {
  version: 1,
  status: "awaiting-approval",
  brief: {
    topic: "Why black holes are not cosmic vacuum cleaners",
    audience: "Curious high-school students",
    desiredChange: "Replace a familiar myth with a useful mental model",
    durationMinutes: 12,
    language: "en",
    density: "concise",
  },
  slides: [
    {
      id: "the-myth",
      job: "opening",
      title: "A black hole is not a vacuum cleaner",
      purpose: "Name the misconception before replacing it.",
      evidence: ["Gravity depends on mass and distance."],
      focalArtifact: "A Sun-to-black-hole orbit comparison",
      composition: { recipe: "comparison" },
      density: "concise",
    },
  ],
} as const;

describe("Drever Studio action validation", () => {
  it("accepts the six bounded browser action shapes and rejects unknown fields", () => {
    expect(
      decodeStudioAction(
        action({
          type: "submit-common-brief",
          brief: {
            topic: "A useful topic",
            density: "balanced",
            motionIntensity: "measured",
          },
        }),
      ),
    ).toBeDefined();
    expect(
      decodeStudioAction(
        action({
          type: "submit-adaptive-answers",
          answers: [{ questionId: "proof", optionIds: ["demo"], text: "Use real data." }],
        }),
      ),
    ).toBeDefined();
    expect(decodeStudioAction(action({ type: "skip-remaining-questions" }))).toBeDefined();
    expect(decodeStudioAction(action({ type: "approve-plan" }))).toBeDefined();
    expect(
      decodeStudioAction(
        action({
          type: "respond-agent-approval",
          approvalId: "number:42",
          decision: "acceptForSession",
        }),
      ),
    ).toBeDefined();
    expect(
      decodeStudioAction(
        action({
          type: "submit-feedback",
          scope: { kind: "slide", slideId: "the-myth" },
          message: "Make the comparison clearer.",
        }),
      ),
    ).toBeDefined();
    expect(
      decodeStudioAction(action({ type: "approve-plan", arbitraryPath: "../../slides.mdx" })),
    ).toBeUndefined();
    expect(
      decodeStudioAction(
        action({
          type: "respond-agent-approval",
          approvalId: "number:42",
          decision: "always",
        }),
      ),
    ).toBeUndefined();
  });

  it("accepts a bounded activity timeline and rejects ambiguous active work", () => {
    expect(
      decodeStudioAgentState({
        version: 1,
        phase: "drafting",
        activity: [
          { id: "outline-ready", label: "Story approved", status: "complete" },
          {
            id: "drafting-preview",
            label: "Building the first preview",
            detail: "Writing the complete draft before visual refinement.",
            status: "active",
          },
        ],
      }),
    ).toBeDefined();
    expect(
      decodeStudioAgentState({
        version: 1,
        phase: "drafting",
        activity: [
          { id: "writing", label: "Writing", status: "active" },
          { id: "checking", label: "Checking", status: "active" },
        ],
      }),
    ).toBeUndefined();
    expect(
      decodeStudioAgentState({
        version: 1,
        phase: "drafting",
        activity: [{ id: "private-reasoning", label: "Thinking", status: "streaming" }],
      }),
    ).toBeUndefined();
  });
});

describe("Studio session", () => {
  it.each(["drafting", "refining", "error"] as const)(
    "keeps live %s state ahead of pending work and an approved-plan preview fallback",
    async (phase) => {
      const root = await createRoot();
      await writeFile(
        join(root, "drever.plan.json"),
        JSON.stringify({ ...plan, status: "approved" }),
        "utf8",
      );
      const session = createStudioSession(root, {
        token: "studio-token",
        agentProvider: {
          snapshot: () => ({
            connected: phase !== "error",
            state: { version: 1, phase },
          }),
        },
      });

      await session.accept(
        {
          token: "studio-token",
          action: action({ type: "submit-common-brief", brief: { topic: "A useful topic" } }),
        },
        true,
      );

      await expect(session.read()).resolves.toMatchObject({ pendingActionCount: 1, phase });
    },
  );

  it("keeps the common brief visible before a connected provider advances the flow", async () => {
    const root = await createRoot();
    const session = createStudioSession(root, {
      agentProvider: {
        snapshot: () => ({
          connected: true,
          state: { version: 1, phase: "waiting-for-agent" },
        }),
      },
    });

    await expect(session.read()).resolves.toMatchObject({ phase: "briefing" });
  });

  it("uses a disconnected live provider error instead of a stale file heartbeat and message", async () => {
    const root = await createRoot();
    await writeStudioAgentState(root, {
      version: 1,
      phase: "drafting",
      message: "Stale file progress",
    });
    await writeStudioAgentHeartbeat(root, new Date());
    const session = createStudioSession(root, {
      agentProvider: {
        snapshot: () => ({
          connected: false,
          state: { version: 1, phase: "error", message: "The managed agent stopped." },
        }),
      },
    });

    await expect(session.read()).resolves.toMatchObject({
      agentConnected: false,
      message: "The managed agent stopped.",
      phase: "error",
    });
  });

  it("does not treat plan approval alone as proof that a live draft exists", async () => {
    const root = await createRoot();
    await writeFile(
      join(root, "drever.plan.json"),
      JSON.stringify({ ...plan, status: "approved" }),
      "utf8",
    );

    await expect(createStudioSession(root).read()).resolves.toMatchObject({
      phase: "waiting-for-agent",
      plan: { status: "approved" },
    });
  });

  it.each(["preview", "ready"] as const)(
    "keeps a durable %s publication visible after a managed agent turn becomes idle",
    async (phase) => {
      const root = await createRoot();
      await writeBriefActions(root, 1);
      await writeFile(
        join(root, "drever.plan.json"),
        JSON.stringify({ ...plan, status: "approved" }),
        "utf8",
      );
      await writeStudioAgentState(root, {
        version: 1,
        phase,
        handledActionRevision: 1,
      });
      const session = createStudioSession(root, {
        agentProvider: {
          snapshot: () => ({
            connected: true,
            state: { version: 1, phase: "waiting-for-agent", handledActionRevision: 1 },
          }),
        },
      });

      await expect(session.read()).resolves.toMatchObject({
        pendingActionCount: 0,
        phase,
        plan: { status: "approved" },
      });
    },
  );

  it.each([
    { label: "durable", durableRevision: 4, liveRevision: 0 },
    { label: "live", durableRevision: 0, liveRevision: 4 },
  ])(
    "does not advance pending work from a $label revision beyond the journal",
    async ({ durableRevision, liveRevision }) => {
      const root = await createRoot();
      await writeBriefActions(root, 3);
      await writeFile(
        join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_AGENT_STATE_FILE),
        JSON.stringify({
          version: 1,
          phase: "ready",
          handledActionRevision: durableRevision,
        }),
        "utf8",
      );
      const session = createStudioSession(root, {
        agentProvider: {
          snapshot: () => ({
            connected: true,
            state: {
              version: 1,
              phase: "waiting-for-agent",
              handledActionRevision: liveRevision,
            },
          }),
        },
      });

      await expect(session.read()).resolves.toMatchObject({
        latestActionRevision: 3,
        pendingActionCount: 3,
        phase: "waiting-for-agent",
      });
    },
  );

  it("discards structural state whose handled revision is ahead of an empty journal", async () => {
    const root = await createRoot();
    await mkdir(join(root, DREVER_STUDIO_DIRECTORY), { recursive: true });
    await writeFile(
      join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_AGENT_STATE_FILE),
      JSON.stringify({
        version: 1,
        phase: "ready",
        handledActionRevision: 4,
        message: "A stale preview is ready",
      }),
      "utf8",
    );

    await expect(createStudioSession(root).read()).resolves.toEqual({
      version: 1,
      revision: 0,
      phase: "briefing",
      agentConnected: false,
      latestActionRevision: 0,
      pendingActionCount: 0,
    });

    const liveSession = createStudioSession(await createRoot(), {
      agentProvider: {
        snapshot: () => ({
          connected: true,
          state: {
            version: 1,
            phase: "ready",
            handledActionRevision: 4,
            message: "A stale live preview is ready",
          },
        }),
      },
    });
    await expect(liveSession.read()).resolves.toEqual({
      version: 1,
      revision: 0,
      phase: "briefing",
      agentConnected: true,
      latestActionRevision: 0,
      pendingActionCount: 0,
    });
  });

  it("returns transient provider approvals without journaling them as deck work", async () => {
    const root = await createRoot();
    let approvals = [
      {
        decisions: ["accept" as const],
        id: 42,
        itemId: "command-42",
        kind: "command" as const,
        reason: "Run the rendered check",
      },
    ];
    const respondToApproval = vi.fn(async () => {
      approvals = [];
    });
    const session = createStudioSession(root, {
      token: "studio-token",
      agentProvider: {
        approvals: () => approvals,
        respondToApproval,
        snapshot: () => ({
          connected: true,
          state: { version: 1, phase: "drafting" },
        }),
      },
    });

    const initialState = await session.read();
    expect(initialState).toMatchObject({
      agentApprovals: [
        {
          decisions: ["accept"],
          kind: "command",
          reason: "Run the rendered check",
        },
      ],
      revision: 0,
    });
    const approvalId = initialState.agentApprovals?.[0]?.id;
    expect(approvalId).toMatch(/^[\w-]{40,}$/u);
    if (approvalId === undefined) throw new TypeError("The provider approval is missing.");
    await expect(
      session.accept(
        {
          token: "studio-token",
          action: action({
            type: "respond-agent-approval",
            approvalId,
            decision: "acceptForSession",
          }),
        },
        true,
      ),
    ).resolves.toMatchObject({
      accepted: false,
      error: { code: "DREVER_STUDIO_AGENT_APPROVAL_UNSUPPORTED" },
    });
    const acceptedAction = action({
      type: "respond-agent-approval",
      approvalId,
      decision: "accept",
    });
    await expect(
      session.accept({ token: "studio-token", action: acceptedAction }, true),
    ).resolves.toMatchObject({ accepted: true, revision: 0 });
    await expect(
      session.accept(
        {
          token: "studio-token",
          action: { ...acceptedAction, decision: "decline" },
        },
        true,
      ),
    ).resolves.toMatchObject({
      accepted: false,
      error: { code: "DREVER_STUDIO_REQUEST_ID_REUSED" },
    });
    await expect(
      session.accept({ token: "studio-token", action: acceptedAction }, true),
    ).resolves.toMatchObject({ accepted: true, revision: 0 });
    expect(respondToApproval).toHaveBeenCalledWith(42, "accept");
    expect(respondToApproval).toHaveBeenCalledOnce();
    await expect(session.read()).resolves.not.toHaveProperty("agentApprovals");
  });

  it("maps long provider approval ids to unique opaque browser ids", async () => {
    const root = await createRoot();
    const firstId = `${"approval".repeat(40)}-first`;
    const secondId = `${"approval".repeat(40)}-second`;
    const approvals = [firstId, secondId].map((id) => ({
      decisions: ["accept" as const],
      id,
      itemId: id,
      kind: "command" as const,
    }));
    const respondToApproval = vi.fn(async () => undefined);
    const session = createStudioSession(root, {
      token: "studio-token",
      agentProvider: {
        approvals: () => approvals,
        respondToApproval,
        snapshot: () => ({ connected: true }),
      },
    });

    const publicApprovals = (await session.read()).agentApprovals;
    expect(publicApprovals).toHaveLength(2);
    expect(new Set(publicApprovals?.map(({ id }) => id)).size).toBe(2);
    expect(publicApprovals?.map(({ id }) => id)).not.toContain(firstId);
    const secondPublicId = publicApprovals?.[1]?.id;
    if (secondPublicId === undefined) throw new TypeError("The second approval is missing.");

    await session.accept(
      {
        token: "studio-token",
        action: action({
          type: "respond-agent-approval",
          approvalId: secondPublicId,
          decision: "accept",
        }),
      },
      true,
    );

    expect(respondToApproval).toHaveBeenCalledWith(secondId, "accept");
  });

  it("persists a local common brief as an atomic, sequential action record", async () => {
    const root = await createRoot();
    const session = createStudioSession(root, {
      token: "studio-token",
      now: () => new Date("2026-08-03T12:00:00.000Z"),
    });

    await expect(session.read()).resolves.toEqual({
      version: 1,
      revision: 0,
      phase: "briefing",
      agentConnected: false,
      latestActionRevision: 0,
      pendingActionCount: 0,
    });
    await expect(
      session.accept(
        {
          token: "studio-token",
          action: action({
            type: "submit-common-brief",
            brief: {
              topic: "Why black holes are not cosmic vacuum cleaners",
              audience: "High-school students",
              durationMinutes: 12,
              density: "concise",
              motionIntensity: "measured",
              language: "en",
            },
          }),
        },
        true,
      ),
    ).resolves.toEqual({ version: 1, requestId: "request-1", accepted: true, revision: 1 });

    await expect(session.read()).resolves.toMatchObject({
      revision: 1,
      phase: "waiting-for-agent",
      pendingActionCount: 1,
      commonBrief: { topic: "Why black holes are not cosmic vacuum cleaners" },
    });
    const record = JSON.parse(
      await readFile(
        join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_ACTIONS_DIRECTORY, "00000001.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    expect(record).toMatchObject({ revision: 1, receivedAt: "2026-08-03T12:00:00.000Z" });
    expect(record).not.toHaveProperty("path");
  });

  it("expires the local agent lease after its bounded heartbeat window", async () => {
    const root = await createRoot();
    let now = new Date("2026-08-03T12:00:00.000Z");
    const session = createStudioSession(root, { now: () => now });

    expect(await session.read()).toMatchObject({ agentConnected: false });
    await writeStudioAgentHeartbeat(root, now);
    expect(await session.refresh()).toMatchObject({
      changed: true,
      state: { agentConnected: true, revision: 0 },
    });

    now = new Date(now.getTime() + DREVER_STUDIO_AGENT_CONNECTION_TTL_MS - 1);
    expect(await session.refresh()).toMatchObject({
      changed: false,
      state: { agentConnected: true },
    });

    now = new Date(now.getTime() + 1);
    expect(await session.refresh()).toMatchObject({
      changed: true,
      state: { agentConnected: false, revision: 0 },
    });
    expect(
      JSON.parse(
        await readFile(
          join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_AGENT_HEARTBEAT_FILE),
          "utf8",
        ),
      ),
    ).toMatchObject({ version: 1, seenAt: "2026-08-03T12:00:00.000Z" });
  });

  it("renews an active lease without changing the browser revision", async () => {
    const root = await createRoot();
    let now = new Date("2026-08-03T12:00:00.000Z");
    const session = createStudioSession(root, { now: () => now });
    await writeStudioAgentHeartbeat(root, now);
    expect(await session.read()).toMatchObject({ agentConnected: true, revision: 0 });
    const firstExpiry = await session.agentLeaseExpiresAt();

    now = new Date(now.getTime() + 30_000);
    await writeStudioAgentHeartbeat(root, now);
    expect(await session.refresh()).toMatchObject({
      changed: false,
      state: { agentConnected: true, revision: 0 },
    });
    expect(await session.agentLeaseExpiresAt()).toBeGreaterThan(firstExpiry ?? 0);
  });

  it("fails closed for malformed or future heartbeat records", async () => {
    const root = await createRoot();
    const now = new Date("2026-08-03T12:00:00.000Z");
    const studioDirectory = join(root, DREVER_STUDIO_DIRECTORY);
    const heartbeatPath = join(studioDirectory, DREVER_STUDIO_AGENT_HEARTBEAT_FILE);
    await mkdir(studioDirectory, { recursive: true });
    await writeFile(heartbeatPath, "not json\n", "utf8");

    const malformed = createStudioSession(root, { now: () => now });
    await expect(malformed.read()).resolves.toMatchObject({ agentConnected: false });

    await writeStudioAgentHeartbeat(root, new Date(now.getTime() + 60_000));
    const future = createStudioSession(root, { now: () => now });
    await expect(future.read()).resolves.toMatchObject({ agentConnected: false });
  });

  it("rejects remote, unauthenticated, oversized, and stale mutations without writing files", async () => {
    const root = await createRoot();
    const session = createStudioSession(root, { token: "studio-token" });
    const briefAction = action({ type: "submit-common-brief", brief: { topic: "A topic" } });

    await expect(
      session.accept({ token: "studio-token", action: briefAction }, false),
    ).resolves.toMatchObject({
      accepted: false,
      error: { code: "DREVER_STUDIO_REMOTE_FORBIDDEN" },
    });
    await expect(
      session.accept({ token: "wrong", action: briefAction }, true),
    ).resolves.toMatchObject({
      accepted: false,
      error: { code: "DREVER_STUDIO_TOKEN_INVALID" },
    });
    await expect(
      session.accept(
        {
          token: "studio-token",
          action: action({
            type: "submit-feedback",
            scope: { kind: "deck" },
            message: "x".repeat(33 * 1024),
          }),
        },
        true,
      ),
    ).resolves.toMatchObject({
      accepted: false,
      error: { code: "DREVER_STUDIO_PAYLOAD_TOO_LARGE" },
    });
    await session.accept({ token: "studio-token", action: briefAction }, true);
    await expect(
      session.accept({ token: "studio-token", action: briefAction }, true),
    ).resolves.toMatchObject({
      accepted: true,
      revision: 1,
    });
    await expect(
      session.accept(
        {
          token: "studio-token",
          action: { ...briefAction, requestId: "request-2" },
        },
        true,
      ),
    ).resolves.toMatchObject({
      accepted: false,
      revision: 1,
      error: { code: "DREVER_STUDIO_ACTION_STALE" },
    });
  });

  it("merges agent questions, validates answers, and clears acknowledged actions", async () => {
    const root = await createRoot();
    const session = createStudioSession(root, { token: "studio-token" });
    await session.accept(
      {
        token: "studio-token",
        action: action({ type: "submit-common-brief", brief: { topic: "A topic" } }),
      },
      true,
    );
    const studioDirectory = join(root, DREVER_STUDIO_DIRECTORY);
    await mkdir(studioDirectory, { recursive: true });
    await writeFile(
      join(studioDirectory, DREVER_STUDIO_AGENT_STATE_FILE),
      `${JSON.stringify({
        version: 1,
        phase: "adaptive-questions",
        handledActionRevision: 1,
        adaptiveQuestions: [
          {
            id: "proof",
            prompt: "Which proof should anchor the explanation?",
            options: [
              { id: "demo", label: "Live demo", description: "Show the change directly." },
              { id: "data", label: "Measured data", description: "Lead with a reliable metric." },
            ],
          },
        ],
      })}\n`,
      "utf8",
    );

    const refreshed = await session.refresh();
    expect(refreshed).toMatchObject({
      changed: true,
      state: { revision: 2, phase: "adaptive-questions", pendingActionCount: 0 },
    });
    await expect(
      session.accept(
        {
          token: "studio-token",
          action: {
            ...action({
              type: "submit-adaptive-answers",
              answers: [{ questionId: "proof", optionIds: ["unknown"] }],
            }),
            expectedRevision: 2,
            requestId: "request-2",
          },
        },
        true,
      ),
    ).resolves.toMatchObject({
      accepted: false,
      error: { code: "DREVER_STUDIO_OPTION_UNKNOWN" },
    });
  });

  it("reconstructs a submitted brief after reload without trusting an older agent phase", async () => {
    const root = await createRoot();
    const session = createStudioSession(root, { token: "studio-token" });
    await session.accept(
      {
        token: "studio-token",
        action: action({
          type: "submit-common-brief",
          brief: { topic: "A durable topic", audience: "A durable audience" },
        }),
      },
      true,
    );
    const studioDirectory = join(root, DREVER_STUDIO_DIRECTORY);
    await writeFile(
      join(studioDirectory, DREVER_STUDIO_AGENT_STATE_FILE),
      `${JSON.stringify({
        version: 1,
        phase: "briefing",
        handledActionRevision: 1,
        message: "An older publication is still on disk.",
      })}\n`,
      "utf8",
    );

    const reloaded = createStudioSession(root);
    await expect(reloaded.read()).resolves.toMatchObject({
      phase: "waiting-for-agent",
      pendingActionCount: 0,
      commonBrief: { topic: "A durable topic", audience: "A durable audience" },
    });
  });

  it("replaces unfinished activity without claiming that interrupted work completed", async () => {
    const root = await createRoot();
    await writeStudioAgentState(root, {
      version: 1,
      phase: "drafting",
      activity: [
        { id: "sources", label: "Checking sources", status: "complete" },
        { id: "draft", label: "Building a draft", status: "active" },
      ],
    });

    await writeStudioAgentActivity(root, {
      id: "feedback",
      label: "Applying your feedback",
      status: "active",
    });

    await expect(createStudioSession(root).read()).resolves.toMatchObject({
      activity: [
        { id: "sources", status: "complete" },
        { id: "feedback", status: "active" },
      ],
    });
  });

  it("accepts approval and slide feedback only against the current persisted plan", async () => {
    const root = await createRoot();
    await writeFile(join(root, "drever.plan.json"), JSON.stringify(plan), "utf8");
    const session = createStudioSession(root, { token: "studio-token" });
    expect(await session.read()).toMatchObject({ phase: "plan-review", plan });

    await expect(
      session.accept({ token: "studio-token", action: action({ type: "approve-plan" }) }, true),
    ).resolves.toMatchObject({ accepted: true, revision: 1 });
    await expect(
      session.accept(
        {
          token: "studio-token",
          action: {
            ...action({
              type: "submit-feedback",
              scope: { kind: "slide", slideId: "missing" },
              message: "Change it.",
            }),
            expectedRevision: 1,
            requestId: "request-2",
          },
        },
        true,
      ),
    ).resolves.toMatchObject({
      accepted: false,
      error: { code: "DREVER_STUDIO_SLIDE_UNKNOWN" },
    });
  });

  it("rejects plan approval while earlier browser work is still pending", async () => {
    const root = await createRoot();
    await writeFile(join(root, "drever.plan.json"), JSON.stringify(plan), "utf8");
    const session = createStudioSession(root, { token: "studio-token" });
    await session.accept(
      {
        token: "studio-token",
        action: action({
          type: "submit-feedback",
          scope: { kind: "deck" },
          message: "Make the evidence more concrete.",
        }),
      },
      true,
    );

    await expect(
      session.accept(
        {
          token: "studio-token",
          action: {
            ...action({ type: "approve-plan" }),
            expectedRevision: 1,
            requestId: "request-2",
          },
        },
        true,
      ),
    ).resolves.toMatchObject({
      accepted: false,
      error: { code: "DREVER_STUDIO_PLAN_BUSY" },
    });
  });
});

describe("Studio action forwarding", () => {
  it("does not replay actions covered by validated durable agent state", async () => {
    const root = await createRoot();
    await writeBriefActions(root, 4);
    await writeStudioAgentState(root, {
      version: 1,
      phase: "ready",
      handledActionRevision: 4,
    });
    const { handleAction, provider } = forwardingProvider();

    await forwardStudioAgentActions(root, provider);

    expect(handleAction).not.toHaveBeenCalled();
  });

  it("forwards only records after the validated durable revision", async () => {
    const root = await createRoot();
    await writeBriefActions(root, 5);
    await writeStudioAgentState(root, {
      version: 1,
      phase: "drafting",
      handledActionRevision: 2,
    });
    const { handleAction, provider } = forwardingProvider();

    await forwardStudioAgentActions(root, provider);

    expect(handleAction.mock.calls.map(([record]) => record.revision)).toEqual([3, 4, 5]);
  });

  it.each([
    {
      label: "schema-invalid",
      state: { version: 1, phase: "ready", handledActionRevision: 3, unexpected: true },
    },
    {
      label: "ahead of the durable journal",
      state: { version: 1, phase: "ready", handledActionRevision: 4 },
    },
  ])("does not advance from $label agent state", async ({ state }) => {
    const root = await createRoot();
    await writeBriefActions(root, 3);
    await writeFile(
      join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_AGENT_STATE_FILE),
      JSON.stringify(state),
      "utf8",
    );
    const { handleAction, provider } = forwardingProvider();

    await forwardStudioAgentActions(root, provider);

    expect(handleAction.mock.calls.map(([record]) => record.revision)).toEqual([1, 2, 3]);
  });

  it("does not advance from a live revision beyond the durable journal", async () => {
    const root = await createRoot();
    await writeBriefActions(root, 3);
    const { handleAction, provider } = forwardingProvider(4);

    await forwardStudioAgentActions(root, provider);

    expect(handleAction.mock.calls.map(([record]) => record.revision)).toEqual([1, 2, 3]);
  });
});

describe("Studio Vite state", () => {
  it("accepts an authenticated action without publishing state or tokens through a module", async () => {
    const root = await createRoot();
    const token = "studio-test-token";
    const listeners = new Map<string, (payload: unknown, client: WebSocketClient) => void>();
    const send = vi.fn();
    let close: (() => void) | undefined;
    const plugin = createStudioPlugin({ root, token });
    const server = {
      config: { logger: { error: vi.fn() } },
      httpServer: {
        once(event: string, listener: () => void) {
          if (event === "close") close = listener;
        },
      },
      middlewares: { use: vi.fn() },
      moduleGraph: { getModuleById: vi.fn(), invalidateModule: vi.fn() },
      watcher: { add: vi.fn(), off: vi.fn(), on: vi.fn() },
      ws: {
        on(event: string, listener: (payload: unknown, client: WebSocketClient) => void) {
          listeners.set(event, listener);
        },
        send,
      },
    } as unknown as ViteDevServer;
    const configureServer = plugin.configureServer;
    if (typeof configureServer !== "function") {
      throw new TypeError("The Studio plugin is missing its server hook.");
    }
    await configureServer.call({} as never, server);
    expect(plugin.resolveId).toBeUndefined();
    expect(plugin.load).toBeUndefined();
    const receiveAction = listeners.get(DREVER_STUDIO_ACTION_EVENT);
    if (receiveAction === undefined) {
      throw new TypeError("The Studio plugin did not register its action listener.");
    }
    const clientSend = vi.fn();
    const client = studioClient(clientSend);

    receiveAction(
      {
        token,
        action: action({ type: "submit-common-brief", brief: { topic: "A durable topic" } }),
      },
      client,
    );

    await vi.waitFor(() => {
      expect(clientSend).toHaveBeenCalledWith({
        type: "custom",
        event: DREVER_STUDIO_STATE_EVENT,
        data: expect.objectContaining({
          phase: "waiting-for-agent",
          commonBrief: { topic: "A durable topic" },
        }),
      });
    });
    expect(send).not.toHaveBeenCalled();
    close?.();
  });

  it("polls while the creation room is open when file watching misses an atomic publication", async () => {
    const root = await createRoot();
    const token = "studio-test-token";
    const listeners = new Map<string, (payload: unknown, client: WebSocketClient) => void>();
    const send = vi.fn();
    let close: (() => void) | undefined;
    const plugin = createStudioPlugin({ root, token });
    const server = {
      config: { logger: { error: vi.fn() } },
      httpServer: {
        once(event: string, listener: () => void) {
          if (event === "close") close = listener;
        },
      },
      middlewares: { use: vi.fn() },
      moduleGraph: { getModuleById: vi.fn() },
      watcher: { add: vi.fn(), off: vi.fn(), on: vi.fn() },
      ws: {
        on(event: string, listener: (payload: unknown, client: WebSocketClient) => void) {
          listeners.set(event, listener);
        },
        send,
      },
    } as unknown as ViteDevServer;
    const configureServer = plugin.configureServer;
    if (typeof configureServer !== "function") {
      throw new TypeError("The Studio plugin is missing its server hook.");
    }
    await configureServer.call({} as never, server);
    const requestState = listeners.get(DREVER_STUDIO_STATE_REQUEST_EVENT);
    if (requestState === undefined) {
      throw new TypeError("The Studio plugin did not register its state-request listener.");
    }
    const clientSend = vi.fn();
    const client = studioClient(clientSend);
    requestState({ token }, client);
    await vi.waitFor(() => expect(clientSend).toHaveBeenCalled());
    const receiveAction = listeners.get(DREVER_STUDIO_ACTION_EVENT);
    if (receiveAction === undefined) {
      throw new TypeError("The Studio plugin did not register its action listener.");
    }
    receiveAction(
      {
        token,
        action: action({ type: "submit-common-brief", brief: { topic: "A useful topic" } }),
      },
      client,
    );
    await vi.waitFor(() =>
      expect(clientSend).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ commonBrief: { topic: "A useful topic" } }),
          event: DREVER_STUDIO_STATE_EVENT,
        }),
      ),
    );
    clientSend.mockClear();

    await writeStudioAgentState(root, {
      version: 1,
      phase: "drafting",
      activity: [{ id: "drafting", label: "Building the first preview", status: "active" }],
    });

    await vi.waitFor(
      () =>
        expect(clientSend).toHaveBeenCalledWith({
          type: "custom",
          event: DREVER_STUDIO_STATE_EVENT,
          data: expect.objectContaining({
            phase: "drafting",
            activity: [expect.objectContaining({ id: "drafting", status: "active" })],
          }),
        }),
      { timeout: 1_000 },
    );
    expect(send).not.toHaveBeenCalled();
    close?.();
  });

  it("coalesces bursty provider updates and sends state only to registered local Studio clients", async () => {
    const root = await createRoot();
    const token = "studio-test-token";
    const listeners = new Map<string, (payload: unknown, client: WebSocketClient) => void>();
    const broadcast = vi.fn();
    const localSend = vi.fn();
    const remoteSend = vi.fn();
    const unauthorizedSend = vi.fn();
    let close: (() => void) | undefined;
    let notify = (): void => undefined;
    let message = "Agent connected";
    const started = Promise.withResolvers<void>();
    const info = vi.fn();
    const snapshot = vi.fn(() => ({
      connected: true,
      state: { version: 1 as const, phase: "briefing" as const, message },
    }));
    const provider = {
      approvals: () => [],
      handleAction: vi.fn(async () => undefined),
      respondToApproval: vi.fn(async () => undefined),
      snapshot,
      start: vi.fn(() => started.promise),
      stop: vi.fn(async () => undefined),
      subscribe(listener: () => void) {
        notify = listener;
        return () => undefined;
      },
    };
    const plugin = createStudioPlugin({ root, agentProvider: provider, token });
    const server = {
      config: { logger: { error: vi.fn(), info } },
      httpServer: {
        once(event: string, listener: () => void) {
          if (event === "close") close = listener;
        },
      },
      middlewares: { use: vi.fn() },
      moduleGraph: { getModuleById: vi.fn() },
      watcher: { add: vi.fn(), off: vi.fn(), on: vi.fn() },
      ws: {
        on(event: string, listener: (payload: unknown, client: WebSocketClient) => void) {
          listeners.set(event, listener);
        },
        send: broadcast,
      },
    } as unknown as ViteDevServer;
    const configureServer = plugin.configureServer;
    if (typeof configureServer !== "function") {
      throw new TypeError("The Studio plugin is missing its server hook.");
    }
    await configureServer.call({} as never, server);
    const requestState = listeners.get(DREVER_STUDIO_STATE_REQUEST_EVENT);
    if (requestState === undefined) {
      throw new TypeError("The Studio plugin did not register its state-request listener.");
    }
    requestState({ token }, studioClient(remoteSend, "192.168.1.8"));
    requestState({ token: "wrong-token" }, studioClient(unauthorizedSend));
    requestState({ token }, studioClient(localSend));
    await vi.waitFor(() => expect(localSend).toHaveBeenCalled());
    snapshot.mockClear();
    localSend.mockClear();

    message = "Final public milestone";
    for (let index = 0; index < 100; index += 1) notify();

    await vi.waitFor(() =>
      expect(localSend).toHaveBeenCalledWith({
        type: "custom",
        event: DREVER_STUDIO_STATE_EVENT,
        data: expect.objectContaining({ message: "Final public milestone" }),
      }),
    );
    expect(snapshot).toHaveBeenCalledOnce();
    expect(remoteSend).not.toHaveBeenCalled();
    expect(unauthorizedSend).not.toHaveBeenCalled();
    expect(broadcast).not.toHaveBeenCalled();
    started.resolve();
    await vi.waitFor(() => expect(info).toHaveBeenCalledWith("Drever Studio agent connected."));
    close?.();
  });

  it("protects the parent document from framing and stops polling after the last client leaves", async () => {
    const root = await createRoot();
    const token = "studio-test-token";
    const listeners = new Map<string, (payload: unknown, client: WebSocketClient) => void>();
    const middlewares: Array<(request: never, response: never, next: () => void) => void> = [];
    let disconnect: (() => void) | undefined;
    let close: (() => void) | undefined;
    const plugin = createStudioPlugin({ root, token });
    const server = {
      config: { logger: { error: vi.fn() } },
      httpServer: {
        once(event: string, listener: () => void) {
          if (event === "close") close = listener;
        },
      },
      middlewares: {
        use(middleware: (request: never, response: never, next: () => void) => void) {
          middlewares.push(middleware);
        },
      },
      moduleGraph: { getModuleById: vi.fn() },
      watcher: { add: vi.fn(), off: vi.fn(), on: vi.fn() },
      ws: {
        on(event: string, listener: (payload: unknown, client: WebSocketClient) => void) {
          listeners.set(event, listener);
        },
        send: vi.fn(),
      },
    } as unknown as ViteDevServer;
    const configureServer = plugin.configureServer;
    if (typeof configureServer !== "function") throw new TypeError("Missing server hook.");
    await configureServer.call({} as never, server);

    const setHeader = vi.fn();
    const next = vi.fn();
    middlewares[0]?.({} as never, { setHeader } as never, next);
    expect(setHeader).toHaveBeenCalledWith("X-Frame-Options", "DENY");
    expect(next).toHaveBeenCalledOnce();

    const requestState = listeners.get(DREVER_STUDIO_STATE_REQUEST_EVENT);
    if (requestState === undefined) throw new TypeError("Missing state request listener.");
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    requestState({ token }, {
      send: vi.fn(),
      socket: {
        _socket: { remoteAddress: "127.0.0.1" },
        once(event: string, listener: () => void) {
          if (event === "close") disconnect = listener;
        },
      },
    } as unknown as WebSocketClient);
    disconnect?.();
    expect(clearIntervalSpy).toHaveBeenCalledOnce();
    clearIntervalSpy.mockRestore();
    close?.();
  });
});

describe("Studio network boundary", () => {
  it("accepts only local socket address forms", () => {
    expect(isLoopbackAddress("127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("127.42.0.8")).toBe(true);
    expect(isLoopbackAddress("::1")).toBe(true);
    expect(isLoopbackAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("192.168.1.8")).toBe(false);
    expect(isLoopbackAddress(undefined)).toBe(false);
  });

  it("prints only local Studio URLs", () => {
    expect(
      resolveStudioUrls(
        {
          local: ["http://127.0.0.1:4317/talk/?slide=2#notes"],
          network: ["http://192.168.1.8:4317/talk/"],
        },
        "unguessable-local-capability",
        "http://127.0.0.1:51999/talk/",
      ),
    ).toEqual([
      "http://127.0.0.1:4317/talk/studio#access=unguessable-local-capability&preview=http%3A%2F%2F127.0.0.1%3A51999%2Ftalk%2F",
    ]);
  });
});

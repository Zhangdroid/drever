import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  DREVER_STUDIO_ACTIONS_DIRECTORY,
  DREVER_STUDIO_AGENT_CONNECTION_TTL_MS,
  DREVER_STUDIO_AGENT_HEARTBEAT_FILE,
  DREVER_STUDIO_AGENT_STATE_FILE,
  DREVER_STUDIO_DIRECTORY,
  createStudioSession,
  decodeStudioAction,
  isLoopbackAddress,
  resolveStudioUrls,
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

const action = (value: Readonly<Record<string, unknown>>) => ({
  version: 1,
  requestId: "request-1",
  expectedRevision: 0,
  ...value,
});

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
  it("accepts the five bounded browser action shapes and rejects unknown fields", () => {
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
          type: "submit-feedback",
          scope: { kind: "slide", slideId: "the-myth" },
          message: "Make the comparison clearer.",
        }),
      ),
    ).toBeDefined();
    expect(
      decodeStudioAction(action({ type: "approve-plan", arbitraryPath: "../../slides.mdx" })),
    ).toBeUndefined();
  });
});

describe("Studio session", () => {
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
      resolveStudioUrls({
        local: ["http://127.0.0.1:4317/talk/?slide=2#notes"],
        network: ["http://192.168.1.8:4317/talk/"],
      }),
    ).toEqual(["http://127.0.0.1:4317/talk/studio"]);
  });
});

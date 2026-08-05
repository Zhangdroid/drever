import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DreverStudioActionRecord, DreverStudioAgentState } from "@drever/schema";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  DREVER_STUDIO_AGENT_STATE_FILE,
  DREVER_STUDIO_DIRECTORY,
  createStudioSession,
} from "./studio-plugin.ts";
import {
  phaseForStudioAction,
  studioActionWorkflowInstructions,
  type StudioAgentProviderSnapshot,
} from "./studio-agent-provider.ts";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

const createRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "drever-live-agent-"));
  directories.push(root);
  return root;
};

const liveSnapshot = (state: DreverStudioAgentState): StudioAgentProviderSnapshot => ({
  connected: true,
  sessionId: "provider-session",
  state,
});

describe("Studio action workflow instructions", () => {
  it("makes approve-plan a bounded preview-first handoff", () => {
    const record = {
      version: 1,
      revision: 3,
      receivedAt: "2026-08-05T08:00:00.000Z",
      action: {
        version: 1,
        type: "approve-plan",
        requestId: "approve-3",
        expectedRevision: 2,
      },
    } as const satisfies DreverStudioActionRecord;

    const instructions = studioActionWorkflowInstructions(record);
    expect(instructions).toMatch(
      /mark brief\.md and drever\.plan\.json approved[^.]*publish the drafting phase/iu,
    );
    expect(instructions).toMatch(/bounded, semantic, content-complete Draft 1/iu);
    expect(instructions).toMatch(/project-local `drever check --json`[^.]*package manager/iu);
    expect(instructions).toMatch(/active Studio development server[^.]*embedded preview iframe/iu);
    expect(instructions).toMatch(/HMR reveal the draft/iu);
    expect(instructions).toMatch(/do not start or restart another development server/iu);
    expect(instructions).toMatch(/Before preview[^.]*do not[^.]*invoke Playwright/iu);
    expect(instructions).toMatch(/isolated rendered review only after the final authored source/iu);
  });

  it("does not burden latency-sensitive question delivery with Draft 1 instructions", () => {
    const record = {
      version: 1,
      revision: 1,
      receivedAt: "2026-08-05T08:00:00.000Z",
      action: {
        version: 1,
        type: "submit-common-brief",
        requestId: "brief-1",
        expectedRevision: 0,
        brief: { topic: "A clear story" },
      },
    } as const satisfies DreverStudioActionRecord;

    expect(studioActionWorkflowInstructions(record)).toBe("");
  });
});

describe("Studio action lifecycle", () => {
  const record = (action: DreverStudioActionRecord["action"]): DreverStudioActionRecord => ({
    version: 1,
    revision: 1,
    receivedAt: "2026-08-05T08:00:00.000Z",
    action,
  });

  it.each([
    {
      type: "submit-common-brief",
      action: record({
        version: 1,
        type: "submit-common-brief",
        requestId: "brief-1",
        expectedRevision: 0,
        brief: { topic: "A clear story" },
      }),
      phase: "waiting-for-agent",
    },
    {
      type: "submit-adaptive-answers",
      action: record({
        version: 1,
        type: "submit-adaptive-answers",
        requestId: "answers-1",
        expectedRevision: 0,
        answers: [{ questionId: "proof", optionIds: ["demo"] }],
      }),
      phase: "waiting-for-agent",
    },
    {
      type: "skip-remaining-questions",
      action: record({
        version: 1,
        type: "skip-remaining-questions",
        requestId: "skip-1",
        expectedRevision: 0,
      }),
      phase: "waiting-for-agent",
    },
    {
      type: "respond-agent-approval",
      action: record({
        version: 1,
        type: "respond-agent-approval",
        requestId: "approval-1",
        expectedRevision: 0,
        approvalId: "approval-1",
        decision: "accept",
      }),
      phase: "waiting-for-agent",
    },
    {
      type: "approve-plan",
      action: record({
        version: 1,
        type: "approve-plan",
        requestId: "approve-1",
        expectedRevision: 0,
      }),
      phase: "drafting",
    },
    {
      type: "submit-feedback",
      action: record({
        version: 1,
        type: "submit-feedback",
        requestId: "feedback-1",
        expectedRevision: 0,
        scope: { kind: "deck" },
        message: "Clarify the opening.",
      }),
      phase: "refining",
    },
  ] as const)("maps $type to $phase", ({ action, phase }) => {
    expect(phaseForStudioAction(action)).toBe(phase);
  });
});

describe("Studio live agent seam", () => {
  it("merges live telemetry without hiding file-published adaptive questions", async () => {
    const root = await createRoot();
    const directory = join(root, DREVER_STUDIO_DIRECTORY);
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, DREVER_STUDIO_AGENT_STATE_FILE),
      JSON.stringify({
        version: 1,
        phase: "adaptive-questions",
        adaptiveQuestions: [
          {
            id: "proof",
            prompt: "Which proof should lead?",
            options: [
              { id: "demo", label: "Demo", description: "Show it directly." },
              { id: "data", label: "Data", description: "Lead with a metric." },
            ],
          },
        ],
      }),
      "utf8",
    );
    const snapshot = liveSnapshot({
      version: 1,
      phase: "drafting",
      activity: [{ id: "codex-draft", label: "Building the draft", status: "active" }],
      message: "Checking the story flow.",
    });
    const session = createStudioSession(root, { agentProvider: { snapshot: () => snapshot } });

    await expect(session.read()).resolves.toMatchObject({
      phase: "adaptive-questions",
      agentConnected: true,
      adaptiveQuestions: [expect.objectContaining({ id: "proof" })],
      activity: [expect.objectContaining({ id: "codex-draft" })],
      message: "Checking the story flow.",
    });
  });

  it("keeps plan review structural while a provider reports transient drafting", async () => {
    const root = await createRoot();
    await writeFile(
      join(root, "drever.plan.json"),
      JSON.stringify({
        version: 1,
        status: "awaiting-approval",
        brief: {
          topic: "Safe live progress",
          audience: "Presentation authors",
          desiredChange: "Understand the live event boundary",
          durationMinutes: 10,
          language: "en",
          density: "concise",
        },
        slides: [
          {
            id: "opening",
            job: "opening",
            title: "Live progress without private reasoning",
            purpose: "Set the contract.",
            evidence: ["Only readable summaries cross the boundary."],
            focalArtifact: "A protocol flow",
            composition: { recipe: "comparison" },
            density: "concise",
          },
        ],
      }),
      "utf8",
    );
    const snapshot = liveSnapshot({ version: 1, phase: "drafting", message: "Still working." });
    const session = createStudioSession(root, { agentProvider: { snapshot: () => snapshot } });

    await expect(session.read()).resolves.toMatchObject({
      phase: "plan-review",
      agentConnected: true,
      message: "Still working.",
      plan: { status: "awaiting-approval" },
    });
  });

  it("streams telemetry changes without invalidating optimistic browser revisions", async () => {
    const root = await createRoot();
    let snapshot = liveSnapshot({
      version: 1,
      phase: "drafting",
      activity: [{ id: "codex-first", label: "First update", status: "active" }],
      message: "First summary.",
    });
    const session = createStudioSession(root, { agentProvider: { snapshot: () => snapshot } });
    expect(await session.read()).toMatchObject({ revision: 0, message: "First summary." });

    snapshot = liveSnapshot({
      version: 1,
      phase: "refining",
      activity: [{ id: "codex-second", label: "Second update", status: "active" }],
      message: "Second summary.",
    });
    await expect(session.refresh()).resolves.toMatchObject({
      changed: true,
      state: { revision: 0, phase: "refining", message: "Second summary." },
    });
  });
});

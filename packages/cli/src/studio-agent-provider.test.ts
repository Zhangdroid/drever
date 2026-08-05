import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DreverStudioAgentState } from "@drever/schema";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  DREVER_STUDIO_AGENT_STATE_FILE,
  DREVER_STUDIO_DIRECTORY,
  createStudioSession,
} from "./studio-plugin.ts";
import type { StudioAgentProviderSnapshot } from "./studio-agent-provider.ts";

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

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { DreverStudioActionRecord, DreverStudioAgentState } from "@drever/schema";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  DREVER_STUDIO_AGENT_STATE_FILE,
  DREVER_STUDIO_DIRECTORY,
  createStudioSession,
} from "./studio-plugin.ts";
import {
  phaseForStudioAction,
  managedStudioHostRoot,
  signalStudioAgentProcess,
  studioAgentProcessEnvironment,
  studioAgentProcessOptions,
  studioActionAgentPayload,
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
  it("marks managed-agent commands as children of the user-owned Studio host", () => {
    const environment = studioAgentProcessEnvironment("./deck", { PATH: "/usr/bin" });

    expect(environment).toEqual({
      DREVER_STUDIO_HOST_ROOT: resolve("./deck"),
      PATH: "/usr/bin",
    });
    expect(managedStudioHostRoot(environment)).toBe(resolve("./deck"));
    expect(managedStudioHostRoot({})).toBeUndefined();
    expect(studioAgentProcessOptions("./deck", { PATH: "/usr/bin" })).toEqual({
      cwd: "./deck",
      detached: process.platform !== "win32",
      env: environment,
    });
  });

  it("signals an owned detached process group instead of leaving agent children behind", () => {
    const directKill = vi.fn(() => true);
    const groupKill = vi.fn(() => true);

    expect(signalStudioAgentProcess({ pid: 420, kill: directKill }, "SIGTERM", groupKill)).toBe(
      true,
    );
    expect(groupKill).toHaveBeenCalledWith(-420, "SIGTERM");
    expect(directKill).not.toHaveBeenCalled();

    expect(signalStudioAgentProcess({ kill: directKill }, "SIGKILL", groupKill)).toBe(true);
    expect(directKill).toHaveBeenCalledWith("SIGKILL");
  });

  it("treats an already-exited process group as stopped", () => {
    const directKill = vi.fn(() => true);
    const missingGroup = vi.fn(() => {
      throw Object.assign(new Error("No such process"), { code: "ESRCH" });
    });

    expect(signalStudioAgentProcess({ pid: 420, kill: directKill }, "SIGTERM", missingGroup)).toBe(
      false,
    );
    expect(directKill).not.toHaveBeenCalled();
  });

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
    expect(instructions).toMatch(/preserve the exact approved or configured canvas/iu);
    expect(instructions).toMatch(/safe-area or content-inset policy/iu);
    expect(instructions).toMatch(/Treat those bounds as locked/iu);
    expect(instructions).toMatch(/project-local `drever check --json`[^.]*package manager/iu);
    expect(instructions).toMatch(/exactly once[^.]*blocking source diagnostic/iu);
    expect(instructions).toMatch(/active Studio development server[^.]*embedded preview iframe/iu);
    expect(instructions).toMatch(/HMR reveal the draft/iu);
    expect(instructions).toMatch(/do not load the design skill[^.]*write art-direction\.md/iu);
    expect(instructions).toMatch(/write art-direction\.md, replace Theme or Stage configuration/iu);
    expect(instructions).toMatch(/do not start or restart another development server/iu);
    expect(instructions).toMatch(/Before preview[^.]*do not[^.]*invoke Playwright/iu);
    expect(instructions).toMatch(/Publish preview in the same action immediately/iu);
    expect(instructions).toMatch(/isolated rendered review only after the final authored source/iu);
    expect(instructions).toMatch(/last-known-good canvas[^.]*safe area[^.]*immutable geometry/iu);
    expect(instructions).toMatch(/revert it before publishing[^.]*redesign it/iu);
    expect(instructions).toMatch(/slide 1[^.]*restrained cover/iu);
    expect(instructions).toMatch(/Never use data:, blob:, or javascript: URLs as CSS @import/iu);
  });

  it("keeps question delivery free of Draft 1 work while preserving the Studio host", () => {
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

    const instructions = studioActionWorkflowInstructions(record);
    expect(instructions).not.toMatch(/content-complete Draft 1/iu);
    expect(instructions).toMatch(/user-owned session resources/iu);
    expect(instructions).toMatch(/never stop, restart, replace, or clean them up/iu);
  });

  it("keeps temporary rendered review isolated from the Studio host", () => {
    const record = {
      version: 1,
      revision: 4,
      receivedAt: "2026-08-05T08:00:00.000Z",
      action: {
        version: 1,
        type: "submit-feedback",
        requestId: "feedback-4",
        expectedRevision: 3,
        scope: { kind: "deck" },
        message: "Tighten the conclusion.",
      },
    } as const satisfies DreverStudioActionRecord;

    const instructions = studioActionWorkflowInstructions(record);
    expect(instructions).toMatch(/Do not launch another `drever dev` or Vite server/iu);
    expect(instructions).toMatch(/never use broad process cleanup[^.]*`pkill`[^.]*`killall`/iu);
    expect(instructions).toMatch(
      /drever check --rendered --evidence \.drever\/review --json[^.]*isolated ephemeral loopback preview/iu,
    );
  });

  it.each([
    {
      type: "submit-adaptive-answers",
      action: {
        version: 1,
        type: "submit-adaptive-answers",
        requestId: "answers-2",
        expectedRevision: 1,
        answers: [{ questionId: "proof", optionIds: ["demo"] }],
      },
    },
    {
      type: "skip-remaining-questions",
      action: {
        version: 1,
        type: "skip-remaining-questions",
        requestId: "skip-2",
        expectedRevision: 1,
      },
    },
  ] as const)("makes $type a bounded Storyboard-first handoff", ({ action }) => {
    const record = {
      version: 1,
      revision: 2,
      receivedAt: "2026-08-05T08:00:00.000Z",
      action,
    } as const satisfies DreverStudioActionRecord;

    const instructions = studioActionWorkflowInstructions(record);
    expect(instructions).toMatch(/Storyboard handoff[^.]*latency-sensitive/iu);
    expect(instructions).toMatch(/one bounded semantic pass[^.]*submitted brief and direction/iu);
    expect(instructions).toMatch(/drever\.plan\.json[^.]*awaiting-approval/iu);
    expect(instructions).toMatch(/publish plan-review immediately/iu);
    expect(instructions).toMatch(/version-2 drever\.plan\.json/iu);
    expect(instructions).toMatch(/Storyboard is a content contract/iu);
    expect(instructions).toMatch(
      /Do not choose or emit per-slide density, composition, layout, or motion/iu,
    );
    expect(instructions).toMatch(/keep the deck-wide density/iu);
    expect(instructions).toMatch(/global canvas[^.]*safe area[^.]*content inset/iu);
    expect(instructions).toMatch(
      /Before that first reviewable Storyboard[^.]*do not browse[^.]*research facts or assets/iu,
    );
    expect(instructions).toMatch(/uncertain facts[^.]*explicit evidence requirements/iu);
    expect(instructions).toMatch(/return this managed child turn at the human approval gate/iu);
    expect(instructions).toMatch(/parent task remain active[^.]*ready, error, cancellation/iu);
    expect(instructions).toMatch(/Continue factual research[^.]*after approve-plan/iu);
    expect(instructions).not.toMatch(/content-complete Draft 1/iu);
  });

  it("hands restored question semantics to every agent transport", () => {
    const record = {
      version: 1,
      revision: 4,
      receivedAt: "2026-08-05T08:00:00.000Z",
      action: {
        version: 1,
        type: "submit-adaptive-answers",
        requestId: "answers-4",
        expectedRevision: 7,
        answers: [{ questionId: "proof", optionIds: ["demo"] }],
      },
      context: {
        adaptiveQuestions: [
          {
            id: "proof",
            prompt: "Which proof should lead?",
            options: [
              { id: "demo", label: "Live demo", description: "Show the behavior directly." },
            ],
          },
        ],
      },
    } as const satisfies DreverStudioActionRecord;

    expect(studioActionAgentPayload(record)).toEqual({
      revision: 4,
      action: record.action,
      context: record.context,
    });
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

  it("fails soft on invalid live state and preserves durable adaptive questions", async () => {
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
        message: "Choose the evidence direction.",
      }),
      "utf8",
    );
    const session = createStudioSession(root, {
      agentProvider: {
        snapshot: () =>
          ({
            connected: true,
            state: {
              version: 1,
              phase: "drafting",
              activity: [{ id: "ClaudeToolMixedCase", label: "Invalid", status: "active" }],
            },
          }) as unknown as StudioAgentProviderSnapshot,
      },
    });

    await expect(session.read()).resolves.toMatchObject({
      agentConfigured: true,
      agentConnected: false,
      phase: "adaptive-questions",
      adaptiveQuestions: [expect.objectContaining({ id: "proof" })],
      message: "Choose the evidence direction.",
    });
  });

  it("keeps a published plan review above transient provider drafting", async () => {
    const root = await createRoot();
    const directory = join(root, DREVER_STUDIO_DIRECTORY);
    await mkdir(directory, { recursive: true });
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
    await writeFile(
      join(directory, DREVER_STUDIO_AGENT_STATE_FILE),
      JSON.stringify({
        version: 1,
        phase: "plan-review",
        message: "The Storyboard is ready for review.",
      }),
      "utf8",
    );
    const snapshot = liveSnapshot({ version: 1, phase: "drafting", message: "Still working." });
    const session = createStudioSession(root, { agentProvider: { snapshot: () => snapshot } });

    await expect(session.read()).resolves.toMatchObject({
      phase: "plan-review",
      agentConfigured: true,
      agentConnected: true,
      message: "The Storyboard is ready for review.",
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

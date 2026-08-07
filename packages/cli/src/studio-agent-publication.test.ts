import { mkdtemp, mkdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DREVER_STUDIO_PROTOCOL_VERSION, type DreverStudioActionRecord } from "@drever/schema";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  createStudioActionPublicationVerifier,
  verifyStudioActionPublication,
  withStudioActionPublicationGrace,
} from "./studio-agent-publication.ts";
import {
  DREVER_STUDIO_ACTIONS_DIRECTORY,
  DREVER_STUDIO_AGENT_STATE_FILE,
  DREVER_STUDIO_DIRECTORY,
} from "./studio-plugin.ts";

const roots: string[] = [];

const createRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "drever-studio-publication-"));
  roots.push(root);
  return root;
};

const writeState = async (root: string, value: unknown): Promise<void> => {
  const directory = join(root, DREVER_STUDIO_DIRECTORY);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, DREVER_STUDIO_AGENT_STATE_FILE), JSON.stringify(value));
};

const writeActions = async (root: string, count: number): Promise<void> => {
  const directory = join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_ACTIONS_DIRECTORY);
  await mkdir(directory, { recursive: true });
  await Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const revision = index + 1;
      await writeFile(
        join(directory, `${String(revision).padStart(8, "0")}.json`),
        JSON.stringify({
          version: DREVER_STUDIO_PROTOCOL_VERSION,
          revision,
          receivedAt: "2026-08-04T20:00:00.000Z",
          action: {
            version: DREVER_STUDIO_PROTOCOL_VERSION,
            requestId: `request-${String(revision)}`,
            expectedRevision: revision - 1,
            type: "submit-common-brief",
            brief: { topic: `Topic ${String(revision)}` },
          },
        }),
      );
    }),
  );
};

const writeActionRecords = async (
  root: string,
  records: DreverStudioActionRecord[],
): Promise<void> => {
  const directory = join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_ACTIONS_DIRECTORY);
  await mkdir(directory, { recursive: true });
  await Promise.all(
    records.map((record) =>
      writeFile(
        join(directory, `${String(record.revision).padStart(8, "0")}.json`),
        JSON.stringify(record),
      ),
    ),
  );
};

const writePlan = async (root: string, status: "approved" | "awaiting-approval"): Promise<void> => {
  await writeFile(
    join(root, "drever.plan.json"),
    JSON.stringify({
      version: 1,
      status,
      brief: {
        topic: "Why black holes are not cosmic vacuum cleaners",
        audience: "Curious adults",
        desiredChange: "Replace a common misconception with a useful mental model",
        durationMinutes: 12,
        language: "en",
        density: "concise",
      },
      slides: [
        {
          id: "opening",
          job: "opening",
          title: "A black hole is not a vacuum cleaner",
          purpose: "Name the misconception.",
          evidence: ["Gravity still depends on distance and mass."],
          focalArtifact: "A stable orbit diagram",
          composition: { recipe: "comparison" },
          density: "concise",
        },
      ],
    }),
  );
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Studio action publication verifier", () => {
  it("allows a completed agent turn a bounded publication grace window", async () => {
    let attempts = 0;
    const verify = withStudioActionPublicationGrace(
      async () => {
        attempts += 1;
        return attempts === 3;
      },
      50,
      1,
    );
    const record = {
      version: DREVER_STUDIO_PROTOCOL_VERSION,
      revision: 1,
      receivedAt: "2026-08-04T20:00:00.000Z",
      action: {
        version: DREVER_STUDIO_PROTOCOL_VERSION,
        requestId: "brief-1",
        expectedRevision: 0,
        type: "submit-common-brief",
        brief: { topic: "A useful topic" },
      },
    } as const satisfies DreverStudioActionRecord;

    await expect(verify(record)).resolves.toBe(true);
    expect(attempts).toBe(3);
  });

  it("accepts only a validated publication that covers the requested revision", async () => {
    const root = await createRoot();
    await writeActions(root, 2);
    await expect(verifyStudioActionPublication(root, 2)).resolves.toBe(false);

    await writeState(root, {
      version: DREVER_STUDIO_PROTOCOL_VERSION,
      phase: "preview",
      handledActionRevision: 1,
    });
    await expect(verifyStudioActionPublication(root, 2)).resolves.toBe(false);

    await writeState(root, {
      version: DREVER_STUDIO_PROTOCOL_VERSION,
      phase: "preview",
      handledActionRevision: 2,
    });
    await expect(verifyStudioActionPublication(root, 2)).resolves.toBe(true);
  });

  it("fails closed for malformed JSON and schema-invalid state", async () => {
    const root = await createRoot();
    await writeActions(root, 1);
    const path = join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_AGENT_STATE_FILE);
    await mkdir(join(root, DREVER_STUDIO_DIRECTORY), { recursive: true });
    await writeFile(path, "{");
    await expect(verifyStudioActionPublication(root, 1)).resolves.toBe(false);

    await writeState(root, {
      version: DREVER_STUDIO_PROTOCOL_VERSION,
      phase: "preview",
      handledActionRevision: 1,
      unexpected: true,
    });
    await expect(verifyStudioActionPublication(root, 1)).resolves.toBe(false);
  });

  it("rejects a publication that advances beyond the durable action journal", async () => {
    const root = await createRoot();
    await writeActions(root, 1);
    await writeState(root, {
      version: DREVER_STUDIO_PROTOCOL_VERSION,
      phase: "ready",
      handledActionRevision: 2,
    });

    await expect(verifyStudioActionPublication(root, 1)).resolves.toBe(false);
  });

  it("creates a record-aware verifier for provider adapters", async () => {
    const root = await createRoot();
    await writeActions(root, 3);
    await writePlan(root, "approved");
    await writeState(root, {
      version: DREVER_STUDIO_PROTOCOL_VERSION,
      phase: "ready",
      handledActionRevision: 3,
    });
    const verify = createStudioActionPublicationVerifier(root);

    await expect(
      verify({
        version: DREVER_STUDIO_PROTOCOL_VERSION,
        revision: 3,
        receivedAt: "2026-08-04T20:00:00.000Z",
        action: {
          version: DREVER_STUDIO_PROTOCOL_VERSION,
          requestId: "feedback-3",
          expectedRevision: 2,
          type: "submit-feedback",
          scope: { kind: "deck" },
          message: "Clarify the opening.",
        },
      }),
    ).resolves.toBe(true);
  });

  it("requires the concrete question-round outcome for a submitted brief", async () => {
    const root = await createRoot();
    await writeActions(root, 1);
    const verify = createStudioActionPublicationVerifier(root);
    const record = {
      version: 1,
      revision: 1,
      receivedAt: "2026-08-04T20:00:00.000Z",
      action: {
        version: 1,
        requestId: "brief-1",
        expectedRevision: 0,
        type: "submit-common-brief",
        brief: { topic: "Why black holes are not cosmic vacuum cleaners" },
      },
    } as const;

    await writeState(root, {
      version: DREVER_STUDIO_PROTOCOL_VERSION,
      phase: "waiting-for-agent",
      handledActionRevision: 1,
    });
    await expect(verify(record)).resolves.toBe(false);

    await writeState(root, {
      version: DREVER_STUDIO_PROTOCOL_VERSION,
      phase: "adaptive-questions",
      handledActionRevision: 1,
      adaptiveQuestions: [
        {
          id: "evidence",
          prompt: "Which evidence should lead?",
          options: [
            { id: "orbit", label: "Stable orbit", description: "Lead with orbital motion." },
            { id: "scale", label: "Gravity scale", description: "Compare distances and mass." },
          ],
        },
      ],
    });
    await expect(verify(record)).resolves.toBe(true);
  });

  it("accepts a reviewable plan that covers a consecutive skip after the submitted brief", async () => {
    const root = await createRoot();
    const brief = {
      version: DREVER_STUDIO_PROTOCOL_VERSION,
      revision: 1,
      receivedAt: "2026-08-04T20:00:00.000Z",
      action: {
        version: DREVER_STUDIO_PROTOCOL_VERSION,
        requestId: "brief-1",
        expectedRevision: 0,
        type: "submit-common-brief",
        brief: { topic: "Why black holes are not cosmic vacuum cleaners" },
      },
    } as const satisfies DreverStudioActionRecord;
    const skip = {
      version: DREVER_STUDIO_PROTOCOL_VERSION,
      revision: 2,
      receivedAt: "2026-08-04T20:00:01.000Z",
      action: {
        version: DREVER_STUDIO_PROTOCOL_VERSION,
        requestId: "skip-2",
        // Browser state revisions also advance for agent publications, independently of the
        // journal revision. Adjacency in the server-owned journal proves this is the paired skip.
        expectedRevision: 7,
        type: "skip-remaining-questions",
      },
    } as const satisfies DreverStudioActionRecord;
    await writeActionRecords(root, [brief, skip]);
    const verify = createStudioActionPublicationVerifier(root);

    await writeState(root, {
      version: DREVER_STUDIO_PROTOCOL_VERSION,
      phase: "plan-review",
      handledActionRevision: 2,
    });
    await expect(verify(brief)).resolves.toBe(false);

    await writePlan(root, "awaiting-approval");
    await expect(verify(brief)).resolves.toBe(true);
  });

  it("does not treat an unrelated later action as a skipped question round", async () => {
    const root = await createRoot();
    const brief = {
      version: DREVER_STUDIO_PROTOCOL_VERSION,
      revision: 1,
      receivedAt: "2026-08-04T20:00:00.000Z",
      action: {
        version: DREVER_STUDIO_PROTOCOL_VERSION,
        requestId: "brief-1",
        expectedRevision: 0,
        type: "submit-common-brief",
        brief: { topic: "Why black holes are not cosmic vacuum cleaners" },
      },
    } as const satisfies DreverStudioActionRecord;
    const nextBrief = {
      ...brief,
      revision: 2,
      action: {
        ...brief.action,
        requestId: "brief-2",
        expectedRevision: 1,
      },
    } as const satisfies DreverStudioActionRecord;
    await writeActionRecords(root, [brief, nextBrief]);
    await writePlan(root, "awaiting-approval");
    await writeState(root, {
      version: DREVER_STUDIO_PROTOCOL_VERSION,
      phase: "plan-review",
      handledActionRevision: 2,
    });

    await expect(createStudioActionPublicationVerifier(root)(brief)).resolves.toBe(false);
  });

  it("requires a reviewable plan after skipping questions", async () => {
    const root = await createRoot();
    await writeActions(root, 1);
    const verify = createStudioActionPublicationVerifier(root);
    const record = {
      version: 1,
      revision: 1,
      receivedAt: "2026-08-04T20:00:00.000Z",
      action: {
        version: 1,
        requestId: "skip-1",
        expectedRevision: 0,
        type: "skip-remaining-questions",
      },
    } as const;
    await writeState(root, {
      version: DREVER_STUDIO_PROTOCOL_VERSION,
      phase: "plan-review",
      handledActionRevision: 1,
    });
    await expect(verify(record)).resolves.toBe(false);

    await writePlan(root, "awaiting-approval");
    await expect(verify(record)).resolves.toBe(true);
  });

  it("does not let an older Storyboard satisfy a newer direction action", async () => {
    const root = await createRoot();
    const record = {
      version: DREVER_STUDIO_PROTOCOL_VERSION,
      revision: 1,
      receivedAt: "2026-08-04T20:00:00.000Z",
      action: {
        version: DREVER_STUDIO_PROTOCOL_VERSION,
        requestId: "answers-1",
        expectedRevision: 0,
        type: "submit-adaptive-answers",
        answers: [{ questionId: "proof", optionIds: ["demo"] }],
      },
    } as const satisfies DreverStudioActionRecord;
    await writeActionRecords(root, [record]);
    await writePlan(root, "awaiting-approval");
    const planPath = join(root, "drever.plan.json");
    await utimes(
      planPath,
      new Date("2026-08-03T20:00:00.000Z"),
      new Date("2026-08-03T20:00:00.000Z"),
    );
    await writeState(root, {
      version: DREVER_STUDIO_PROTOCOL_VERSION,
      phase: "plan-review",
      handledActionRevision: 1,
    });
    const verify = createStudioActionPublicationVerifier(root);

    await expect(verify(record)).resolves.toBe(false);
    await utimes(
      planPath,
      new Date("2026-08-05T20:00:00.000Z"),
      new Date("2026-08-05T20:00:00.000Z"),
    );
    await expect(verify(record)).resolves.toBe(true);
  });

  it("does not let an older Storyboard satisfy newer Storyboard feedback", async () => {
    const root = await createRoot();
    const record = {
      version: DREVER_STUDIO_PROTOCOL_VERSION,
      revision: 1,
      receivedAt: "2026-08-04T20:00:00.000Z",
      action: {
        version: DREVER_STUDIO_PROTOCOL_VERSION,
        requestId: "feedback-1",
        expectedRevision: 3,
        type: "submit-feedback",
        scope: { kind: "deck" },
        message: "Make the Storyboard opening more concrete.",
      },
      context: { feedbackTarget: "storyboard" },
    } as const satisfies DreverStudioActionRecord;
    await writeActionRecords(root, [record]);
    await writePlan(root, "awaiting-approval");
    const planPath = join(root, "drever.plan.json");
    await utimes(
      planPath,
      new Date("2026-08-03T20:00:00.000Z"),
      new Date("2026-08-03T20:00:00.000Z"),
    );
    await writeState(root, {
      version: DREVER_STUDIO_PROTOCOL_VERSION,
      phase: "plan-review",
      handledActionRevision: 1,
    });
    const verify = createStudioActionPublicationVerifier(root);

    await expect(verify(record)).resolves.toBe(false);
    await utimes(
      planPath,
      new Date("2026-08-05T20:00:00.000Z"),
      new Date("2026-08-05T20:00:00.000Z"),
    );
    await expect(verify(record)).resolves.toBe(true);
  });

  it("allows progressive preview but requires ready output when approval finishes", async () => {
    const root = await createRoot();
    await writeActions(root, 1);
    await writePlan(root, "approved");
    const verify = createStudioActionPublicationVerifier(root);
    const record = {
      version: 1,
      revision: 1,
      receivedAt: "2026-08-04T20:00:00.000Z",
      action: {
        version: 1,
        requestId: "approve-1",
        expectedRevision: 0,
        type: "approve-plan",
      },
    } as const;
    await writeState(root, {
      version: DREVER_STUDIO_PROTOCOL_VERSION,
      phase: "preview",
      handledActionRevision: 1,
    });
    await expect(verify(record)).resolves.toBe(false);

    await writeState(root, {
      version: DREVER_STUDIO_PROTOCOL_VERSION,
      phase: "ready",
      handledActionRevision: 1,
    });
    await expect(verify(record)).resolves.toBe(true);
  });
});

import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DREVER_STUDIO_PROTOCOL_VERSION } from "@drever/schema";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  createStudioActionPublicationVerifier,
  verifyStudioActionPublication,
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

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Studio action publication verifier", () => {
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
});

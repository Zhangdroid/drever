import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { parseCommand, runCli } from "./cli.ts";
import { runStudioCommand } from "./studio-command.ts";
import {
  DREVER_STUDIO_AGENT_STATE_FILE,
  DREVER_STUDIO_DIRECTORY,
  createStudioSession,
} from "./studio-plugin.ts";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

const createRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "drever-studio-command-"));
  directories.push(root);
  return root;
};

const outputCapture = () => {
  let value = "";
  return {
    read: () => value,
    stdout: { write: (chunk: string | Uint8Array) => ((value += String(chunk)), true) },
  };
};

describe("Studio CLI arguments", () => {
  it("models status, wait, and fixed-state publication", () => {
    expect(parseCommand(["studio", "status", "--json"])).toEqual({
      action: "status",
      json: true,
      name: "studio",
    });
    expect(parseCommand(["studio", "wait", "--after", "4", "--timeout", "12", "--json"])).toEqual({
      action: "wait",
      after: 4,
      json: true,
      name: "studio",
      timeoutSeconds: 12,
    });
    expect(parseCommand(["studio", "publish", "--file", "agent-state.json"])).toEqual({
      action: "publish",
      file: "agent-state.json",
      json: false,
      name: "studio",
    });
  });

  it.each([
    [["studio"], "Studio action is required."],
    [["studio", "wait"], "studio wait requires --after."],
    [["studio", "wait", "--after", "-1"], "--after requires a value."],
    [["studio", "wait", "--after", "0", "--timeout", "301"], "--timeout cannot exceed"],
    [["studio", "publish"], "studio publish requires --file."],
    [["studio", "status", "--timeout", "1"], "studio status accepts only --json."],
  ])("rejects invalid Studio arguments: %j", (arguments_, message) => {
    expect(() => parseCommand(arguments_)).toThrowError(message);
  });

  it("dispatches without loading project configuration", async () => {
    const root = await createRoot();
    await writeFile(join(root, "drever.config.ts"), "export default { invalid: true };\n");
    const capture = outputCapture();
    const execute = vi.fn(async () => {});

    await runCli(["studio", "status", "--json"], {
      cwd: root,
      runStudioCommand: execute,
      stdout: capture.stdout,
    });

    expect(execute).toHaveBeenCalledWith({
      command: { action: "status", json: true, name: "studio" },
      root,
      stdout: capture.stdout,
    });
  });
});

describe("Studio CLI bridge", () => {
  it("reports state and returns browser actions after an action revision", async () => {
    const root = await createRoot();
    const session = createStudioSession(root, {
      token: "studio-token",
      now: () => new Date("2026-08-03T12:00:00.000Z"),
    });
    await session.accept(
      {
        token: "studio-token",
        action: {
          version: 1,
          requestId: "brief-1",
          expectedRevision: 0,
          type: "submit-common-brief",
          brief: { topic: "Why black holes are not cosmic vacuum cleaners" },
        },
      },
      true,
    );
    const status = outputCapture();
    await runStudioCommand({
      command: { action: "status", json: true, name: "studio" },
      root,
      stdout: status.stdout,
    });
    expect(JSON.parse(status.read())).toMatchObject({
      agentConnected: true,
      latestActionRevision: 1,
      pendingActionCount: 1,
      phase: "waiting-for-agent",
    });

    const waited = outputCapture();
    await runStudioCommand({
      command: {
        action: "wait",
        after: 0,
        json: true,
        name: "studio",
        timeoutSeconds: 1,
      },
      root,
      stdout: waited.stdout,
    });
    expect(JSON.parse(waited.read())).toMatchObject({
      after: 0,
      latestActionRevision: 1,
      timedOut: false,
      actions: [{ revision: 1, action: { type: "submit-common-brief" } }],
    });
  });

  it("returns a bounded timeout instead of waiting forever", async () => {
    const root = await createRoot();
    const capture = outputCapture();
    let milliseconds = 0;

    await runStudioCommand({
      command: {
        action: "wait",
        after: 0,
        json: true,
        name: "studio",
        timeoutSeconds: 1,
      },
      delay: async (duration) => {
        milliseconds += duration;
      },
      now: () => milliseconds,
      root,
      stdout: capture.stdout,
    });

    expect(JSON.parse(capture.read())).toEqual({
      version: 1,
      after: 0,
      latestActionRevision: 0,
      timedOut: true,
      actions: [],
    });
  });

  it("publishes only validated project-local JSON to the fixed Studio state file", async () => {
    const root = await createRoot();
    const outside = await createRoot();
    const publication = {
      version: 1,
      phase: "drafting",
      progress: { label: "Building the first preview", completed: 2, total: 8 },
    } as const;
    await writeFile(join(root, "agent-state.json"), JSON.stringify(publication));
    const capture = outputCapture();

    await runStudioCommand({
      command: {
        action: "publish",
        file: "agent-state.json",
        json: true,
        name: "studio",
      },
      root,
      stdout: capture.stdout,
    });

    expect(JSON.parse(capture.read())).toEqual(publication);
    expect(
      JSON.parse(
        await readFile(join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_AGENT_STATE_FILE), "utf8"),
      ),
    ).toEqual(publication);

    const outsidePublication = join(outside, "outside.json");
    await writeFile(outsidePublication, JSON.stringify(publication));
    await symlink(outsidePublication, join(root, "linked.json"));
    await expect(
      runStudioCommand({
        command: {
          action: "publish",
          file: "linked.json",
          json: false,
          name: "studio",
        },
        root,
        stdout: capture.stdout,
      }),
    ).rejects.toMatchObject({ code: "DREVER_STUDIO_PUBLICATION_PATH_INVALID" });

    await writeFile(
      join(root, "invalid-questions.json"),
      JSON.stringify({ version: 1, phase: "questions", questions: [] }),
    );
    await expect(
      runStudioCommand({
        command: {
          action: "publish",
          file: "invalid-questions.json",
          json: false,
          name: "studio",
        },
        root,
        stdout: capture.stdout,
      }),
    ).rejects.toMatchObject({
      code: "DREVER_STUDIO_PUBLICATION_INVALID",
      hint: expect.stringContaining('"phase":"adaptive-questions"'),
    });
  });
});

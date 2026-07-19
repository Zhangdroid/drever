import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { parseCommand, runCli } from "./cli.ts";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("parseCommand", () => {
  it("models project workflows and their optional entry", () => {
    expect(parseCommand([])).toBe("help");
    expect(parseCommand(["dev"])).toEqual({ name: "dev" });
    expect(parseCommand(["build", "decks/keynote.mdx"])).toEqual({
      entry: "decks/keynote.mdx",
      name: "build",
    });
  });

  it("models the agent setup and authoring context workflows", () => {
    expect(parseCommand(["agent", "sync"])).toEqual({ action: "sync", name: "agent" });
    expect(parseCommand(["context"])).toEqual({ json: false, name: "context" });
    expect(parseCommand(["context", "--json", "decks/keynote.mdx"])).toEqual({
      entry: "decks/keynote.mdx",
      json: true,
      name: "context",
    });
    expect(parseCommand(["current", "--json"])).toEqual({ json: true, name: "current" });
  });

  it("models PDF export flags independently of their position", () => {
    expect(parseCommand(["export", "pdf"])).toEqual({
      format: "pdf",
      name: "export",
      steps: false,
    });
    expect(
      parseCommand([
        "export",
        "pdf",
        "--output",
        "release/talk.pdf",
        "--steps",
        "decks/keynote.mdx",
      ]),
    ).toEqual({
      entry: "decks/keynote.mdx",
      format: "pdf",
      name: "export",
      output: "release/talk.pdf",
      steps: true,
    });
    expect(parseCommand(["export", "pdf", "-o", "talk.pdf", "slides.mdx"])).toEqual({
      entry: "slides.mdx",
      format: "pdf",
      name: "export",
      output: "talk.pdf",
      steps: false,
    });
  });

  it("models strict check flags independently of the entry position", () => {
    expect(parseCommand(["check"])).toEqual({ json: false, name: "check" });
    expect(parseCommand(["check", "--json", "decks/keynote.mdx"])).toEqual({
      entry: "decks/keynote.mdx",
      json: true,
      name: "check",
    });
    expect(parseCommand(["check", "slides.mdx", "--json"])).toEqual({
      entry: "slides.mdx",
      json: true,
      name: "check",
    });
  });

  it.each([
    [["check", "--json", "--json"], "--json can be specified only once."],
    [["check", "--fix"], "Unknown check flag: --fix"],
    [["check", "one.mdx", "two.mdx"], "check accepts at most one deck entry path."],
  ])("rejects invalid check arguments: %j", (arguments_, message) => {
    expect(() => parseCommand(arguments_)).toThrowError(
      expect.objectContaining({ code: "DREVER_ARGUMENT_INVALID", message }),
    );
  });

  it.each([
    [["agent"], "Agent action is required."],
    [["agent", "install"], "Unknown agent action: install"],
    [["agent", "sync", "extra"], "agent sync does not accept arguments."],
    [["context", "--json", "--json"], "--json can be specified only once."],
    [["context", "--write"], "Unknown context flag: --write"],
    [["context", "one.mdx", "two.mdx"], "context accepts at most one deck entry path."],
    [["current", "--json", "--json"], "--json can be specified only once."],
    [["current", "slides.mdx"], "Unknown current argument: slides.mdx"],
  ])("rejects invalid agent and context arguments: %j", (arguments_, message) => {
    expect(() => parseCommand(arguments_)).toThrowError(
      expect.objectContaining({ code: "DREVER_ARGUMENT_INVALID", message }),
    );
  });

  it.each([
    [["export"], "Export format is required."],
    [["export", "pptx"], "Unknown export format: pptx"],
    [["export", "pdf", "--paper"], "Unknown export flag: --paper"],
    [["export", "pdf", "--steps", "--steps"], "--steps can be specified only once."],
    [["export", "pdf", "-o"], "-o requires a PDF path."],
    [["export", "pdf", "--output", "--steps"], "--output requires a PDF path."],
    [
      ["export", "pdf", "-o", "first.pdf", "--output", "second.pdf"],
      "The PDF output can be specified only once.",
    ],
    [["export", "pdf", "-o", "talk.html"], "The export output path must end with .pdf."],
    [["export", "pdf", "one.mdx", "two.mdx"], "PDF export accepts at most one deck entry path."],
  ])("rejects invalid PDF export arguments: %j", (arguments_, message) => {
    expect(() => parseCommand(arguments_)).toThrowError(
      expect.objectContaining({ code: "DREVER_ARGUMENT_INVALID", message }),
    );
  });

  it("rejects flags that would imply an unsupported Vite surface", () => {
    expect(() => parseCommand(["dev", "--config", "vite.config.ts"])).toThrowError(
      expect.objectContaining({ code: "DREVER_ARGUMENT_INVALID" }),
    );
    expect(() => parseCommand(["preview"])).toThrowError(
      expect.objectContaining({ code: "DREVER_COMMAND_UNKNOWN" }),
    );
  });
});

describe("runCli agent", () => {
  it("syncs the agent kit without loading project config or requiring a deck", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-agent-cli-test-"));
    directories.push(root);
    await writeFile(join(root, "drever.config.ts"), "export default { invalid: true };\n");
    const syncAgentKit = vi.fn(async () => ({
      files: [
        { path: "AGENTS.md", status: "created" as const },
        { path: ".agents/skills/drever-create-deck/SKILL.md", status: "unchanged" as const },
      ],
    }));
    let output = "";

    await runCli(["agent", "sync"], {
      cwd: root,
      stdout: { write: (chunk) => ((output += String(chunk)), true) },
      syncAgentKit,
    });

    expect(syncAgentKit).toHaveBeenCalledWith({ root });
    expect(output).toBe("Synced Drever agent kit: 1 created, 0 updated, 1 unchanged.\n");
  });
});

describe("runCli current", () => {
  it("reads the live position without loading project config", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-current-cli-test-"));
    directories.push(root);
    await writeFile(join(root, "drever.config.ts"), "export default { invalid: true };\n");
    const stdout = { write: vi.fn(() => true) };
    const writeCurrentPosition = vi.fn(async () => ({ version: 1 as const }));

    await runCli(["current", "--json"], { cwd: root, stdout, writeCurrentPosition });

    expect(writeCurrentPosition).toHaveBeenCalledWith({ json: true, root, stdout });
  });
});

describe("runCli context", () => {
  it("resolves production config and delegates complete context rendering", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-context-cli-test-"));
    directories.push(root);
    await writeFile(join(root, "talk.mdx"), "# Agent context\n");
    await writeFile(
      join(root, "drever.config.ts"),
      `type Environment = { command: string; mode: string };
export default ({ command, mode }: Environment) => ({
  entry: command === "build" && mode === "production" ? "talk.mdx" : "wrong.mdx",
});
`,
    );
    const writeAuthoringContext = vi.fn(async () => ({ version: 1 as const }));
    const stdout = { write: vi.fn(() => true) };

    await runCli(["context", "--json"], { cwd: root, stdout, writeAuthoringContext });

    expect(writeAuthoringContext).toHaveBeenCalledWith({
      project: expect.objectContaining({ entry: join(root, "talk.mdx"), root }),
      json: true,
      stdout,
    });
  });
});

describe("runCli check", () => {
  it("checks the configured entry without creating build or plugin artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-check-cli-test-"));
    directories.push(root);
    await writeFile(join(root, "talk.mdx"), "# Talk\n");
    await writeFile(
      join(root, "drever.config.ts"),
      `type Environment = { command: string; mode: string };
export default ({ command, mode }: Environment) => ({
  entry: command === "build" && mode === "production" ? "talk.mdx" : "wrong.mdx",
  build: { outDir: "generated" },
});
`,
    );
    const checkDeck = vi.fn(async () => 1 as const);
    const stdout = { write: vi.fn(() => true) };
    const authoredEntries = (await readdir(root)).toSorted();

    const outcome = await runCli(["check", "--json"], { checkDeck, cwd: root, stdout });

    expect(outcome).toBe(1);
    expect(checkDeck).toHaveBeenCalledWith({
      entry: join(root, "talk.mdx"),
      json: true,
      stdout,
    });
    expect((await readdir(root)).toSorted()).toEqual(authoredEntries);
  });

  it("lets a positional check entry override project config", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-check-cli-test-"));
    directories.push(root);
    await writeFile(join(root, "slides.mdx"), "# Default\n");
    await writeFile(join(root, "keynote.mdx"), "# Keynote\n");
    await writeFile(join(root, "drever.config.ts"), 'export default { entry: "slides.mdx" };\n');
    const checkDeck = vi.fn(async () => 0 as const);

    const outcome = await runCli(["check", "keynote.mdx"], {
      checkDeck,
      cwd: root,
      stdout: { write: () => true },
    });

    expect(outcome).toBe(0);
    expect(checkDeck).toHaveBeenCalledWith(
      expect.objectContaining({ entry: join(root, "keynote.mdx"), json: false }),
    );
  });

  it("returns invalid deck diagnostics as JSON through the public command flow", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-check-cli-test-"));
    directories.push(root);
    const entry = join(root, "slides.mdx");
    await writeFile(entry, "# Broken\n\n<Component");
    let output = "";
    const authoredEntries = (await readdir(root)).toSorted();

    const outcome = await runCli(["check", "--json"], {
      cwd: root,
      stdout: { write: (chunk) => ((output += String(chunk)), true) },
    });

    const report = JSON.parse(output) as {
      sourcePath: string;
      summary: { errors: number };
    };
    expect(outcome).toBe(1);
    expect(report.sourcePath).toBe(entry);
    expect(report.summary.errors).toBeGreaterThan(0);
    expect(output).toBe(`${JSON.stringify(report, null, 2)}\n`);
    expect((await readdir(root)).toSorted()).toEqual(authoredEntries);
  });
});

describe("runCli export", () => {
  it("resolves the configured entry and default PDF beside the project", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-export-cli-test-"));
    directories.push(root);
    await writeFile(join(root, "talk.mdx"), "# Talk\n");
    await writeFile(join(root, "drever.config.ts"), 'export default { entry: "talk.mdx" };\n');
    const exportPdf = vi.fn(async () => {});
    let output = "";

    await runCli(["export", "pdf", "--steps"], {
      cwd: root,
      exportPdf,
      stdout: { write: (chunk) => ((output += String(chunk)), true) },
    });

    expect(exportPdf).toHaveBeenCalledOnce();
    expect(exportPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        output: join(root, "talk-export.pdf"),
        project: expect.objectContaining({ entry: join(root, "talk.mdx"), root }),
        steps: true,
      }),
    );
    expect(output).toBe(`Exported ${join(root, "talk.mdx")} to ${join(root, "talk-export.pdf")}\n`);
  });

  it("lets the positional entry override config and resolves a custom output from the root", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-export-cli-test-"));
    directories.push(root);
    await writeFile(join(root, "slides.mdx"), "# Default\n");
    await writeFile(join(root, "keynote.mdx"), "# Keynote\n");
    const exportPdf = vi.fn(async () => {});

    await runCli(["export", "pdf", "keynote.mdx", "-o", "exports/keynote.pdf"], {
      cwd: root,
      exportPdf,
      stdout: { write: () => true },
    });

    expect(exportPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        output: join(root, "exports", "keynote.pdf"),
        project: expect.objectContaining({ entry: join(root, "keynote.mdx") }),
        steps: false,
      }),
    );
  });
});

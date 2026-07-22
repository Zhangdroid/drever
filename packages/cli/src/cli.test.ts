import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
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
    expect(parseCommand(["create", "product-story", "--no-install"])).toEqual({
      agent: "all",
      directory: "product-story",
      help: false,
      install: false,
      json: false,
      name: "create",
    });
    expect(parseCommand(["dev"])).toEqual({ name: "dev" });
    expect(parseCommand(["build", "decks/keynote.mdx"])).toEqual({
      entry: "decks/keynote.mdx",
      json: false,
      name: "build",
    });
    expect(parseCommand(["build", "--json"])).toEqual({ json: true, name: "build" });
  });

  it("models the agent setup and authoring context workflows", () => {
    expect(parseCommand(["agent", "sync"])).toEqual({ action: "sync", name: "agent" });
    expect(parseCommand(["agent", "sync", "--target", "claude"])).toEqual({
      action: "sync",
      name: "agent",
      target: "claude",
    });
    expect(parseCommand(["context"])).toEqual({ json: false, name: "context" });
    expect(parseCommand(["context", "--json", "decks/keynote.mdx"])).toEqual({
      entry: "decks/keynote.mdx",
      json: true,
      name: "context",
    });
    expect(parseCommand(["current", "--json"])).toEqual({ json: true, name: "current" });
    expect(parseCommand(["doctor", "--json"])).toEqual({ json: true, name: "doctor" });
    expect(parseCommand(["mcp", "decks/keynote.mdx"])).toEqual({
      entry: "decks/keynote.mdx",
      name: "mcp",
    });
  });

  it("models PDF export flags independently of their position", () => {
    expect(parseCommand(["export", "pdf"])).toEqual({
      format: "pdf",
      json: false,
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
        "--slides",
        "2-5, 8",
        "decks/keynote.mdx",
      ]),
    ).toEqual({
      entry: "decks/keynote.mdx",
      format: "pdf",
      json: false,
      name: "export",
      output: "release/talk.pdf",
      slides: [
        { first: 2, last: 5 },
        { first: 8, last: 8 },
      ],
      steps: true,
    });
    expect(parseCommand(["export", "pdf", "-o", "talk.pdf", "slides.mdx"])).toEqual({
      entry: "slides.mdx",
      format: "pdf",
      json: false,
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
    [["build", "--json", "--json"], "--json can be specified only once."],
    [["build", "--watch"], "Unknown build flag: --watch"],
    [["build", "one.mdx", "two.mdx"], "build accepts at most one deck entry path."],
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
    [["agent", "sync", "extra"], "Unknown agent sync argument: extra"],
    [
      ["agent", "sync", "--target", "cursor"],
      "--target requires one of: all, auto, claude, codex.",
    ],
    [
      ["agent", "sync", "--target", "codex", "--target", "claude"],
      "--target can be specified only once.",
    ],
    [["context", "--json", "--json"], "--json can be specified only once."],
    [["context", "--write"], "Unknown context flag: --write"],
    [["context", "one.mdx", "two.mdx"], "context accepts at most one deck entry path."],
    [["current", "--json", "--json"], "--json can be specified only once."],
    [["current", "slides.mdx"], "Unknown current argument: slides.mdx"],
    [["doctor", "--json", "--json"], "--json can be specified only once."],
    [["doctor", "--fix"], "Unknown doctor argument: --fix"],
    [["mcp", "one.mdx", "two.mdx"], "mcp accepts at most one deck entry path."],
    [["mcp", "--port"], "mcp accepts at most one deck entry path."],
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
    [["export", "pdf", "--json", "--json"], "--json can be specified only once."],
    [["export", "pdf", "--slides", "2", "--slides", "3"], "--slides can be specified only once."],
    [
      ["export", "pdf", "--slides", "--steps"],
      "--slides requires a slide selection such as 2-5,8.",
    ],
    [
      ["export", "pdf", "--slides", "2--5"],
      'Invalid --slides selection "2--5". Use one-based slide numbers and inclusive ranges such as 2-5,8.',
    ],
    [
      ["export", "pdf", "--slides", "0"],
      'Invalid --slides range "0". Slide numbers must be positive safe integers.',
    ],
    [
      ["export", "pdf", "--slides", "5-2"],
      'Invalid --slides range "5-2". The first slide must not exceed the last slide.',
    ],
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

describe("runCli metadata", () => {
  it("reports the installed package version", async () => {
    const metadata = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string };
    let output = "";

    await runCli(["--version"], {
      stdout: { write: (chunk) => ((output += String(chunk)), true) },
    });

    expect(output).toBe(`${metadata.version}\n`);
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

  it("passes an explicit platform target to the sync engine", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-agent-cli-test-"));
    directories.push(root);
    const syncAgentKit = vi.fn(async () => ({ files: [] }));

    await runCli(["agent", "sync", "--target", "all"], {
      cwd: root,
      stdout: { write: () => true },
      syncAgentKit,
    });

    expect(syncAgentKit).toHaveBeenCalledWith({ root, target: "all" });
  });
});

describe("runCli create", () => {
  it("creates before loading project config and returns a machine-readable receipt", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-create-cli-test-"));
    directories.push(root);
    await writeFile(join(root, "drever.config.ts"), "export default { invalid: true };\n");
    const projectRoot = join(root, "new-deck");
    const createProject = vi.fn(async () => ({
      agentFiles: [],
      files: ["package.json", "slides.mdx"],
      installed: false,
      packageManager: "npm" as const,
      root: projectRoot,
      version: 1 as const,
    }));
    let output = "";

    await runCli(["create", "new-deck", "--no-install", "--json"], {
      createProject,
      cwd: root,
      stdout: { write: (chunk) => ((output += String(chunk)), true) },
    });

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({ agent: "all", install: false, quiet: true, root: projectRoot }),
    );
    expect(JSON.parse(output)).toMatchObject({ root: projectRoot, version: 1 });
  });
});

describe("runCli doctor", () => {
  it("inspects the environment without loading project config in the command dispatcher", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-doctor-cli-test-"));
    directories.push(root);
    await writeFile(join(root, "drever.config.ts"), "export default {");
    const runDoctor = vi.fn(async () => 1 as const);
    const stdout = { write: vi.fn(() => true) };

    const result = await runCli(["doctor", "--json"], { cwd: root, runDoctor, stdout });

    expect(result).toBe(1);
    expect(runDoctor).toHaveBeenCalledWith({ json: true, root, stdout });
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

describe("runCli mcp", () => {
  it("resolves production authoring config and reserves stdout for protocol messages", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-mcp-cli-test-"));
    directories.push(root);
    await writeFile(join(root, "talk.mdx"), "# MCP deck\n");
    await writeFile(
      join(root, "drever.config.ts"),
      `type Environment = { command: string; mode: string };
export default ({ command, mode }: Environment) => ({
  entry: command === "build" && mode === "production" ? "talk.mdx" : "wrong.mdx",
});
`,
    );
    const input = Readable.from([]);
    const stdout = { write: vi.fn(() => true) };
    const serveMcp = vi.fn(async () => {});

    await runCli(["mcp"], { cwd: root, stdin: input, stdout, serveMcp });

    expect(serveMcp).toHaveBeenCalledWith({
      input,
      output: stdout,
      project: expect.objectContaining({ entry: join(root, "talk.mdx"), root }),
    });
    expect(stdout.write).not.toHaveBeenCalled();
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

    await runCli(["export", "pdf", "--steps", "--slides", "2-5,8"], {
      cwd: root,
      exportPdf,
      stdout: { write: (chunk) => ((output += String(chunk)), true) },
    });

    expect(exportPdf).toHaveBeenCalledOnce();
    expect(exportPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        output: join(root, "talk-export.pdf"),
        project: expect.objectContaining({ entry: join(root, "talk.mdx"), root }),
        slides: [
          { first: 2, last: 5 },
          { first: 8, last: 8 },
        ],
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

  it("returns an exact PDF artifact receipt for agent callers", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-export-cli-test-"));
    directories.push(root);
    await writeFile(join(root, "slides.mdx"), "# Export receipt\n");
    const exportPdf = vi.fn(async () => {});
    let output = "";

    await runCli(["export", "pdf", "--json", "--steps", "--slides", "2-3"], {
      cwd: root,
      exportPdf,
      stdout: { write: (chunk) => ((output += String(chunk)), true) },
    });

    expect(JSON.parse(output)).toEqual({
      artifacts: [
        {
          kind: "pdf",
          path: join(root, "slides-export.pdf"),
          slides: [{ first: 2, last: 3 }],
          steps: true,
        },
      ],
      command: "export",
      ok: true,
      sourcePath: join(root, "slides.mdx"),
      version: 1,
    });
  });
});

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  createAgentDeepLink,
  createDreverProject,
  parseCreateArguments,
  runCreateCommand,
  type CreateProjectResult,
} from "./create-project.ts";

const directories: string[] = [];

const temporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "drever-create-test-"));
  directories.push(directory);
  return directory;
};

const write = async (root: string, path: string, contents: string): Promise<void> => {
  const destination = join(root, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, contents, "utf8");
};

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("create command arguments", () => {
  it("keeps the one-command path minimal while exposing agent and automation controls", () => {
    expect(parseCreateArguments([])).toEqual({
      agent: "all",
      directory: ".",
      help: false,
      install: true,
      json: false,
      name: "create",
    });
    expect(
      parseCreateArguments([
        "investor-update",
        "--agent",
        "claude",
        "--open",
        "claude",
        "--package-manager",
        "pnpm",
        "--no-install",
        "--json",
      ]),
    ).toEqual({
      agent: "claude",
      directory: "investor-update",
      help: false,
      install: false,
      json: true,
      name: "create",
      open: "claude",
      packageManager: "pnpm",
    });
  });

  it.each([
    [["one", "two"], "create accepts at most one project directory."],
    [["--theme", "dark"], "Unknown create flag: --theme"],
    [["--agent", "cursor"], "--agent requires one of: all, auto, claude, codex, none."],
    [["--agent", "codex", "--agent", "claude"], "--agent can be specified only once."],
    [
      ["--agent", "claude", "--open", "codex"],
      "--open codex requires --agent codex or --agent all.",
    ],
    [["--open"], "--open requires one of: claude, codex."],
    [["--package-manager", "deno"], "--package-manager requires one of: bun, npm, pnpm, yarn."],
  ])("rejects ambiguous create arguments: %j", (arguments_, message) => {
    expect(() => parseCreateArguments(arguments_)).toThrowError(
      expect.objectContaining({ code: "DREVER_ARGUMENT_INVALID", message }),
    );
  });
});

describe("project creation", () => {
  it("creates a zero-config deck and both project-local agent adapters", async () => {
    const parent = await temporaryDirectory();
    const root = join(parent, "Product Story");

    const result = await createDreverProject({
      agent: "all",
      dreverVersion: "1.2.3",
      install: false,
      root,
    });

    expect(result).toMatchObject({
      installed: false,
      packageManager: "npm",
      root,
      version: 1,
    });
    await expect(readFile(join(root, "package.json"), "utf8")).resolves.toBe(
      `${JSON.stringify(
        {
          name: "product-story",
          version: "0.0.0",
          private: true,
          type: "module",
          scripts: {
            build: "drever build",
            check: "drever check",
            dev: "drever dev",
            export: "drever export pdf",
          },
          devDependencies: { drever: "1.2.3" },
        },
        null,
        2,
      )}\n`,
    );
    await expect(readFile(join(root, "slides.mdx"), "utf8")).resolves.toContain(
      "What will you make clear?",
    );
    await expect(readFile(join(root, ".gitignore"), "utf8")).resolves.toContain("node_modules");
    await expect(
      readFile(join(root, ".agents/skills/drever-deliver-deck/SKILL.md"), "utf8"),
    ).resolves.toContain("name: drever-deliver-deck");
    await expect(
      readFile(join(root, ".claude/skills/drever-deliver-deck/SKILL.md"), "utf8"),
    ).resolves.toContain("name: drever-deliver-deck");
  });

  it("reports all project-file conflicts before installing agent files", async () => {
    const root = await temporaryDirectory();
    await write(root, "slides.mdx", "# Keep this deck\n");
    await write(root, "README.md", "# Keep this guide\n");

    await expect(
      createDreverProject({
        agent: "all",
        dreverVersion: "1.2.3",
        install: false,
        root,
      }),
    ).rejects.toMatchObject({
      code: "DREVER_CREATE_CONFLICT",
      details: { conflicts: ["README.md", "slides.mdx"] },
    });
    await expect(readFile(join(root, "slides.mdx"), "utf8")).resolves.toBe("# Keep this deck\n");
    await expect(readFile(join(root, "package.json"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(readFile(join(root, "AGENTS.md"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(readFile(join(root, "CLAUDE.md"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("installs and opens only when explicitly requested", async () => {
    const parent = await temporaryDirectory();
    const root = join(parent, "briefing");
    const installDependencies = vi.fn(async () => {});
    const openAgent = vi.fn(async () => {});

    const result = await createDreverProject({
      agent: "codex",
      dreverVersion: "1.2.3",
      install: true,
      installDependencies,
      open: "codex",
      openAgent,
      packageManager: "pnpm",
      quiet: true,
      root,
    });

    expect(installDependencies).toHaveBeenCalledWith({
      packageManager: "pnpm",
      quiet: true,
      root,
    });
    expect(openAgent).toHaveBeenCalledWith("codex", root);
    expect(result).toMatchObject({ installed: true, opened: "codex", packageManager: "pnpm" });
  });

  it("keeps a recoverable project when dependency installation fails", async () => {
    const parent = await temporaryDirectory();
    const root = join(parent, "recoverable");
    const installDependencies = vi.fn(async () => {
      throw new Error("registry unavailable");
    });

    await expect(
      createDreverProject({
        agent: "none",
        dreverVersion: "1.2.3",
        install: true,
        installDependencies,
        packageManager: "npm",
        root,
      }),
    ).rejects.toMatchObject({
      code: "DREVER_CREATE_INSTALL_FAILED",
      details: { packageManager: "npm", root },
      hint: `Run npm install in ${root}.`,
    });
    await expect(readFile(join(root, "package.json"), "utf8")).resolves.toContain(
      '"drever": "1.2.3"',
    );
  });
});

describe("create automation", () => {
  it("uses official deep-link shapes without sending the prompt automatically", () => {
    const codex = new URL(createAgentDeepLink("codex", "/tmp/my deck"));
    expect(codex.protocol).toBe("codex:");
    expect(codex.pathname).toBe("");
    expect(codex.host).toBe("new");
    expect(codex.searchParams.get("path")).toBe("/tmp/my deck");
    expect(codex.searchParams.get("prompt")).toContain("brief.md");

    const claude = new URL(createAgentDeepLink("claude", "/tmp/my deck"));
    expect(claude.protocol).toBe("claude-cli:");
    expect(claude.host).toBe("open");
    expect(claude.searchParams.get("cwd")).toBe("/tmp/my deck");
    expect(claude.searchParams.get("q")).toContain("brief.md");
  });

  it("prints a stable JSON receipt for agent callers", async () => {
    const root = await temporaryDirectory();
    const result: CreateProjectResult = {
      agentFiles: [],
      files: ["package.json", "slides.mdx"],
      installed: false,
      packageManager: "npm",
      root,
      version: 1,
    };
    const createProject = vi.fn(async () => result);
    let output = "";

    await runCreateCommand(parseCreateArguments(["deck", "--json", "--no-install"]), {
      createProject,
      cwd: root,
      stdout: { write: (chunk) => ((output += String(chunk)), true) },
    });

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "all",
        install: false,
        quiet: true,
        root: join(root, "deck"),
      }),
    );
    expect(JSON.parse(output)).toEqual(result);
  });
});

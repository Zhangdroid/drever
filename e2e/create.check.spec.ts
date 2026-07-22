import { execFile } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

const execute = promisify(execFile);
const workspaceRoot = join(import.meta.dirname, "..");
const createCli = join(workspaceRoot, "packages", "create-drever", "dist", "bin.mjs");
const dreverCli = join(workspaceRoot, "packages", "cli", "dist", "bin.mjs");
const environment = { ...process.env };
delete environment.FORCE_COLOR;

const run = (cwd: string, cli: string, ...arguments_: string[]) =>
  execute(process.execPath, [cli, ...arguments_], {
    cwd,
    env: environment,
    timeout: 30_000,
  });

test("a clean consumer can create, validate, and build a presentation", async () => {
  const parent = await realpath(await mkdtemp(join(tmpdir(), "drever-create-e2e-")));
  const root = join(parent, "customer-story");

  try {
    const created = await run(parent, createCli, "customer-story", "--no-install", "--json");
    const receipt = JSON.parse(created.stdout) as {
      files: readonly string[];
      installed: boolean;
      root: string;
      version: number;
    };

    expect(receipt).toMatchObject({
      files: ["package.json", "README.md", "brief.md", "slides.mdx", ".gitignore"],
      installed: false,
      root,
      version: 1,
    });
    await expect(
      readFile(join(root, ".agents/skills/drever-deliver-deck/SKILL.md"), "utf8"),
    ).resolves.toContain("name: drever-deliver-deck");
    await expect(
      readFile(join(root, ".claude/skills/drever-deliver-deck/SKILL.md"), "utf8"),
    ).resolves.toContain("name: drever-deliver-deck");

    const checked = await run(root, dreverCli, "check", "--json");
    expect(JSON.parse(checked.stdout)).toMatchObject({
      slideCount: 1,
      summary: { errors: 0, warnings: 0 },
    });

    const built = await run(root, dreverCli, "build");
    expect(built.stdout).toContain(`Built ${join(root, "slides.mdx")} to ${join(root, "dist")}`);
    await expect(stat(join(root, "dist", "index.html"))).resolves.toMatchObject({
      size: expect.any(Number),
    });
  } finally {
    await rm(parent, { force: true, recursive: true });
  }
});

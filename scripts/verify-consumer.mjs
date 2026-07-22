import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const packageRoots = [join(root, "packages"), join(root, "plugins")];
const temporaryRoot = await realpath(await mkdtemp(join(tmpdir(), "drever-consumer-")));
const packsRoot = join(temporaryRoot, "packs");
const consumerRoot = join(temporaryRoot, "consumer");
const deckRoot = join(consumerRoot, "customer-story");

const run = (command, arguments_, cwd, timeout = 120_000) =>
  execute(command, arguments_, {
    cwd,
    env: { ...process.env, CI: "true", FORCE_COLOR: "0" },
    maxBuffer: 10 * 1024 * 1024,
    timeout,
  });

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const publicPackages = (
  await Promise.all(
    packageRoots.map(async (packageRoot) =>
      Promise.all(
        (await readdir(packageRoot, { withFileTypes: true }))
          .filter((entry) => entry.isDirectory())
          .map(async (entry) => ({
            directory: join(packageRoot, entry.name),
            manifest: await readJson(join(packageRoot, entry.name, "package.json")),
          })),
      ),
    ),
  )
)
  .flat()
  .filter(({ manifest }) => manifest.private !== true);

try {
  await mkdir(packsRoot, { recursive: true });
  const tarballs = new Map();
  for (const { directory, manifest } of publicPackages) {
    const { stdout } = await run("pnpm", ["pack", "--pack-destination", packsRoot], directory);
    const path = stdout.trim().split("\n").at(-1);
    if (path === undefined || !path.endsWith(".tgz")) {
      throw new Error(`Could not locate the packed tarball for ${manifest.name}.`);
    }
    tarballs.set(manifest.name, path);
  }

  const overrides = Object.fromEntries([...tarballs].map(([name, path]) => [name, `file:${path}`]));
  const { stdout: storeOutput } = await run("vp", ["exec", "pnpm", "store", "path"], root);
  const store = storeOutput.trim();
  await mkdir(consumerRoot, { recursive: true });
  await writeFile(
    join(consumerRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "drever-clean-consumer",
        private: true,
        version: "0.0.0",
        type: "module",
        dependencies: {
          "@drever/agent": overrides["@drever/agent"],
          "create-drever": overrides["create-drever"],
          drever: overrides.drever,
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    join(consumerRoot, "pnpm-workspace.yaml"),
    [
      'packages: ["."]',
      "overrides:",
      ...Object.entries(overrides).map(
        ([name, path]) => `  ${JSON.stringify(name)}: ${JSON.stringify(path)}`,
      ),
      "",
    ].join("\n"),
  );
  await run(
    "vp",
    ["exec", "pnpm", "install", "--no-frozen-lockfile", "--store-dir", store],
    consumerRoot,
  );

  const createCli = join(consumerRoot, "node_modules", "create-drever", "dist", "bin.mjs");
  const dreverCli = join(consumerRoot, "node_modules", "drever", "dist", "bin.mjs");
  const agentPlugin = join(consumerRoot, "node_modules", "@drever", "agent");
  const [codexPlugin, claudePlugin, canonicalSkill, packagedSkill] = await Promise.all([
    readJson(join(agentPlugin, ".codex-plugin", "plugin.json")),
    readJson(join(agentPlugin, ".claude-plugin", "plugin.json")),
    readFile(
      join(root, "packages", "cli", "agent-kit", "skills", "drever-create-deck", "SKILL.md"),
      "utf8",
    ),
    readFile(join(agentPlugin, "skills", "drever-create-deck", "SKILL.md"), "utf8"),
  ]);
  if (
    codexPlugin.name !== "drever" ||
    claudePlugin.name !== "drever" ||
    codexPlugin.version !== claudePlugin.version ||
    canonicalSkill !== packagedSkill
  ) {
    throw new Error("The packed @drever/agent plugin is incomplete or out of sync.");
  }
  const created = await run(
    process.execPath,
    [createCli, "customer-story", "--no-install", "--json"],
    consumerRoot,
  );
  const createReceipt = JSON.parse(created.stdout);
  if (createReceipt.root !== deckRoot || createReceipt.version !== 1) {
    throw new Error("The packed create-drever binary returned an invalid receipt.");
  }

  const checked = await run(process.execPath, [dreverCli, "check", "--json"], deckRoot);
  const checkReceipt = JSON.parse(checked.stdout);
  if (checkReceipt.summary?.errors !== 0 || checkReceipt.slideCount !== 1) {
    throw new Error("The packed Drever CLI did not validate the generated deck.");
  }

  const built = await run(process.execPath, [dreverCli, "build", "--json"], deckRoot);
  const buildReceipt = JSON.parse(built.stdout);
  if (buildReceipt.artifacts?.[0]?.path !== join(deckRoot, "dist")) {
    throw new Error("The packed Drever CLI returned an invalid build receipt.");
  }
  await stat(join(deckRoot, "dist", "index.html"));

  process.stdout.write(
    `Verified packed create, check, and build flows across ${publicPackages.length} packages.\n`,
  );
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}

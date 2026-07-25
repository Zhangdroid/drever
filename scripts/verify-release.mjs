import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { repositoryUrl, runtimeVersionFiles } from "./release.mjs";

const execute = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const packageRoots = [join(root, "packages"), join(root, "plugins")];
const canonicalSkillRoot = join(root, "packages", "cli", "agent-kit", "skills");

const fail = (message) => {
  throw new Error(`Release verification failed: ${message}`);
};

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const listFiles = async (directory, current = directory) => {
  const entries = await readdir(current, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => {
        const path = join(current, entry.name);
        if (entry.isDirectory()) return listFiles(directory, path);
        if (!entry.isFile()) fail(`skill tree contains a non-regular file at ${path}.`);
        return [relative(directory, path).split(sep).join("/")];
      }),
  );
  return files.flat();
};
const canonicalSkillFiles = await listFiles(canonicalSkillRoot);
const packages = (
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
).flat();
const publicPackages = packages.filter(({ manifest }) => manifest.private !== true);
const versions = new Set(publicPackages.map(({ manifest }) => manifest.version));

if (versions.size !== 1) {
  fail(
    `public packages must use one lockstep version, found ${[...versions].sort((left, right) => left.localeCompare(right)).join(", ")}.`,
  );
}
const [version] = versions;
for (const { directory, manifest } of publicPackages) {
  if (typeof manifest.description !== "string" || manifest.description.length === 0) {
    fail(`${manifest.name ?? directory} needs a package description.`);
  }
  if (manifest.license !== "MIT") {
    fail(`${manifest.name ?? directory} must declare the MIT license.`);
  }
  const packageDirectory = relative(root, directory).split(sep).join("/");
  if (
    manifest.repository?.url !== repositoryUrl ||
    manifest.repository?.directory !== packageDirectory
  ) {
    fail(`${manifest.name ?? directory} must link to its directory in the Drever repository.`);
  }
}

for (const path of runtimeVersionFiles) {
  const source = await readFile(join(root, path), "utf8");
  const runtimeVersion = source.match(/\n\s*version:\s*"([^"]+)"/u)?.[1];
  if (runtimeVersion !== version) fail(`${path} must declare release version ${version}.`);
}

const packageByName = (name) => {
  const value = publicPackages.find(({ manifest }) => manifest.name === name);
  if (value === undefined) {
    return fail(`missing public package ${name}.`);
  }
  return value;
};

const agentPackage = packageByName("@drever/agent");
const [codexPlugin, claudePlugin, claudeMarketplace] = await Promise.all([
  readJson(join(agentPackage.directory, ".codex-plugin", "plugin.json")),
  readJson(join(agentPackage.directory, ".claude-plugin", "plugin.json")),
  readJson(join(root, ".claude-plugin", "marketplace.json")),
]);
const claudeMarketplacePlugin = claudeMarketplace.plugins?.find(({ name }) => name === "drever");
for (const [label, manifest] of [
  ["Codex plugin", codexPlugin],
  ["Claude plugin", claudePlugin],
  ["Claude marketplace", claudeMarketplacePlugin],
]) {
  if (manifest?.version !== agentPackage.manifest.version) {
    fail(`${label} version must match @drever/agent.`);
  }
}

const npmCache = await mkdtemp(join(tmpdir(), "drever-npm-cache-"));
const verifyPackedFiles = async (name, requiredFiles) => {
  const { directory } = packageByName(name);
  const { stdout } = await execute("npm", ["pack", "--dry-run", "--json"], {
    cwd: directory,
    env: { ...process.env, npm_config_cache: npmCache },
  });
  const [result] = JSON.parse(stdout);
  const files = new Set(result.files.map(({ path }) => path));
  for (const path of requiredFiles) {
    if (!files.has(path)) {
      fail(`${name} tarball is missing ${path}.`);
    }
  }
};

try {
  await verifyPackedFiles("drever", [
    ...canonicalSkillFiles.map((path) => `agent-kit/skills/${path}`),
    "create-template/gitignore",
    "create-template/slides.mdx",
    "dist/bin.mjs",
    "dist/create.mjs",
    "dist/runtime.d.mts",
    "dist/runtime.mjs",
  ]);
  await verifyPackedFiles("create-drever", ["README.md", "dist/bin.mjs"]);
  await verifyPackedFiles("@drever/designs", [
    "dist/atlas-layouts.d.mts",
    "dist/atlas-layouts.mjs",
    "dist/atlas.d.mts",
    "dist/atlas.mjs",
    "dist/cinema-layouts.d.mts",
    "dist/cinema-layouts.mjs",
    "dist/cinema.d.mts",
    "dist/cinema.mjs",
    "dist/construct-layouts.d.mts",
    "dist/construct-layouts.mjs",
    "dist/construct.d.mts",
    "dist/construct.mjs",
    "dist/default-layouts.d.mts",
    "dist/default-layouts.mjs",
    "dist/default.d.mts",
    "dist/default.mjs",
    "dist/editorial-layouts.d.mts",
    "dist/editorial-layouts.mjs",
    "dist/editorial.d.mts",
    "dist/editorial.mjs",
    "dist/fieldnote-layouts.d.mts",
    "dist/fieldnote-layouts.mjs",
    "dist/fieldnote.d.mts",
    "dist/fieldnote.mjs",
    "dist/index.d.mts",
    "dist/index.mjs",
    "dist/ledger-layouts.d.mts",
    "dist/ledger-layouts.mjs",
    "dist/ledger.d.mts",
    "dist/ledger.mjs",
    "dist/studio-layouts.d.mts",
    "dist/studio-layouts.mjs",
    "dist/studio.d.mts",
    "dist/studio.mjs",
    "themes/atlas/theme.css",
    "themes/cinema/theme.css",
    "themes/construct/theme.css",
    "themes/default/theme.css",
    "themes/editorial/theme.css",
    "themes/fieldnote/fonts/Caveat[wght].ttf",
    "themes/fieldnote/fonts/OFL.txt",
    "themes/fieldnote/fonts/README.md",
    "themes/fieldnote/theme.css",
    "themes/ledger/theme.css",
    "themes/studio/theme.css",
  ]);
  await verifyPackedFiles("@drever/agent", [
    ".claude-plugin/plugin.json",
    ".codex-plugin/plugin.json",
    ...canonicalSkillFiles.map((path) => `skills/${path}`),
  ]);
} finally {
  await rm(npmCache, { force: true, recursive: true });
}

process.stdout.write(`Verified ${publicPackages.length} public packages at version ${version}.\n`);

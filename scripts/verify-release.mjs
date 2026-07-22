import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const packagesRoot = join(root, "packages");

const fail = (message) => {
  throw new Error(`Release verification failed: ${message}`);
};

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const directories = await readdir(packagesRoot, { withFileTypes: true });
const packages = await Promise.all(
  directories
    .filter((entry) => entry.isDirectory())
    .map(async (entry) => ({
      directory: join(packagesRoot, entry.name),
      manifest: await readJson(join(packagesRoot, entry.name, "package.json")),
    })),
);
const publicPackages = packages.filter(({ manifest }) => manifest.private !== true);
const versions = new Set(publicPackages.map(({ manifest }) => manifest.version));

if (versions.size !== 1) {
  fail(
    `public packages must use one lockstep version, found ${[...versions].sort((left, right) => left.localeCompare(right)).join(", ")}.`,
  );
}
for (const { directory, manifest } of publicPackages) {
  if (typeof manifest.description !== "string" || manifest.description.length === 0) {
    fail(`${manifest.name ?? directory} needs a package description.`);
  }
  if (manifest.license !== "MIT") {
    fail(`${manifest.name ?? directory} must declare the MIT license.`);
  }
}

const packageByName = (name) => {
  const value = publicPackages.find(({ manifest }) => manifest.name === name);
  if (value === undefined) {
    return fail(`missing public package ${name}.`);
  }
  return value;
};

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
    "agent-kit/skills/drever-deliver-deck/SKILL.md",
    "create-template/gitignore",
    "create-template/slides.mdx",
    "dist/bin.mjs",
    "dist/create.mjs",
  ]);
  await verifyPackedFiles("create-drever", ["README.md", "dist/bin.mjs"]);
} finally {
  await rm(npmCache, { force: true, recursive: true });
}

process.stdout.write(
  `Verified ${publicPackages.length} public packages at version ${[...versions][0]}.\n`,
);

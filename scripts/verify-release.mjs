import { readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { readPublicPackages, readRuntimeVersionFiles, repositoryUrl } from "./release.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

const fail = (message) => {
  throw new Error(`Release verification failed: ${message}`);
};

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const publicPackages = await readPublicPackages(root);
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

for (const path of await readRuntimeVersionFiles(root)) {
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

process.stdout.write(`Verified ${publicPackages.length} public packages at version ${version}.\n`);

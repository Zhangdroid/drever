import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { copyReleaseSmokeArtifactSeed, copyReleaseSmokeHandoff } from "./contract.mjs";

const [quarantineArgument, projectArgument, artifactArgument] = process.argv.slice(2);
if (
  quarantineArgument === undefined ||
  projectArgument === undefined ||
  artifactArgument === undefined
) {
  throw new Error(
    "Usage: node scripts/release-smoke/activate-handoff.mjs <quarantine> <project> <artifact>",
  );
}

const quarantineRoot = resolve(quarantineArgument);
const projectRoot = resolve(projectArgument);
const artifactRoot = resolve(artifactArgument);
await Promise.all([
  copyReleaseSmokeHandoff(join(quarantineRoot, "project"), projectRoot, {
    includePrivate: true,
  }),
  copyReleaseSmokeArtifactSeed(join(quarantineRoot, "artifact"), artifactRoot),
]);
await rm(quarantineRoot, { force: true, recursive: true });

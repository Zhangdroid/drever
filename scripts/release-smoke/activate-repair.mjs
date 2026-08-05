import { lstat, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import {
  assertReleaseSmokeSourceReceipt,
  collectReleaseSmokeSource,
  copyReleaseSmokeArtifactSeed,
  copyReleaseSmokeHandoff,
  copyReleaseSmokeSource,
  copyReleaseSmokeVisualEvidence,
  json,
} from "./contract.mjs";
import { getReleaseSmokeProvider } from "./providers.mjs";

const [
  providerId,
  quarantineArgument,
  originalGeneratedArgument,
  projectArgument,
  artifactArgument,
  validationArgument,
] = process.argv.slice(2);
if (
  providerId === undefined ||
  quarantineArgument === undefined ||
  originalGeneratedArgument === undefined ||
  projectArgument === undefined ||
  artifactArgument === undefined ||
  validationArgument === undefined
) {
  throw new Error(
    "Usage: node scripts/release-smoke/activate-repair.mjs <provider> <prepared-quarantine> <original-generated> <project> <artifact> <validation>",
  );
}

const provider = getReleaseSmokeProvider(providerId);
const quarantineRoot = resolve(quarantineArgument);
const originalGeneratedRoot = resolve(originalGeneratedArgument);
const projectRoot = resolve(projectArgument);
const artifactRoot = resolve(artifactArgument);
const validationRoot = resolve(validationArgument);
const validatedSourceRoot = resolve(
  dirname(projectRoot),
  `.validated-repair-source-${provider.id}`,
);
const roots = [quarantineRoot, originalGeneratedRoot, projectRoot, artifactRoot, validationRoot];
for (const [index, root] of roots.entries()) {
  if (
    roots.some(
      (candidate, candidateIndex) =>
        candidateIndex !== index &&
        (candidate === root ||
          candidate.startsWith(`${root}${sep}`) ||
          root.startsWith(`${candidate}${sep}`)),
    )
  ) {
    throw new Error("Release smoke repair roots must be separate.");
  }
}

const readMetadata = async (path) => {
  const absolutePath = join(originalGeneratedRoot, path);
  const metadata = await lstat(absolutePath);
  if (!metadata.isFile() || metadata.size === 0 || metadata.size > 1_000_000) {
    throw new Error(`Release smoke repair metadata is invalid: ${path}`);
  }
  return JSON.parse(await readFile(absolutePath, "utf8"));
};

const [prompt, transcript, generation] = await Promise.all([
  readMetadata("prompt.json"),
  readMetadata("transcript.json"),
  readMetadata("generation.json"),
]);
if (
  prompt?.schemaVersion !== 1 ||
  prompt.providerId !== provider.id ||
  transcript?.schemaVersion !== 1 ||
  transcript.providerId !== provider.id ||
  !Array.isArray(transcript.messages) ||
  !Array.isArray(transcript.usage) ||
  generation?.schemaVersion !== 1 ||
  generation.provider?.id !== provider.id ||
  generation.scenarioId !== transcript.scenarioId ||
  typeof generation.version !== "string" ||
  generation.version === "" ||
  typeof generation.model !== "string" ||
  generation.model === "" ||
  generation.visualReview !== undefined ||
  (generation.repair !== undefined && generation.repair?.kind !== "mechanical-repair")
) {
  throw new Error("Release smoke repair metadata does not describe one original generation.");
}

try {
  await Promise.all([
    copyReleaseSmokeHandoff(join(quarantineRoot, "project"), projectRoot, {
      includePrivate: true,
      providerId,
    }),
    copyReleaseSmokeArtifactSeed(join(quarantineRoot, "artifact"), artifactRoot),
    rm(validatedSourceRoot, { force: true, recursive: true }),
  ]);
  await copyReleaseSmokeVisualEvidence(join(validationRoot, "visual-evidence"), projectRoot);
  const collectedSource = await collectReleaseSmokeSource(
    join(originalGeneratedRoot, "source"),
    validatedSourceRoot,
  );
  assertReleaseSmokeSourceReceipt(
    generation.source,
    collectedSource,
    "Release smoke refinement seed",
  );
  await copyReleaseSmokeSource(validatedSourceRoot, projectRoot);
  await Promise.all([
    writeFile(join(artifactRoot, "prompt.json"), json(prompt), "utf8"),
    writeFile(join(artifactRoot, "transcript.json"), json(transcript), "utf8"),
    writeFile(join(artifactRoot, "generation.json"), json(generation), "utf8"),
  ]);
} finally {
  await Promise.all([
    rm(quarantineRoot, { force: true, recursive: true }),
    rm(validatedSourceRoot, { force: true, recursive: true }),
  ]);
}

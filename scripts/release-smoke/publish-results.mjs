import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { assertReleaseVersion } from "../release.mjs";
import {
  json,
  mergeReleaseSmokeManifest,
  readOptionalJson,
  releaseSmokeVisualReviewProvenance,
  RELEASE_SMOKE_RUN_SCHEMA_VERSION,
  RELEASE_SMOKE_SCHEMA_VERSION,
  RELEASE_SMOKE_VISUAL_REVIEW_RECEIPT,
} from "./contract.mjs";
import { releaseSmokeCaseId, releaseSmokeProviders } from "./providers.mjs";
import { releaseSmokeScenarios } from "./scenarios.mjs";

const [
  version,
  runId,
  releaseCommit,
  repository,
  resultsArgument,
  websiteArgument,
  previewBranch,
  resultKind,
  harnessCommit,
  bodyArgument,
] = process.argv.slice(2);
if (
  version === undefined ||
  runId === undefined ||
  releaseCommit === undefined ||
  repository === undefined ||
  resultsArgument === undefined ||
  websiteArgument === undefined ||
  previewBranch === undefined ||
  resultKind === undefined ||
  harnessCommit === undefined ||
  bodyArgument === undefined
) {
  throw new Error(
    "Usage: node scripts/release-smoke/publish-results.mjs <version> <run-id> <release-commit> <repository> <results> <website-root> <preview-branch> <result-kind> <harness-commit> <summary>",
  );
}
assertReleaseVersion(version);
if (!/^\d+$/u.test(runId)) throw new Error(`Invalid GitHub Actions run id: ${runId}`);
if (!/^[0-9a-f]{40}$/u.test(releaseCommit)) {
  throw new Error(`Invalid release source commit: ${releaseCommit}`);
}
if (!/^[0-9a-f]{40}$/u.test(harnessCommit)) {
  throw new Error(`Invalid release smoke harness commit: ${harnessCommit}`);
}
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) {
  throw new Error(`Invalid GitHub repository: ${repository}`);
}
if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(previewBranch)) {
  throw new Error(`Invalid preview branch: ${previewBranch}`);
}
if (resultKind !== "preview" && resultKind !== "release") {
  throw new Error(`Invalid release smoke result kind: ${resultKind}`);
}

const resultsRoot = resolve(resultsArgument);
const websiteRoot = resolve(websiteArgument);
const bodyPath = resolve(bodyArgument);
const publicRoot = join(websiteRoot, "public", "release-smoke");
const publicRunRoot = join(publicRoot, "runs", runId);
const workflowUrl =
  resultKind === "preview"
    ? `https://github.com/${repository}/tree/${harnessCommit}`
    : `https://github.com/${repository}/actions/runs/${runId}`;
const releaseUrl = `https://github.com/${repository}/releases/tag/v${version}`;
const previewAlias = previewBranch
  .toLowerCase()
  .replaceAll(/[^a-z0-9-]+/gu, "-")
  .replaceAll(/^-+|-+$/gu, "");
if (previewAlias === "") throw new Error(`Invalid preview branch alias: ${previewBranch}`);
const previewOrigin = `https://${previewAlias}.drever-release-smoke.pages.dev`;
const deckContentSecurityPolicy = [
  "default-src 'none'",
  "base-uri 'self'",
  "connect-src 'none'",
  "font-src 'self' data:",
  "form-action 'none'",
  "frame-src 'none'",
  "img-src 'self' data: blob:",
  "media-src 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'none'",
].join("; ");
const publishedDeck = (deck) => ({
  audience: `${previewOrigin}${deck.audience}`,
  document: `${previewOrigin}${deck.document}`,
  source: `${previewOrigin}${deck.source}`,
});
const hardenDeckDocuments = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await hardenDeckDocuments(path);
        return;
      }
      if (!entry.isFile() || !entry.name.endsWith(".html")) return;
      const source = await readFile(path, "utf8");
      if (!source.includes("<head>")) {
        throw new Error(`Built deck document has no head element: ${path}`);
      }
      const security = `<meta http-equiv="Content-Security-Policy" content="${deckContentSecurityPolicy}" />
    <meta name="robots" content="noindex, nofollow" />`;
      const hardened = source
        .replaceAll(/[ \t]+$/gmu, "")
        .replace("<head>", `<head>\n    ${security}`);
      await writeFile(path, hardened, "utf8");
    }),
  );
};

const cases = await Promise.all(
  releaseSmokeProviders.flatMap((provider) =>
    releaseSmokeScenarios.map(async (scenario) => {
      const id = releaseSmokeCaseId(provider.id, scenario.id);
      const source = join(resultsRoot, id);
      const [value, generation] = await Promise.all([
        readFile(join(source, "case.json"), "utf8").then(JSON.parse),
        readFile(join(source, "generation.json"), "utf8").then(JSON.parse),
      ]);
      const visualReview = releaseSmokeVisualReviewProvenance(generation);
      if (
        value.schemaVersion !== RELEASE_SMOKE_RUN_SCHEMA_VERSION ||
        value.id !== id ||
        value.scenarioId !== scenario.id ||
        value.provider?.id !== provider.id ||
        value.provider?.label !== provider.label ||
        value.provider?.model !== provider.model ||
        value.version !== version ||
        value.sourceCommit !== releaseCommit ||
        generation?.schemaVersion !== RELEASE_SMOKE_SCHEMA_VERSION ||
        generation.version !== version ||
        generation.provider?.id !== provider.id ||
        generation.scenarioId !== scenario.id ||
        value.status !== "passed" ||
        !Array.isArray(value.checks) ||
        !value.checks.includes(RELEASE_SMOKE_VISUAL_REVIEW_RECEIPT) ||
        JSON.stringify(value.visualReview) !== JSON.stringify(visualReview)
      ) {
        throw new Error(`Built result does not match release smoke case: ${id}`);
      }
      return { source, value };
    }),
  ),
);
const [firstCase] = cases;
if (firstCase === undefined) throw new Error("Release smoke results contain no cases.");
for (const { value } of cases.slice(1)) {
  if (value.nodeVersion !== firstCase.value.nodeVersion) {
    throw new Error("Release smoke cases were not generated with the same Node.js contract.");
  }
}
for (const provider of releaseSmokeProviders) {
  const providerCases = cases.filter(({ value }) => value.provider.id === provider.id);
  const [providerCase] = providerCases;
  if (
    providerCase === undefined ||
    providerCases.some(
      ({ value }) =>
        value.provider.model !== providerCase.value.provider.model ||
        value.provider.version !== providerCase.value.provider.version,
    )
  ) {
    throw new Error(`Release smoke ${provider.label} cases used different runner contracts.`);
  }
}

await rm(publicRunRoot, { force: true, recursive: true });
await mkdir(publicRunRoot, { recursive: true });
for (const { source, value } of cases) {
  const destination = join(publicRunRoot, value.id);
  await cp(source, destination, { recursive: true });
  await hardenDeckDocuments(join(destination, "deck"));
  await writeFile(
    join(destination, "case.json"),
    json({ ...value, deck: publishedDeck(value.deck) }),
    "utf8",
  );
}

const generatedAt = cases
  .map(({ value }) => value.generatedAt)
  .sort((left, right) => left.localeCompare(right))
  .at(-1);
const run = {
  schemaVersion: RELEASE_SMOKE_RUN_SCHEMA_VERSION,
  id: runId,
  kind: resultKind,
  generatedAt,
  release: {
    version,
    commit: releaseCommit,
    url: releaseUrl,
  },
  harness: {
    commit: harnessCommit,
    url: `https://github.com/${repository}/tree/${harnessCommit}`,
  },
  runner: {
    nodeVersion: firstCase.value.nodeVersion,
    promptUrl: "https://drever.dev/prompt.md",
    workflowUrl,
  },
  cases: cases.map(({ value }) => ({
    brief: value.brief,
    checks: value.checks,
    deck: publishedDeck(value.deck),
    durationSeconds: value.durationSeconds,
    id: value.id,
    messages: value.messages,
    mode: value.mode,
    provider: value.provider,
    scenarioId: value.scenarioId,
    status: value.status,
    title: value.title,
  })),
};
await writeFile(join(publicRunRoot, "run.json"), json(run), "utf8");

const publicManifestPath = join(publicRoot, "manifest.json");
const previousPublicManifest = await readOptionalJson(publicManifestPath, {
  schemaVersion: RELEASE_SMOKE_SCHEMA_VERSION,
  latestRunId: runId,
  runs: [],
});
const publicManifest = mergeReleaseSmokeManifest(previousPublicManifest, {
  id: runId,
  generatedAt,
  transcript: `/release-smoke/runs/${runId}/run.json`,
  version,
});
await writeFile(publicManifestPath, json(publicManifest), "utf8");

const retainedIds = new Set(publicManifest.runs.map((entry) => entry.id));
const removedIds = (previousPublicManifest.runs ?? [])
  .map((entry) => entry?.id)
  .filter(
    (id) => typeof id === "string" && /^[a-z0-9][a-z0-9._-]*$/u.test(id) && !retainedIds.has(id),
  );
await Promise.all(
  removedIds.map((id) => rm(join(publicRoot, "runs", id), { force: true, recursive: true })),
);

const deckLinks = cases
  .map(
    ({ value }) =>
      `- [${value.provider.label} · ${value.title} interactive deck](${previewOrigin}${value.deck.audience}index.html)`,
  )
  .join("\n");
const heading =
  resultKind === "preview"
    ? `AI creation preview · Drever ${version}`
    : `AI release smoke · Drever ${version}`;
const summary =
  resultKind === "preview"
    ? `This owner-authorized pull request proof records four real, multi-turn
creation journeys from Codex and Claude against the exact published package. The generation
harness came from commit \`${harnessCommit}\`; Drever ${version} came from
release commit \`${releaseCommit}\`.`
    : `This direct-upload review deployment compares four real, multi-turn creation journeys
from Codex and Claude against the exact published package.`;
const provenanceLink =
  resultKind === "preview"
    ? `- [Immutable harness source](${workflowUrl})`
    : `- [Workflow run](${workflowUrl})`;
const validationSummary =
  resultKind === "preview"
    ? `Generated source crossed an allowlist boundary before a separate local
validation process—without either provider key—installed, checked, built, and
opened every live surface in Chromium. Settled and transition evidence from
that pre-refinement source was then supplied to one bounded provider turn. The
resulting source passed a fresh keyless rebuild.`
    : `Generated source crossed an allowlist boundary before a separate
job—without either provider secret—installed, checked, built, and opened every live
surface in Chromium. One bounded provider turn then received settled and
transition evidence from that pre-refinement source. The resulting source then
passed a fresh keyless rebuild.`;
await mkdir(dirname(bodyPath), { recursive: true });
await writeFile(
  bodyPath,
  `## ${heading}

${summary}

${validationSummary}

${deckLinks}
- [Conversation and verification report](${previewOrigin}/release-smoke/)
${provenanceLink}

Each linked deck is the production static build itself. Screenshots and PDFs
are not published. Bounded contact sheets may be retained temporarily as
internal validation evidence in 30-day workflow artifacts, but are not copied
to Pages or the public report. Raw model reasoning and command streams are not
published; the site receives only the sanitized user/assistant transcript and
structured receipts. No generated smoke evidence is committed to the repository.
`,
  "utf8",
);

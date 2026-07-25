import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { assertReleaseVersion } from "../release.mjs";
import {
  json,
  mergeReleaseSmokeManifest,
  readOptionalJson,
  RELEASE_SMOKE_SCHEMA_VERSION,
} from "./contract.mjs";
import { releaseSmokeScenarios } from "./scenarios.mjs";

const [
  version,
  runId,
  releaseCommit,
  repository,
  resultsArgument,
  repositoryArgument,
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
  repositoryArgument === undefined ||
  previewBranch === undefined ||
  resultKind === undefined ||
  harnessCommit === undefined ||
  bodyArgument === undefined
) {
  throw new Error(
    "Usage: node scripts/release-smoke/publish-results.mjs <version> <run-id> <release-commit> <repository> <results> <repository-root> <preview-branch> <result-kind> <harness-commit> <pr-body>",
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
const repositoryRoot = resolve(repositoryArgument);
const bodyPath = resolve(bodyArgument);
const contentRoot = join(repositoryRoot, "website", "content", "release-smoke");
const publicRoot = join(repositoryRoot, "website", "public", "release-smoke");
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
const previewOrigin = `https://${previewAlias}.drever-website.pages.dev`;
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
  releaseSmokeScenarios.map(async (scenario) => {
    const source = join(resultsRoot, scenario.id);
    const value = JSON.parse(await readFile(join(source, "case.json"), "utf8"));
    if (
      value.schemaVersion !== RELEASE_SMOKE_SCHEMA_VERSION ||
      value.id !== scenario.id ||
      value.version !== version ||
      value.sourceCommit !== releaseCommit ||
      value.status !== "passed"
    ) {
      throw new Error(`Built result does not match release smoke case: ${scenario.id}`);
    }
    return { source, value };
  }),
);
const [firstCase] = cases;
if (firstCase === undefined) throw new Error("Release smoke results contain no cases.");
for (const { value } of cases.slice(1)) {
  if (
    value.runner.model !== firstCase.value.runner.model ||
    value.runner.codexVersion !== firstCase.value.runner.codexVersion ||
    value.runner.nodeVersion !== firstCase.value.runner.nodeVersion
  ) {
    throw new Error("Release smoke cases were not generated by the same runner contract.");
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
  schemaVersion: RELEASE_SMOKE_SCHEMA_VERSION,
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
    model: firstCase.value.runner.model,
    codexVersion: firstCase.value.runner.codexVersion,
    nodeVersion: firstCase.value.runner.nodeVersion,
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
    status: value.status,
    title: value.title,
  })),
};
await mkdir(join(contentRoot, "runs"), { recursive: true });
await Promise.all([
  writeFile(join(contentRoot, "runs", `${runId}.json`), json(run), "utf8"),
  writeFile(join(publicRunRoot, "run.json"), json(run), "utf8"),
]);

const contentManifestPath = join(contentRoot, "manifest.json");
const previousContentManifest = await readOptionalJson(contentManifestPath, {
  schemaVersion: RELEASE_SMOKE_SCHEMA_VERSION,
  latestRunId: runId,
  runs: [],
});
const contentManifest = mergeReleaseSmokeManifest(previousContentManifest, {
  id: runId,
  transcript: `${runId}.json`,
});
await writeFile(contentManifestPath, json(contentManifest), "utf8");

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

const retainedIds = new Set(contentManifest.runs.map((entry) => entry.id));
const removedIds = (previousContentManifest.runs ?? [])
  .map((entry) => entry?.id)
  .filter(
    (id) => typeof id === "string" && /^[a-z0-9][a-z0-9._-]*$/u.test(id) && !retainedIds.has(id),
  );
await Promise.all(
  removedIds.flatMap((id) => [
    rm(join(contentRoot, "runs", `${id}.json`), { force: true }),
    rm(join(publicRoot, "runs", id), { force: true, recursive: true }),
  ]),
);

const deckLinks = cases
  .map(
    ({ value }) =>
      `- [${value.title} interactive deck](${previewOrigin}${value.deck.audience}index.html)`,
  )
  .join("\n");
const heading =
  resultKind === "preview"
    ? `AI creation preview · Drever ${version}`
    : `AI release smoke · Drever ${version}`;
const summary =
  resultKind === "preview"
    ? `This owner-authorized pull request proof records two real, multi-turn
Codex creation journeys against the exact published package. The generation
harness came from commit \`${harnessCommit}\`; Drever ${version} came from
release commit \`${releaseCommit}\`.`
    : `This automated PR records two real, multi-turn Codex creation journeys against
the exact published package.`;
const provenanceLink =
  resultKind === "preview"
    ? `- [Immutable harness source](${workflowUrl})`
    : `- [Workflow run](${workflowUrl})`;
const validationSummary =
  resultKind === "preview"
    ? `Generated source crossed an allowlist boundary before a separate local
validation process—without an OpenAI API key—installed, checked, built, and
opened every live surface in Chromium.`
    : `Generated source crossed an allowlist boundary before a separate
job—without the OpenAI secret—installed, checked, built, and opened every live
surface in Chromium.`;
await mkdir(dirname(bodyPath), { recursive: true });
await writeFile(
  bodyPath,
  `## ${heading}

${summary}

${validationSummary}

${deckLinks}
- [Conversation and verification report](${previewOrigin}/release-smoke/)
${provenanceLink}

No screenshots or PDFs are stored. Each linked deck is the production static
build itself. Raw model reasoning and command streams are not published; the
site receives only the sanitized user/assistant transcript and structured
receipts.
`,
  "utf8",
);

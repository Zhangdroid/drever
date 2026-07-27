import { mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import {
  json,
  RELEASE_SMOKE_RUN_SCHEMA_VERSION,
  RELEASE_SMOKE_SCHEMA_VERSION,
} from "./contract.mjs";

export const RELEASE_SMOKE_HISTORY_LIMIT = 10;
export const RELEASE_SMOKE_MANIFEST_BYTES = 64 * 1024;
export const RELEASE_SMOKE_RUN_BYTES = 512 * 1024;
export const RELEASE_SMOKE_SOURCE_RUN_LIMIT = 25;

const releaseSmokeRunId = /^[a-z0-9][a-z0-9._-]*$/u;
const immutablePagesHost = /^[0-9a-f]{8}\.(?:drever-release-smoke|drever-website)\.pages\.dev$/u;

const expectRecord = (value, context) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }
  return value;
};

const expectString = (value, context) => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${context} must be a non-empty string.`);
  }
  return value;
};

const expectTimestamp = (value, context) => {
  const timestamp = expectString(value, context);
  if (Number.isNaN(Date.parse(timestamp))) throw new Error(`${context} must be an ISO timestamp.`);
  return timestamp;
};

export const releaseSmokeHistoryOrigin = (value) => {
  const origin = new URL(value);
  if (
    origin.protocol !== "https:" ||
    origin.username !== "" ||
    origin.password !== "" ||
    origin.port !== "" ||
    origin.pathname !== "/" ||
    origin.search !== "" ||
    origin.hash !== "" ||
    !(
      origin.hostname === "drever-release-smoke.pages.dev" ||
      immutablePagesHost.test(origin.hostname)
    )
  ) {
    throw new Error(`Invalid release smoke Pages origin: ${value}`);
  }
  return origin.origin;
};

const readBoundedResponse = async (response, limit, context) => {
  if (!response.ok) {
    throw new Error(`${context} returned HTTP ${String(response.status)}.`);
  }
  const declaredBytes = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredBytes) && declaredBytes > limit) {
    throw new Error(`${context} exceeds the ${String(limit)} byte limit.`);
  }

  if (response.body?.getReader === undefined) {
    const source = await response.text();
    if (new TextEncoder().encode(source).byteLength > limit) {
      throw new Error(`${context} exceeds the ${String(limit)} byte limit.`);
    }
    return source;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let source = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > limit) {
      await reader.cancel();
      throw new Error(`${context} exceeds the ${String(limit)} byte limit.`);
    }
    source += decoder.decode(value, { stream: true });
  }
  return source + decoder.decode();
};

const fetchJson = async (url, limit, context, fetcher) => {
  const response = await fetcher(url, {
    credentials: "omit",
    headers: { accept: "application/json" },
    redirect: "error",
  });
  const source = await readBoundedResponse(response, limit, context);
  try {
    return JSON.parse(source);
  } catch {
    throw new Error(`${context} must contain valid JSON.`);
  }
};

const parseManifest = (value, manifestUrl) => {
  const manifest = expectRecord(value, "Release smoke manifest");
  if (manifest.schemaVersion !== RELEASE_SMOKE_SCHEMA_VERSION) {
    throw new Error("Release smoke manifest has an unsupported schema version.");
  }
  if (!Array.isArray(manifest.runs))
    throw new Error("Release smoke manifest.runs must be an array.");
  if (manifest.runs.length > RELEASE_SMOKE_SOURCE_RUN_LIMIT) {
    throw new Error(
      `Release smoke manifest exceeds the ${String(RELEASE_SMOKE_SOURCE_RUN_LIMIT)} run limit.`,
    );
  }

  const runs = manifest.runs.map((entryValue, index) => {
    const context = `Release smoke manifest.runs[${String(index)}]`;
    const entry = expectRecord(entryValue, context);
    const id = expectString(entry.id, `${context}.id`);
    if (!releaseSmokeRunId.test(id)) throw new Error(`${context}.id is invalid.`);
    const transcript = expectString(entry.transcript, `${context}.transcript`);
    const transcriptUrl = new URL(transcript, manifestUrl);
    const expectedPath = `/release-smoke/runs/${id}/run.json`;
    if (
      transcriptUrl.origin !== manifestUrl.origin ||
      transcriptUrl.pathname !== expectedPath ||
      transcriptUrl.search !== "" ||
      transcriptUrl.hash !== ""
    ) {
      throw new Error(`${context}.transcript must be the same-origin run record.`);
    }
    return {
      generatedAt: expectTimestamp(entry.generatedAt, `${context}.generatedAt`),
      id,
      transcript: expectedPath,
      transcriptUrl,
      version: expectString(entry.version, `${context}.version`),
    };
  });
  if (new Set(runs.map(({ id }) => id)).size !== runs.length) {
    throw new Error("Release smoke manifest run ids must be unique.");
  }
  const latestRunId =
    manifest.latestRunId === null
      ? null
      : expectString(manifest.latestRunId, "Release smoke manifest.latestRunId");
  if (
    (runs.length === 0 && latestRunId !== null) ||
    (runs.length > 0 && !runs.some(({ id }) => id === latestRunId))
  ) {
    throw new Error("Release smoke manifest.latestRunId must select a published run.");
  }
  return runs;
};

const parseRun = (value, entry) => {
  const run = expectRecord(value, `Release smoke run ${entry.id}`);
  if (
    run.schemaVersion !== RELEASE_SMOKE_SCHEMA_VERSION &&
    run.schemaVersion !== RELEASE_SMOKE_RUN_SCHEMA_VERSION
  ) {
    throw new Error(`Release smoke run ${entry.id} has an unsupported schema version.`);
  }
  if (run.id !== entry.id) throw new Error(`Release smoke run id mismatch: ${entry.id}.`);
  if (
    expectTimestamp(run.generatedAt, `Release smoke run ${entry.id}.generatedAt`) !==
    entry.generatedAt
  ) {
    throw new Error(`Release smoke run timestamp mismatch: ${entry.id}.`);
  }
  const release = expectRecord(run.release, `Release smoke run ${entry.id}.release`);
  if (release.version !== entry.version) {
    throw new Error(`Release smoke run version mismatch: ${entry.id}.`);
  }
  return run;
};

const loadOriginHistory = async (origin, fetcher) => {
  const manifestUrl = new URL("/release-smoke/manifest.json", origin);
  const manifest = parseManifest(
    await fetchJson(manifestUrl, RELEASE_SMOKE_MANIFEST_BYTES, "Release smoke manifest", fetcher),
    manifestUrl,
  );
  return Promise.all(
    manifest.map(async (entry) => ({
      ...entry,
      run: parseRun(
        await fetchJson(
          entry.transcriptUrl,
          RELEASE_SMOKE_RUN_BYTES,
          `Release smoke run ${entry.id}`,
          fetcher,
        ),
        entry,
      ),
    })),
  );
};

export const hydrateReleaseSmokeHistory = async ({
  fetcher = fetch,
  limit = RELEASE_SMOKE_HISTORY_LIMIT,
  origins,
  websiteRoot,
}) => {
  if (!Number.isInteger(limit) || limit < 1 || limit > RELEASE_SMOKE_HISTORY_LIMIT) {
    throw new Error(
      `Release smoke history limit must be between 1 and ${String(RELEASE_SMOKE_HISTORY_LIMIT)}.`,
    );
  }
  if (!Array.isArray(origins) || origins.length === 0) {
    throw new Error("At least one release smoke history origin is required.");
  }
  const normalizedOrigins = [...new Set(origins.map(releaseSmokeHistoryOrigin))];
  const histories = await Promise.all(
    normalizedOrigins.map((origin) => loadOriginHistory(origin, fetcher)),
  );
  const runsById = new Map();
  for (const history of histories) {
    for (const entry of history) {
      if (!runsById.has(entry.id)) runsById.set(entry.id, entry);
    }
  }
  const runs = [...runsById.values()]
    .sort(
      (left, right) =>
        Date.parse(right.generatedAt) - Date.parse(left.generatedAt) ||
        right.id.localeCompare(left.id),
    )
    .slice(0, limit);

  const publicRoot = join(resolve(websiteRoot), "public", "release-smoke");
  const runsRoot = join(publicRoot, "runs");
  await rm(runsRoot, { force: true, recursive: true });
  await mkdir(runsRoot, { recursive: true });
  await Promise.all(
    runs.map(async ({ id, run }) => {
      const destination = join(runsRoot, id);
      await mkdir(destination, { recursive: true });
      await writeFile(join(destination, "run.json"), json(run), "utf8");
    }),
  );
  await writeFile(
    join(publicRoot, "manifest.json"),
    json({
      schemaVersion: RELEASE_SMOKE_SCHEMA_VERSION,
      latestRunId: runs[0]?.id ?? null,
      runs: runs.map(({ generatedAt, id, transcript, version }) => ({
        id,
        generatedAt,
        transcript,
        version,
      })),
    }),
    "utf8",
  );

  return runs.map(({ id }) => id);
};

const main = async () => {
  const [websiteRoot, ...origins] = process.argv.slice(2);
  if (websiteRoot === undefined || origins.length === 0) {
    throw new Error(
      "Usage: node scripts/release-smoke/hydrate-history.mjs <website-root> <origin...>",
    );
  }
  const runIds = await hydrateReleaseSmokeHistory({ origins, websiteRoot });
  process.stdout.write(`Hydrated ${String(runIds.length)} release smoke runs.\n`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();

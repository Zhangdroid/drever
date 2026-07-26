export const defaultReleaseSmokeOrigin = "https://drever-release-smoke.pages.dev";
export const legacyReleaseSmokeOrigin = "https://8bf3dcda.drever-website.pages.dev";

export type ReleaseSmokeCaseMode = "guided" | "surprise-me";
export type ReleaseSmokeCaseStatus = "failed" | "passed";
export type ReleaseSmokeMessageRole = "assistant" | "user";

export interface ReleaseSmokeMessage {
  content: string;
  role: ReleaseSmokeMessageRole;
}

export interface ReleaseSmokeCase {
  brief: string;
  checks: string[];
  deck: {
    audience: string;
    document: string;
    source: string;
  };
  durationSeconds: number;
  id: string;
  messages: ReleaseSmokeMessage[];
  mode: ReleaseSmokeCaseMode;
  status: ReleaseSmokeCaseStatus;
  title: string;
}

export interface ReleaseSmokeRun {
  cases: ReleaseSmokeCase[];
  generatedAt: string;
  harness: {
    commit: string;
    url: string;
  };
  id: string;
  kind: "preview" | "release";
  release: {
    commit: string;
    url: string;
    version: string;
  };
  runner: {
    codexVersion: string;
    model: string;
    nodeVersion: string;
    promptUrl: string;
    workflowUrl: string;
  };
  schemaVersion: 1;
}

export interface ReleaseSmokeData {
  latest: ReleaseSmokeRun | null;
  runs: ReleaseSmokeRun[];
}

export const readableReleaseSmokeMessage = (value: string): string =>
  value
    .replaceAll(/\[([^\]]+)\]\(<project>\/[^)\n]+\)/gu, "$1")
    .replaceAll(/\*\*([^*\n]+)\*\*/gu, "$1")
    .replaceAll(/`([^`\n]+)`/gu, "$1")
    .replaceAll(/^-\s+/gmu, "• ");

interface ReleaseSmokeManifest {
  latestRunId: string | null;
  runs: Array<{
    id: string;
    transcript: string;
  }>;
  schemaVersion: 1;
}

interface ReleaseSmokeLocation {
  hostname: string;
  origin: string;
}

interface ReleaseSmokeResponse {
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
}

type ReleaseSmokeFetch = (
  input: URL,
  init: {
    cache: RequestCache;
    credentials: RequestCredentials;
    signal?: AbortSignal;
  },
) => Promise<ReleaseSmokeResponse>;

interface LoadReleaseSmokeDataOptions {
  fetcher?: ReleaseSmokeFetch;
  location?: ReleaseSmokeLocation;
  origin?: string;
  signal?: AbortSignal;
}

const configuredReleaseSmokeOrigin =
  import.meta.env.VITE_DREVER_RELEASE_SMOKE_ORIGIN?.trim() || defaultReleaseSmokeOrigin;

const expectRecord = (value: unknown, context: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }
  return value as Record<string, unknown>;
};

const expectArray = (value: unknown, context: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array.`);
  return value;
};

const expectString = (value: unknown, context: string): string => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${context} must be a non-empty string.`);
  }
  return value;
};

const expectNumber = (value: unknown, context: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${context} must be a non-negative number.`);
  }
  return value;
};

const expectLiteral = <Value extends string | number>(
  value: unknown,
  values: readonly Value[],
  context: string,
): Value => {
  if (!values.includes(value as Value)) {
    throw new Error(`${context} must be one of: ${values.join(", ")}.`);
  }
  return value as Value;
};

const expectUrl = (value: unknown, context: string): string => {
  const url = expectString(value, context);
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  if (new URL(url).protocol === "https:") return url;
  throw new Error(`${context} must be an HTTPS URL or an absolute site path.`);
};

const pagesProjectHost = (hostname: string, projectHostname: string) =>
  hostname === projectHostname || hostname.endsWith(`.${projectHostname}`);

const expectUntrustedDeckUrl = (
  value: unknown,
  context: string,
  artifactOrigin: string,
): string => {
  const source = expectString(value, context);
  if (!URL.canParse(source)) {
    throw new Error(`${context} must use an isolated Drever Pages origin.`);
  }
  const url = new URL(source);
  const configuredHostname = new URL(artifactOrigin).hostname;
  const defaultHostname = new URL(defaultReleaseSmokeOrigin).hostname;
  const legacyHostname = "drever-website.pages.dev";
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    ![configuredHostname, defaultHostname, legacyHostname].some((hostname) =>
      pagesProjectHost(url.hostname, hostname),
    )
  ) {
    throw new Error(`${context} must use an isolated Drever Pages origin.`);
  }
  return url.href;
};

const expectTimestamp = (value: unknown, context: string): string => {
  const timestamp = expectString(value, context);
  if (Number.isNaN(Date.parse(timestamp))) throw new Error(`${context} must be an ISO timestamp.`);
  return timestamp;
};

const parseMessage = (value: unknown, context: string): ReleaseSmokeMessage => {
  const message = expectRecord(value, context);
  return {
    content: expectString(message.content, `${context}.content`),
    role: expectLiteral(message.role, ["assistant", "user"], `${context}.role`),
  };
};

const parseCase = (value: unknown, context: string, artifactOrigin: string): ReleaseSmokeCase => {
  const scenario = expectRecord(value, context);
  const deck = expectRecord(scenario.deck, `${context}.deck`);
  return {
    brief: expectString(scenario.brief, `${context}.brief`),
    checks: expectArray(scenario.checks, `${context}.checks`).map((check, index) =>
      expectString(check, `${context}.checks[${index}]`),
    ),
    deck: {
      audience: expectUntrustedDeckUrl(deck.audience, `${context}.deck.audience`, artifactOrigin),
      document: expectUntrustedDeckUrl(deck.document, `${context}.deck.document`, artifactOrigin),
      source: expectUrl(deck.source, `${context}.deck.source`),
    },
    durationSeconds: expectNumber(scenario.durationSeconds, `${context}.durationSeconds`),
    id: expectString(scenario.id, `${context}.id`),
    messages: expectArray(scenario.messages, `${context}.messages`).map((message, index) =>
      parseMessage(message, `${context}.messages[${index}]`),
    ),
    mode: expectLiteral(scenario.mode, ["guided", "surprise-me"], `${context}.mode`),
    status: expectLiteral(scenario.status, ["failed", "passed"], `${context}.status`),
    title: expectString(scenario.title, `${context}.title`),
  };
};

export const parseReleaseSmokeRun = (
  value: unknown,
  artifactOrigin = configuredReleaseSmokeOrigin,
): ReleaseSmokeRun => {
  const run = expectRecord(value, "release smoke transcript");
  const harness = expectRecord(run.harness, "release smoke transcript.harness");
  const release = expectRecord(run.release, "release smoke transcript.release");
  const runner = expectRecord(run.runner, "release smoke transcript.runner");
  const cases = expectArray(run.cases, "release smoke transcript.cases").map((scenario, index) =>
    parseCase(scenario, `release smoke transcript.cases[${index}]`, artifactOrigin),
  );
  if (cases.length === 0) throw new Error("A release smoke run must contain at least one case.");
  if (new Set(cases.map((scenario) => scenario.id)).size !== cases.length) {
    throw new Error("Release smoke case ids must be unique within a run.");
  }

  return {
    cases,
    generatedAt: expectTimestamp(run.generatedAt, "release smoke transcript.generatedAt"),
    harness: {
      commit: expectString(harness.commit, "release smoke transcript.harness.commit"),
      url: expectUrl(harness.url, "release smoke transcript.harness.url"),
    },
    id: expectString(run.id, "release smoke transcript.id"),
    kind: expectLiteral(run.kind, ["preview", "release"], "release smoke transcript.kind"),
    release: {
      commit: expectString(release.commit, "release smoke transcript.release.commit"),
      url: expectUrl(release.url, "release smoke transcript.release.url"),
      version: expectString(release.version, "release smoke transcript.release.version"),
    },
    runner: {
      codexVersion: expectString(
        runner.codexVersion,
        "release smoke transcript.runner.codexVersion",
      ),
      model: expectString(runner.model, "release smoke transcript.runner.model"),
      nodeVersion: expectString(runner.nodeVersion, "release smoke transcript.runner.nodeVersion"),
      promptUrl: expectUrl(runner.promptUrl, "release smoke transcript.runner.promptUrl"),
      workflowUrl: expectUrl(runner.workflowUrl, "release smoke transcript.runner.workflowUrl"),
    },
    schemaVersion: expectLiteral(run.schemaVersion, [1], "release smoke transcript.schemaVersion"),
  };
};

export const parseReleaseSmokeManifest = (value: unknown): ReleaseSmokeManifest => {
  const manifest = expectRecord(value, "release smoke manifest");
  const latestRunId =
    manifest.latestRunId === null
      ? null
      : expectString(manifest.latestRunId, "release smoke manifest.latestRunId");
  const parsed: ReleaseSmokeManifest = {
    latestRunId,
    runs: expectArray(manifest.runs, "release smoke manifest.runs").map((entryValue, index) => {
      const entry = expectRecord(entryValue, `release smoke manifest.runs[${index}]`);
      return {
        id: expectString(entry.id, `release smoke manifest.runs[${index}].id`),
        transcript: expectString(
          entry.transcript,
          `release smoke manifest.runs[${index}].transcript`,
        ),
      };
    }),
    schemaVersion: expectLiteral(
      manifest.schemaVersion,
      [1],
      "release smoke manifest.schemaVersion",
    ),
  };

  if (new Set(parsed.runs.map((entry) => entry.id)).size !== parsed.runs.length) {
    throw new Error("Release smoke manifest run ids must be unique.");
  }
  if (parsed.runs.length === 0) {
    if (parsed.latestRunId !== null) {
      throw new Error("An empty release smoke manifest cannot select a latest run.");
    }
    return parsed;
  }
  if (parsed.latestRunId === null) {
    throw new Error("A populated release smoke manifest must select a latest run.");
  }
  return parsed;
};

export const parseReleaseSmokeData = (
  manifestValue: unknown,
  transcripts: Record<string, unknown>,
  artifactOrigin = configuredReleaseSmokeOrigin,
): ReleaseSmokeData => {
  const manifest = parseReleaseSmokeManifest(manifestValue);
  const runs = manifest.runs.map((entry) => {
    const source = transcripts[entry.transcript];
    if (source === undefined) {
      throw new Error(`Missing release smoke transcript: ${entry.transcript}.`);
    }
    const run = parseReleaseSmokeRun(source, artifactOrigin);
    if (run.id !== entry.id) {
      throw new Error(`Release smoke run id mismatch: expected ${entry.id}, received ${run.id}.`);
    }
    return run;
  });
  const latest =
    manifest.latestRunId === null
      ? null
      : (runs.find((run) => run.id === manifest.latestRunId) ?? null);

  if (manifest.latestRunId !== null && latest === null) {
    throw new Error(`Latest release smoke run not found: ${manifest.latestRunId}.`);
  }
  return { latest, runs };
};

const normalizeReleaseSmokeOrigin = (value: string): string => {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error("Release smoke origin must be an HTTPS origin.");
  }
  return url.origin;
};

export const resolveReleaseSmokeOrigin = (
  location: ReleaseSmokeLocation | undefined = typeof window === "undefined"
    ? undefined
    : window.location,
  configuredOrigin = configuredReleaseSmokeOrigin,
): string => {
  const origin = normalizeReleaseSmokeOrigin(configuredOrigin);
  if (location === undefined) return origin;
  const projectHostname = new URL(origin).hostname;
  return pagesProjectHost(location.hostname, projectHostname) ? location.origin : origin;
};

const releaseSmokeTranscriptUrl = (value: string, manifestUrl: URL): URL => {
  const transcriptUrl = new URL(value, manifestUrl);
  if (
    transcriptUrl.origin !== manifestUrl.origin ||
    transcriptUrl.search !== "" ||
    transcriptUrl.hash !== "" ||
    !/^\/release-smoke\/runs\/[a-z0-9][a-z0-9._-]*\/run\.json$/u.test(transcriptUrl.pathname)
  ) {
    throw new Error(`Invalid release smoke transcript URL: ${value}.`);
  }
  return transcriptUrl;
};

const loadJson = async (
  url: URL,
  fetcher: ReleaseSmokeFetch,
  signal: AbortSignal | undefined,
): Promise<unknown> => {
  const response = await fetcher(url, {
    cache: "no-cache",
    credentials: "omit",
    ...(signal === undefined ? {} : { signal }),
  });
  if (!response.ok) {
    throw new ReleaseSmokeRequestError(
      `Release smoke request failed with status ${response.status}: ${url.href}`,
    );
  }
  return response.json();
};

class ReleaseSmokeRequestError extends Error {}

const loadReleaseSmokeDataFromOrigin = async (
  artifactOrigin: string,
  fetcher: ReleaseSmokeFetch,
  signal: AbortSignal | undefined,
): Promise<ReleaseSmokeData> => {
  const manifestUrl = new URL("/release-smoke/manifest.json", artifactOrigin);
  const manifestValue = await loadJson(manifestUrl, fetcher, signal);
  const manifest = parseReleaseSmokeManifest(manifestValue);
  const transcriptEntries = await Promise.all(
    manifest.runs.map(async (entry) => {
      const value = await loadJson(
        releaseSmokeTranscriptUrl(entry.transcript, manifestUrl),
        fetcher,
        signal,
      );
      return [entry.transcript, value] as const;
    }),
  );
  return parseReleaseSmokeData(
    manifestValue,
    Object.fromEntries(transcriptEntries),
    artifactOrigin,
  );
};

export const loadReleaseSmokeData = async (
  options: LoadReleaseSmokeDataOptions = {},
): Promise<ReleaseSmokeData> => {
  const { fetcher = (input, init) => fetch(input, init), location, origin, signal } = options;
  const artifactOrigin = normalizeReleaseSmokeOrigin(origin ?? resolveReleaseSmokeOrigin(location));

  try {
    return await loadReleaseSmokeDataFromOrigin(artifactOrigin, fetcher, signal);
  } catch (error) {
    const canUseMigrationFallback =
      origin === undefined &&
      signal?.aborted !== true &&
      (error instanceof ReleaseSmokeRequestError || error instanceof TypeError);
    if (!canUseMigrationFallback) throw error;
    return loadReleaseSmokeDataFromOrigin(legacyReleaseSmokeOrigin, fetcher, signal);
  }
};

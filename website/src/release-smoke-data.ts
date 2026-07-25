import manifestSource from "../content/release-smoke/manifest.json";

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

const transcriptSources = import.meta.glob("../content/release-smoke/runs/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

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

const expectUntrustedDeckUrl = (value: unknown, context: string): string => {
  const source = expectString(value, context);
  if (!URL.canParse(source)) {
    throw new Error(`${context} must use an isolated Drever Pages preview origin.`);
  }
  const url = new URL(source);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".drever-website.pages.dev") ||
    url.username !== "" ||
    url.password !== ""
  ) {
    throw new Error(`${context} must use an isolated Drever Pages preview origin.`);
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

const parseCase = (value: unknown, context: string): ReleaseSmokeCase => {
  const scenario = expectRecord(value, context);
  const deck = expectRecord(scenario.deck, `${context}.deck`);
  return {
    brief: expectString(scenario.brief, `${context}.brief`),
    checks: expectArray(scenario.checks, `${context}.checks`).map((check, index) =>
      expectString(check, `${context}.checks[${index}]`),
    ),
    deck: {
      audience: expectUntrustedDeckUrl(deck.audience, `${context}.deck.audience`),
      document: expectUntrustedDeckUrl(deck.document, `${context}.deck.document`),
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

export const parseReleaseSmokeRun = (value: unknown): ReleaseSmokeRun => {
  const run = expectRecord(value, "release smoke transcript");
  const harness = expectRecord(run.harness, "release smoke transcript.harness");
  const release = expectRecord(run.release, "release smoke transcript.release");
  const runner = expectRecord(run.runner, "release smoke transcript.runner");
  const cases = expectArray(run.cases, "release smoke transcript.cases").map((scenario, index) =>
    parseCase(scenario, `release smoke transcript.cases[${index}]`),
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

export const parseReleaseSmokeData = (
  manifestValue: unknown,
  transcripts: Record<string, unknown>,
): {
  latest: ReleaseSmokeRun | null;
  runs: ReleaseSmokeRun[];
} => {
  const manifestRecord = expectRecord(manifestValue, "release smoke manifest");
  const latestRunId =
    manifestRecord.latestRunId === null
      ? null
      : expectString(manifestRecord.latestRunId, "release smoke manifest.latestRunId");
  const manifest: ReleaseSmokeManifest = {
    latestRunId,
    runs: expectArray(manifestRecord.runs, "release smoke manifest.runs").map((value, index) => {
      const entry = expectRecord(value, `release smoke manifest.runs[${index}]`);
      return {
        id: expectString(entry.id, `release smoke manifest.runs[${index}].id`),
        transcript: expectString(
          entry.transcript,
          `release smoke manifest.runs[${index}].transcript`,
        ),
      };
    }),
    schemaVersion: expectLiteral(
      manifestRecord.schemaVersion,
      [1],
      "release smoke manifest.schemaVersion",
    ),
  };

  if (new Set(manifest.runs.map((entry) => entry.id)).size !== manifest.runs.length) {
    throw new Error("Release smoke manifest run ids must be unique.");
  }
  if (manifest.runs.length === 0) {
    if (manifest.latestRunId !== null) {
      throw new Error("An empty release smoke manifest cannot select a latest run.");
    }
    return { latest: null, runs: [] };
  }
  if (manifest.latestRunId === null) {
    throw new Error("A populated release smoke manifest must select a latest run.");
  }

  const runs = manifest.runs.map((entry) => {
    if (!/^[a-z0-9][a-z0-9._-]*\.json$/.test(entry.transcript)) {
      throw new Error(`Invalid release smoke transcript filename: ${entry.transcript}.`);
    }
    const path = `../content/release-smoke/runs/${entry.transcript}`;
    const source = transcripts[path];
    if (source === undefined)
      throw new Error(`Missing release smoke transcript: ${entry.transcript}.`);
    const run = parseReleaseSmokeRun(source);
    if (run.id !== entry.id) {
      throw new Error(`Release smoke run id mismatch: expected ${entry.id}, received ${run.id}.`);
    }
    return run;
  });

  const latest = runs.find((run) => run.id === manifest.latestRunId);
  if (latest === undefined) {
    throw new Error(`Latest release smoke run not found: ${manifest.latestRunId}.`);
  }
  return { latest, runs };
};

export const releaseSmokeData = parseReleaseSmokeData(manifestSource as unknown, transcriptSources);

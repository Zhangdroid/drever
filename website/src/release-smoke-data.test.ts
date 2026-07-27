import { describe, expect, it } from "vite-plus/test";

import {
  defaultReleaseSmokeOrigin,
  legacyReleaseSmokeOrigin,
  loadReleaseSmokeData,
  parseReleaseSmokeData,
  parseReleaseSmokeRun,
  readableReleaseSmokeMessage,
  releaseSmokeHistory,
  releaseSmokeScenarios,
  resolveReleaseSmokeOrigin,
} from "./release-smoke-data";

const transcriptPath = "/release-smoke/runs/0.2.3-abc123/run.json";

const runSource = {
  schemaVersion: 1,
  id: "0.2.3-abc123",
  kind: "release",
  generatedAt: "2026-07-25T19:00:00.000Z",
  harness: {
    commit: "feed123def456",
    url: "https://github.com/Zhangdroid/drever/tree/feed123def456",
  },
  release: {
    version: "0.2.3",
    commit: "abc123def456",
    url: "https://github.com/Zhangdroid/drever/releases/tag/v0.2.3",
  },
  runner: {
    model: "gpt-5",
    codexVersion: "1.2.3",
    nodeVersion: "24.18.0",
    promptUrl: "https://drever.dev/prompt.md",
    workflowUrl: "https://github.com/Zhangdroid/drever/actions/runs/1",
  },
  cases: [
    {
      id: "surprise-me",
      mode: "surprise-me",
      status: "passed",
      title: "Surprise me",
      brief: "Help a team choose a launch direction.",
      durationSeconds: 92,
      deck: {
        audience:
          "https://a1b2c3d4.drever-release-smoke.pages.dev/release-smoke/runs/0.2.3-abc123/surprise-me/deck/",
        document:
          "https://a1b2c3d4.drever-release-smoke.pages.dev/release-smoke/runs/0.2.3-abc123/surprise-me/deck/document/",
        source:
          "https://a1b2c3d4.drever-release-smoke.pages.dev/release-smoke/runs/0.2.3-abc123/surprise-me/source/slides.mdx",
      },
      checks: ["Production build completed"],
      messages: [
        { role: "user", content: "Fetch and follow https://drever.dev/prompt.md." },
        { role: "assistant", content: "What should the room decide?" },
      ],
    },
  ],
};

const comparisonRunSource = {
  ...runSource,
  schemaVersion: 2,
  runner: {
    nodeVersion: runSource.runner.nodeVersion,
    promptUrl: runSource.runner.promptUrl,
    workflowUrl: runSource.runner.workflowUrl,
  },
  cases: [
    {
      ...runSource.cases[0],
      id: "codex-surprise-me",
      provider: {
        id: "codex",
        label: "Codex",
        model: "gpt-5.6-sol",
        version: "0.145.0",
      },
      scenarioId: "surprise-me",
    },
    {
      ...runSource.cases[0],
      id: "claude-surprise-me",
      provider: {
        id: "claude",
        label: "Claude",
        model: "claude-opus-5",
        version: "2.1.0",
      },
      scenarioId: "surprise-me",
      deck: {
        audience:
          "https://a1b2c3d4.drever-release-smoke.pages.dev/release-smoke/runs/0.2.3-abc123/claude-surprise-me/deck/",
        document:
          "https://a1b2c3d4.drever-release-smoke.pages.dev/release-smoke/runs/0.2.3-abc123/claude-surprise-me/deck/document/",
        source:
          "https://a1b2c3d4.drever-release-smoke.pages.dev/release-smoke/runs/0.2.3-abc123/claude-surprise-me/source/slides.mdx",
      },
      messages: [
        { role: "user", content: "Fetch and follow https://drever.dev/prompt.md." },
        { role: "assistant", content: "What should the room decide?" },
      ],
    },
  ],
};

const manifestSource = {
  schemaVersion: 1,
  latestRunId: "0.2.3-abc123",
  runs: [{ id: "0.2.3-abc123", transcript: transcriptPath }],
};

describe("release smoke data", () => {
  it("presents sanitized transcript Markdown as readable plain text", () => {
    expect(
      readableReleaseSmokeMessage(
        "**Or say Surprise me.**\n\n- [slides.mdx](<project>/slides.mdx)\n- `brief.md`",
      ),
    ).toBe("Or say Surprise me.\n\n• slides.mdx\n• brief.md");
  });

  it("accepts an empty manifest without inventing release evidence", () => {
    expect(parseReleaseSmokeData({ schemaVersion: 1, latestRunId: null, runs: [] }, {})).toEqual({
      latest: null,
      runs: [],
    });
  });

  it("joins a manifest to its transcript and exposes the requested latest run", () => {
    const data = parseReleaseSmokeData(manifestSource, { [transcriptPath]: runSource });

    expect(data.latest?.id).toBe("0.2.3-abc123");
    expect(data.latest?.cases[0]?.durationSeconds).toBe(92);
  });

  it("normalizes legacy Codex-only runs into the comparison contract", () => {
    const run = parseReleaseSmokeRun(runSource);

    expect(run.schemaVersion).toBe(1);
    expect(run.cases[0]).toMatchObject({
      id: "surprise-me",
      provider: {
        id: "codex",
        label: "Codex",
        model: "gpt-5",
        version: "1.2.3",
      },
      scenarioId: "surprise-me",
    });
    expect(run.runner).toEqual({
      nodeVersion: "24.18.0",
      promptUrl: "https://drever.dev/prompt.md",
      workflowUrl: "https://github.com/Zhangdroid/drever/actions/runs/1",
    });
  });

  it("groups independent provider results under their shared scenario", () => {
    const run = parseReleaseSmokeRun(comparisonRunSource);
    const scenarios = releaseSmokeScenarios(run);

    expect(run.schemaVersion).toBe(2);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0]).toMatchObject({
      id: "surprise-me",
      mode: "surprise-me",
      results: [
        { id: "codex-surprise-me", provider: { id: "codex" } },
        { id: "claude-surprise-me", provider: { id: "claude" } },
      ],
    });
  });

  it("requires provider-qualified case ids in comparison runs", () => {
    const mismatched = structuredClone(comparisonRunSource);
    mismatched.cases[1]!.id = "wrong-id";

    expect(() => parseReleaseSmokeRun(mismatched)).toThrow(
      "release smoke transcript.cases[1].id must be claude-surprise-me",
    );
  });

  it("requires providers to receive the same scenario contract", () => {
    const mismatched = structuredClone(comparisonRunSource);
    mismatched.cases[1]!.brief = "A different brief.";

    expect(() => parseReleaseSmokeRun(mismatched)).toThrow(
      "Release smoke providers must share the same scenario contract",
    );
  });

  it("rejects fixture transcripts", () => {
    expect(() => parseReleaseSmokeRun({ ...runSource, kind: "fixture" })).toThrow(
      "release smoke transcript.kind must be one of: preview, release",
    );
  });

  it("accepts a preview backed by a real generated deck", () => {
    expect(parseReleaseSmokeRun({ ...runSource, kind: "preview" }).kind).toBe("preview");
  });

  it("hides a seed preview after its source commit has a release run", () => {
    const release = parseReleaseSmokeRun(runSource);
    const preview = {
      ...release,
      id: "preview-run",
      kind: "preview" as const,
    };

    expect(releaseSmokeHistory({ latest: release, runs: [release, preview] })).toEqual([]);
    expect(releaseSmokeHistory({ latest: preview, runs: [preview] })).toEqual([]);
  });

  it("keeps previews that have not been superseded by the same release commit", () => {
    const latest = parseReleaseSmokeRun(runSource);
    const preview = {
      ...latest,
      id: "preview-run",
      kind: "preview" as const,
      release: {
        ...latest.release,
        commit: "different-release-commit",
      },
    };

    expect(releaseSmokeHistory({ latest, runs: [latest, preview] })).toEqual([preview]);
  });

  it("rejects manifest and transcript mismatches", () => {
    expect(() =>
      parseReleaseSmokeData(
        { ...manifestSource, latestRunId: "missing-run" },
        { [transcriptPath]: runSource },
      ),
    ).toThrow("Latest release smoke run not found");

    expect(() =>
      parseReleaseSmokeData(
        { ...manifestSource, latestRunId: null },
        { [transcriptPath]: runSource },
      ),
    ).toThrow("A populated release smoke manifest must select a latest run");

    expect(() =>
      parseReleaseSmokeData(
        {
          ...manifestSource,
          runs: [{ id: "wrong-id", transcript: transcriptPath }],
        },
        { [transcriptPath]: runSource },
      ),
    ).toThrow("Release smoke run id mismatch");
  });

  it("rejects executable URLs in generated transcript data", () => {
    const unsafeRun = structuredClone(runSource);
    unsafeRun.cases[0]!.deck.audience = "javascript:alert(1)";

    expect(() => parseReleaseSmokeRun(unsafeRun)).toThrow(
      "must use an isolated Drever Pages origin",
    );
  });

  it("rejects generated decks on the trusted website origin", () => {
    const sameOriginRun = structuredClone(runSource);
    sameOriginRun.cases[0]!.deck.audience = "/release-smoke/runs/1/guided/deck/";

    expect(() => parseReleaseSmokeRun(sameOriginRun)).toThrow(
      "must use an isolated Drever Pages origin",
    );
  });

  it("rejects mutable branch aliases as archival deck evidence", () => {
    const branchRun = structuredClone(runSource);
    branchRun.cases[0]!.deck.audience =
      "https://automation-release-smoke-1.drever-website.pages.dev/release-smoke/runs/1/guided/deck/";

    expect(() => parseReleaseSmokeRun(branchRun, legacyReleaseSmokeOrigin)).toThrow(
      "must use an isolated Drever Pages origin",
    );
  });

  it("uses the current origin on dedicated Pages deployments", () => {
    expect(
      resolveReleaseSmokeOrigin({
        hostname: "a1b2c3d4.drever-release-smoke.pages.dev",
        origin: "https://a1b2c3d4.drever-release-smoke.pages.dev",
      }),
    ).toBe("https://a1b2c3d4.drever-release-smoke.pages.dev");
    expect(
      resolveReleaseSmokeOrigin({
        hostname: "drever.dev",
        origin: "https://drever.dev",
      }),
    ).toBe(defaultReleaseSmokeOrigin);
  });

  it("loads the public manifest and immutable run records at runtime", async () => {
    const requested: Array<{ credentials: RequestCredentials; href: string }> = [];
    const data = await loadReleaseSmokeData({
      fetcher: async (url, init) => {
        requested.push({ credentials: init.credentials, href: url.href });
        if (url.origin === legacyReleaseSmokeOrigin) {
          return {
            json: async () => ({}),
            ok: false,
            status: 503,
          };
        }
        const value = url.pathname.endsWith("/manifest.json") ? manifestSource : runSource;
        return {
          json: async () => value,
          ok: true,
          status: 200,
        };
      },
      location: {
        hostname: "drever.dev",
        origin: "https://drever.dev",
      },
    });

    expect(requested).toEqual([
      {
        credentials: "omit",
        href: `${defaultReleaseSmokeOrigin}/release-smoke/manifest.json`,
      },
      {
        credentials: "omit",
        href: `${defaultReleaseSmokeOrigin}${transcriptPath}`,
      },
      {
        credentials: "omit",
        href: `${legacyReleaseSmokeOrigin}/release-smoke/manifest.json`,
      },
    ]);
    expect(data.latest?.id).toBe(runSource.id);
    expect(data.runs).toHaveLength(1);
  });

  it("adds legacy runs behind the primary archive and deduplicates by run id", async () => {
    const legacyRunPath = "/release-smoke/runs/0.2.2-old/run.json";
    const legacyRun = structuredClone(runSource);
    legacyRun.id = "0.2.2-old";
    legacyRun.generatedAt = "2026-07-24T19:00:00.000Z";
    legacyRun.release.version = "0.2.2";
    legacyRun.release.commit = "old123def456";
    legacyRun.cases[0]!.deck = {
      audience:
        "https://d0f88ad4.drever-website.pages.dev/release-smoke/runs/0.2.2-old/surprise-me/deck/",
      document:
        "https://d0f88ad4.drever-website.pages.dev/release-smoke/runs/0.2.2-old/surprise-me/deck/document/",
      source:
        "https://d0f88ad4.drever-website.pages.dev/release-smoke/runs/0.2.2-old/surprise-me/source/slides.mdx",
    };
    const legacyManifest = {
      schemaVersion: 1,
      latestRunId: legacyRun.id,
      runs: [
        { id: runSource.id, transcript: transcriptPath },
        { id: legacyRun.id, transcript: legacyRunPath },
      ],
    };
    const responses = new Map<string, unknown>([
      [`${defaultReleaseSmokeOrigin}/release-smoke/manifest.json`, manifestSource],
      [`${defaultReleaseSmokeOrigin}${transcriptPath}`, runSource],
      [`${legacyReleaseSmokeOrigin}/release-smoke/manifest.json`, legacyManifest],
      [`${legacyReleaseSmokeOrigin}${transcriptPath}`, runSource],
      [`${legacyReleaseSmokeOrigin}${legacyRunPath}`, legacyRun],
    ]);

    const data = await loadReleaseSmokeData({
      fetcher: async (url) => ({
        json: async () => responses.get(url.href),
        ok: responses.has(url.href),
        status: responses.has(url.href) ? 200 : 404,
      }),
      origin: defaultReleaseSmokeOrigin,
    });

    expect(data.latest?.id).toBe(runSource.id);
    expect(data.runs.map((run) => run.id)).toEqual([runSource.id, legacyRun.id]);
    expect(data.runs[0]?.release.version).toBe("0.2.3");
  });

  it("loads from the same origin on a hash deployment", async () => {
    const hashOrigin = "https://a1b2c3d4.drever-release-smoke.pages.dev";
    const requested: string[] = [];
    await loadReleaseSmokeData({
      fetcher: async (url) => {
        requested.push(url.href);
        return {
          json: async () => ({ schemaVersion: 1, latestRunId: null, runs: [] }),
          ok: true,
          status: 200,
        };
      },
      location: {
        hostname: "a1b2c3d4.drever-release-smoke.pages.dev",
        origin: hashOrigin,
      },
    });

    expect(requested).toEqual([
      `${hashOrigin}/release-smoke/manifest.json`,
      `${legacyReleaseSmokeOrigin}/release-smoke/manifest.json`,
    ]);
  });

  it("keeps the current published evidence available during the storage migration", async () => {
    const requested: string[] = [];
    const data = await loadReleaseSmokeData({
      fetcher: async (url) => {
        requested.push(url.href);
        if (url.origin === defaultReleaseSmokeOrigin) {
          return {
            json: async () => ({}),
            ok: false,
            status: 404,
          };
        }
        const value = url.pathname.endsWith("/manifest.json") ? manifestSource : runSource;
        return {
          json: async () => value,
          ok: true,
          status: 200,
        };
      },
      location: {
        hostname: "drever.dev",
        origin: "https://drever.dev",
      },
    });

    expect(requested).toEqual([
      `${defaultReleaseSmokeOrigin}/release-smoke/manifest.json`,
      `${legacyReleaseSmokeOrigin}/release-smoke/manifest.json`,
      `${legacyReleaseSmokeOrigin}${transcriptPath}`,
    ]);
    expect(data.latest?.id).toBe(runSource.id);
  });

  it("loads an empty remote manifest without requesting run records", async () => {
    let requests = 0;
    const data = await loadReleaseSmokeData({
      fetcher: async () => {
        requests += 1;
        return {
          json: async () => ({ schemaVersion: 1, latestRunId: null, runs: [] }),
          ok: true,
          status: 200,
        };
      },
      origin: defaultReleaseSmokeOrigin,
    });

    expect(requests).toBe(2);
    expect(data).toEqual({ latest: null, runs: [] });
  });

  it("rejects remote failures and transcript URLs outside the archive", async () => {
    await expect(
      loadReleaseSmokeData({
        fetcher: async () => ({
          json: async () => ({}),
          ok: false,
          status: 503,
        }),
        origin: defaultReleaseSmokeOrigin,
      }),
    ).rejects.toThrow("status 503");

    await expect(
      loadReleaseSmokeData({
        fetcher: async () => ({
          json: async () => ({
            ...manifestSource,
            runs: [{ id: runSource.id, transcript: "https://example.com/run.json" }],
          }),
          ok: true,
          status: 200,
        }),
        origin: defaultReleaseSmokeOrigin,
      }),
    ).rejects.toThrow("Invalid release smoke transcript URL");
  });
});

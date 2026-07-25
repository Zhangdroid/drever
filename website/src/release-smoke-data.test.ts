import { describe, expect, it } from "vite-plus/test";

import {
  parseReleaseSmokeData,
  parseReleaseSmokeRun,
  readableReleaseSmokeMessage,
  releaseSmokeData,
} from "./release-smoke-data";

const transcriptPath = "../content/release-smoke/runs/0.2.3.json";

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
          "https://automation-release-smoke-1.drever-website.pages.dev/release-smoke/runs/0.2.3-abc123/surprise-me/",
        document:
          "https://automation-release-smoke-1.drever-website.pages.dev/release-smoke/runs/0.2.3-abc123/surprise-me/document/",
        source: "https://github.com/Zhangdroid/drever/tree/ai-smoke/0.2.3-abc123/surprise-me",
      },
      checks: ["Production build completed"],
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
  runs: [{ id: "0.2.3-abc123", transcript: "0.2.3.json" }],
};

describe("release smoke data", () => {
  it("loads the selected real run without substituting showcase fixtures", () => {
    const latest = releaseSmokeData.latest;

    if (latest === null) throw new Error("Expected checked-in release smoke evidence.");
    expect(releaseSmokeData.runs.some(({ id }) => id === latest.id)).toBe(true);
    expect(latest.cases.map(({ id }) => id)).toEqual(["surprise-me", "guided"]);
    expect(latest.cases.every(({ status }) => status === "passed")).toBe(true);
    expect(
      latest.cases.every(({ deck }) => deck.audience.includes(`/release-smoke/runs/${latest.id}/`)),
    ).toBe(true);
  });

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

  it("rejects fixture transcripts", () => {
    expect(() => parseReleaseSmokeRun({ ...runSource, kind: "fixture" })).toThrow(
      "release smoke transcript.kind must be one of: preview, release",
    );
  });

  it("accepts a preview backed by a real generated deck", () => {
    expect(parseReleaseSmokeRun({ ...runSource, kind: "preview" }).kind).toBe("preview");
  });

  it("fails the website build when the manifest and transcript disagree", () => {
    expect(() =>
      parseReleaseSmokeData(
        { ...manifestSource, latestRunId: "missing-run" },
        { [transcriptPath]: runSource },
      ),
    ).toThrow("Latest release smoke run not found");

    expect(() =>
      parseReleaseSmokeData(
        { ...manifestSource, latestRunId: null },
        {
          [transcriptPath]: runSource,
        },
      ),
    ).toThrow("A populated release smoke manifest must select a latest run");

    expect(() =>
      parseReleaseSmokeData(
        {
          ...manifestSource,
          runs: [{ id: "wrong-id", transcript: "0.2.3.json" }],
        },
        { [transcriptPath]: runSource },
      ),
    ).toThrow("Release smoke run id mismatch");
  });

  it("rejects executable URLs in generated transcript data", () => {
    const unsafeRun = structuredClone(runSource);
    unsafeRun.cases[0]!.deck.audience = "javascript:alert(1)";

    expect(() => parseReleaseSmokeRun(unsafeRun)).toThrow(
      "must use an isolated Drever Pages preview origin",
    );
  });

  it("rejects generated decks on the trusted website origin", () => {
    const sameOriginRun = structuredClone(runSource);
    sameOriginRun.cases[0]!.deck.audience = "/release-smoke/runs/1/guided/deck/";

    expect(() => parseReleaseSmokeRun(sameOriginRun)).toThrow(
      "must use an isolated Drever Pages preview origin",
    );
  });
});

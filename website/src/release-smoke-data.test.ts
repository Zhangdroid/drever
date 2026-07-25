import { describe, expect, it } from "vite-plus/test";

import {
  parseReleaseSmokeData,
  parseReleaseSmokeRun,
  releaseSmokeData,
} from "./release-smoke-data";

const transcriptPath = "../content/release-smoke/runs/0.2.3.json";

const runSource = {
  schemaVersion: 1,
  id: "0.2.3-abc123",
  kind: "release",
  generatedAt: "2026-07-25T19:00:00.000Z",
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
        audience: "/release-smoke/runs/0.2.3-abc123/surprise-me/",
        document: "/release-smoke/runs/0.2.3-abc123/surprise-me/document/",
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
  it("loads the checked-in preview with interactive audience and document surfaces", () => {
    expect(releaseSmokeData.latest.kind).toBe("fixture");
    expect(releaseSmokeData.latest.cases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          deck: expect.objectContaining({
            audience: expect.stringMatching(/^\//),
            document: expect.stringMatching(/\/document\/$/),
          }),
        }),
      ]),
    );
  });

  it("joins a manifest to its transcript and exposes the requested latest run", () => {
    const data = parseReleaseSmokeData(manifestSource, { [transcriptPath]: runSource });

    expect(data.latest.id).toBe("0.2.3-abc123");
    expect(data.latest.cases[0]?.durationSeconds).toBe(92);
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
      "must be an HTTPS URL or an absolute site path",
    );
  });
});

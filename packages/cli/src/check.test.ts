import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DECK_PREFLIGHT_VERSION,
  DREVER_DECK_PLAN_VERSION,
  type DeckPreflightReportV1,
  type RenderedPreflightReceipt,
} from "@drever/schema";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { checkDeck, formatCheckHuman, formatCheckJson } from "./check.ts";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

const report = {
  version: DECK_PREFLIGHT_VERSION,
  sourcePath: "talk.mdx",
  slideCount: 2,
  summary: { errors: 1, warnings: 1, info: 0 },
  diagnostics: [
    {
      code: "DREVER_TEST_BROKEN",
      severity: "error",
      stage: "parse",
      message: "The component tag is incomplete.",
      hint: "Close the component tag.",
      source: {
        path: "talk.mdx",
        start: { line: 3, column: 5, offset: 18 },
        end: { line: 3, column: 5, offset: 18 },
      },
    },
    {
      code: "DREVER_TEST_DENSE",
      severity: "warning",
      stage: "design",
      message: "This slide may contain too much text.",
    },
  ],
} as Parameters<typeof formatCheckHuman>[0];

describe("check output", () => {
  it("formats concise diagnostics with exact source locations", () => {
    expect(formatCheckHuman(report)).toBe(
      [
        "talk.mdx:3:5 ERROR DREVER_TEST_BROKEN: The component tag is incomplete.",
        "  Hint: Close the component tag.",
        "talk.mdx WARNING DREVER_TEST_DENSE: This slide may contain too much text.",
        "Check failed for talk.mdx: 2 slides; 1 error, 1 warning, 0 info messages.",
        "",
      ].join("\n"),
    );
  });

  it("emits stable pretty JSON with the public report field order", () => {
    const output = formatCheckJson(report);
    expect(output).toBe(`${JSON.stringify(report, null, 2)}\n`);
    expect(Object.keys(JSON.parse(output) as object)).toEqual([
      "version",
      "sourcePath",
      "slideCount",
      "summary",
      "diagnostics",
    ]);
  });

  it("keeps legacy source-only reports readable without inventing rendered evidence", () => {
    const legacy = {
      version: 1,
      sourcePath: "legacy.mdx",
      slideCount: 1,
      summary: { errors: 0, warnings: 0, info: 0 },
      diagnostics: [],
    } satisfies DeckPreflightReportV1;

    expect(JSON.parse(formatCheckJson(legacy))).toEqual(legacy);
    expect(formatCheckHuman(legacy)).not.toContain("Rendered preflight");
  });
});

describe("checkDeck", () => {
  it("keeps stored ruleset-1 rendered receipts representable", () => {
    const receipt: RenderedPreflightReceipt = {
      version: 1,
      rulesetVersion: 1,
      canvas: { width: 1_600, height: 900 },
      engine: "chromium",
      stateCount: 1,
      status: "passed",
    };

    expect(receipt.rulesetVersion).toBe(1);
  });

  it("returns a nonzero outcome while printing invalid MDX as JSON data", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-check-test-"));
    directories.push(root);
    const entry = join(root, "broken.mdx");
    await writeFile(entry, "# Broken\n\n<Component");
    let output = "";

    const outcome = await checkDeck({
      entry,
      json: true,
      stdout: { write: (chunk) => ((output += String(chunk)), true) },
    });

    const parsed = JSON.parse(output) as {
      diagnostics: readonly { severity: string }[];
      sourcePath: string;
      summary: { errors: number };
    };
    expect(outcome).toBe(1);
    expect(parsed.sourcePath).toBe(entry);
    expect(parsed.summary.errors).toBeGreaterThan(0);
    expect(parsed.diagnostics.some(({ severity }) => severity === "error")).toBe(true);
    expect(output).toBe(`${JSON.stringify(parsed, null, 2)}\n`);
  });

  it("returns success for a valid multi-slide deck", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-check-test-"));
    directories.push(root);
    const entry = join(root, "valid.mdx");
    await writeFile(entry, "# First\n\n---\n\n# Second\n");
    let output = "";

    const outcome = await checkDeck({
      entry,
      json: false,
      stdout: { write: (chunk) => ((output += String(chunk)), true) },
    });

    expect(outcome).toBe(0);
    expect(output).toContain(`Check passed for ${entry}: 2 slides; 0 errors`);
  });

  it("merges approved plan drift into the source report", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-check-test-"));
    directories.push(root);
    const entry = join(root, "slides.mdx");
    const planPath = join(root, "drever.plan.json");
    await writeFile(entry, "# First\n\n---\n\n# Second\n");
    await writeFile(
      planPath,
      JSON.stringify({
        version: DREVER_DECK_PLAN_VERSION,
        status: "approved",
        brief: {
          topic: "A useful topic",
          audience: "A general audience",
          desiredChange: "Understand the central idea",
          durationMinutes: 5,
          language: "en",
          density: "concise",
        },
        slides: [
          {
            id: "opening",
            job: "opening",
            title: "First",
            purpose: "Open the story.",
            evidence: ["The opening claim"],
            focalArtifact: "The central idea",
            composition: { recipe: "centered-statement" },
            density: "concise",
          },
        ],
      }),
    );
    let output = "";

    const outcome = await checkDeck({
      entry,
      json: true,
      root,
      stdout: { write: (chunk) => ((output += String(chunk)), true) },
    });

    const parsed = JSON.parse(output) as {
      diagnostics: readonly { code: string; source?: { path: string } }[];
    };
    expect(outcome).toBe(1);
    expect(parsed.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "DREVER_PLAN_SLIDE_COUNT_MISMATCH",
        source: expect.objectContaining({ path: planPath }),
      }),
    );
  });
});

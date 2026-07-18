import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { checkDeck, formatCheckHuman, formatCheckJson } from "./check.ts";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

const report = {
  version: 1,
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
});

describe("checkDeck", () => {
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
});

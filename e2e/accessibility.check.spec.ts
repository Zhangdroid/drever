import { execFile } from "node:child_process";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

const execute = promisify(execFile);
const projectRoot = join(import.meta.dirname, "..", "examples", "basic");
const cli = join(import.meta.dirname, "..", "packages", "cli", "dist", "bin.mjs");
const environment = { ...process.env };
delete environment.FORCE_COLOR;

type CheckDiagnostic = Readonly<{
  code: string;
  hint?: string;
  message: string;
  severity: "error" | "info" | "warning";
  source?: Readonly<{
    end: Readonly<{ column: number; line: number; offset: number }>;
    path: string;
    start: Readonly<{ column: number; line: number; offset: number }>;
  }>;
}>;

type CheckReport = Readonly<{
  diagnostics: readonly CheckDiagnostic[];
  slideCount: number;
  sourcePath: string;
  summary: Readonly<{ errors: number; info: number; warnings: number }>;
  version: number;
}>;

type CliFailure = Error & Readonly<{ code: number | string; stderr: string; stdout: string }>;

const runCheck = (cwd: string, ...arguments_: string[]) =>
  execute(process.execPath, [cli, "check", ...arguments_], {
    cwd,
    env: environment,
    timeout: 30_000,
  });

const runFailingCheck = async (cwd: string, ...arguments_: string[]): Promise<CliFailure> =>
  runCheck(cwd, ...arguments_).then(
    () => {
      throw new Error("Expected drever check to fail.");
    },
    (error: unknown) => error as CliFailure,
  );

const parseReport = (source: string): CheckReport => JSON.parse(source) as CheckReport;

test("the built CLI emits an empty JSON accessibility report for a clean deck", async () => {
  const { stdout } = await runCheck(projectRoot, "--json");
  const report = parseReport(stdout);

  expect(report).toEqual({
    version: 1,
    sourcePath: join(projectRoot, "slides.mdx"),
    slideCount: 5,
    summary: { errors: 0, warnings: 0, info: 0 },
    diagnostics: [],
  });
});

test("the built CLI returns actionable source diagnostics and a failing exit status", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "drever-check-errors-e2e-")));
  const sourcePath = join(root, "slides.mdx");
  try {
    await writeFile(
      sourcePath,
      `# Repeated title

---

# Repeated title

---

This slide has no title.

<img src="diagram.png" />
`,
    );

    const failure = await runFailingCheck(root, "slides.mdx", "--json");
    expect(failure).toBeInstanceOf(Error);
    expect(failure.code).not.toBe(0);

    const report = parseReport(failure.stdout);
    expect(report).toMatchObject({
      version: 1,
      sourcePath,
      slideCount: 3,
      summary: { errors: 3, warnings: 0, info: 0 },
    });

    const expectedLines = new Map([
      ["DREVER_A11Y_SLIDE_TITLE_MISSING", 9],
      ["DREVER_A11Y_SLIDE_TITLE_DUPLICATE", 5],
      ["DREVER_A11Y_IMAGE_ALT_MISSING", 11],
    ]);
    for (const [code, line] of expectedLines) {
      const diagnostic = report.diagnostics.find((candidate) => candidate.code === code);
      expect(diagnostic, `missing ${code}`).toMatchObject({
        code,
        severity: "error",
        message: expect.any(String),
        hint: expect.any(String),
        source: {
          path: sourcePath,
          start: { line, column: expect.any(Number), offset: expect.any(Number) },
          end: {
            line: expect.any(Number),
            column: expect.any(Number),
            offset: expect.any(Number),
          },
        },
      });
    }
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("warnings remain machine-readable without failing the command", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "drever-check-warning-e2e-")));
  try {
    await writeFile(join(root, "slides.mdx"), "# Accessible title\n\n### Skipped level\n");

    const { stdout } = await runCheck(root, "--json");
    const report = parseReport(stdout);
    expect(report.summary).toEqual({ errors: 0, warnings: 1, info: 0 });
    expect(report.diagnostics).toMatchObject([
      {
        code: "DREVER_A11Y_HEADING_LEVEL_SKIPPED",
        severity: "warning",
        source: { path: join(root, "slides.mdx"), start: { line: 3 } },
      },
    ]);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

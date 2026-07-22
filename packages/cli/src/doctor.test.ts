import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  formatDoctorReport,
  inspectDreverEnvironment,
  runDoctor,
  type DoctorReport,
} from "./doctor.ts";

const directories: string[] = [];

const temporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "drever-doctor-test-"));
  directories.push(directory);
  return directory;
};

const write = async (root: string, path: string, contents = ""): Promise<string> => {
  const destination = join(root, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, contents, "utf8");
  return destination;
};

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("Drever environment inspection", () => {
  it("reports a complete project without starting a browser or changing files", async () => {
    const root = await temporaryDirectory();
    const packagePath = await write(
      root,
      "node_modules/drever/package.json",
      '{"version":"1.2.3"}\n',
    );
    await write(root, "slides.mdx", "# Ready\n");
    const chromium = await write(root, ".browsers/chromium", "binary");

    const report = await inspectDreverEnvironment({
      chromiumPath: async () => chromium,
      nodeVersion: "24.18.0",
      resolveLocalPackage: () => packagePath,
      root,
    });

    expect(report).toMatchObject({
      ready: true,
      root,
      summary: { errors: 0, passed: 4, warnings: 0 },
      version: 1,
    });
    expect(report.checks.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: "runtime.node", status: "pass" },
      { id: "package.local", status: "pass" },
      { id: "project.entry", status: "pass" },
      { id: "export.chromium", status: "pass" },
    ]);
  });

  it("keeps optional tooling as warnings while failing required capabilities", async () => {
    const root = await temporaryDirectory();

    const report = await inspectDreverEnvironment({
      chromiumPath: async () => join(root, "missing-chromium"),
      nodeVersion: "24.17.9",
      resolveLocalPackage: () => undefined,
      root,
    });

    expect(report).toMatchObject({
      ready: false,
      summary: { errors: 2, passed: 0, warnings: 2 },
    });
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "runtime.node", status: "error" }),
        expect.objectContaining({ id: "package.local", status: "warning" }),
        expect.objectContaining({ id: "project.entry", status: "error" }),
        expect.objectContaining({
          id: "export.chromium",
          status: "warning",
          hint: "Run npx playwright install chromium, then run drever doctor again.",
        }),
      ]),
    );
  });
});

describe("doctor output contract", () => {
  const report: DoctorReport = {
    checks: [
      { id: "runtime.node", message: "Node is supported.", status: "pass" },
      {
        hint: "Install Chromium.",
        id: "export.chromium",
        message: "Chromium is missing.",
        status: "warning",
      },
      { id: "project.entry", message: "slides.mdx is missing.", status: "error" },
    ],
    ready: false,
    root: "/project",
    summary: { errors: 1, passed: 1, warnings: 1 },
    version: 1,
  };

  it("renders concise human diagnostics with actionable hints", () => {
    expect(formatDoctorReport(report)).toBe(
      `Drever doctor
Project: /project

[pass] Node is supported.
[warning] Chromium is missing.
        Install Chromium.
[error] slides.mdx is missing.

Result: 1 passed, 1 warnings, 1 errors.
`,
    );
  });

  it("writes versioned JSON and fails only when required checks fail", async () => {
    const root = await temporaryDirectory();
    let output = "";

    const exitCode = await runDoctor({
      chromiumPath: async () => join(root, "missing-chromium"),
      json: true,
      nodeVersion: "24.17.9",
      resolveLocalPackage: () => undefined,
      root,
      stdout: { write: (chunk) => ((output += String(chunk)), true) },
    });

    expect(exitCode).toBe(1);
    const parsed = JSON.parse(output) as DoctorReport;
    expect(parsed).toMatchObject({ ready: false, root, version: 1 });
    expect(output).toBe(`${JSON.stringify(parsed, null, 2)}\n`);
  });
});

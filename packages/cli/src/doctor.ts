import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { loadDreverConfig, type LoadedDreverConfig } from "./config.ts";
import { resolveDreverEntry } from "./project.ts";

export type DoctorCheck = Readonly<{
  hint?: string;
  id: "export.chromium" | "package.local" | "project.entry" | "runtime.node";
  message: string;
  status: "error" | "pass" | "warning";
}>;

export type DoctorReport = Readonly<{
  checks: readonly DoctorCheck[];
  ready: boolean;
  root: string;
  summary: Readonly<{ errors: number; passed: number; warnings: number }>;
  version: 1;
}>;

export type DoctorExitCode = 0 | 1;

export type InspectDoctorOptions = Readonly<{
  chromiumPath?: () => Promise<string>;
  fileExists?: (path: string) => Promise<boolean>;
  loadConfig?: (options: { command: "check"; root: string }) => Promise<LoadedDreverConfig>;
  nodeVersion?: string;
  readText?: (path: string) => Promise<string>;
  resolveLocalPackage?: (root: string) => string | undefined;
  root: string;
}>;

export type RunDoctorRequest = InspectDoctorOptions &
  Readonly<{
    json: boolean;
    stdout?: Pick<NodeJS.WriteStream, "write">;
  }>;

const REQUIRED_NODE = "24.18.0";
const CHROMIUM_HINT = "Run drever browser install, then run drever doctor again.";

const check = (
  id: DoctorCheck["id"],
  status: DoctorCheck["status"],
  message: string,
  hint?: string,
): DoctorCheck => Object.freeze({ id, message, status, ...(hint === undefined ? {} : { hint }) });

const supportsNode = (version: string): boolean => {
  const [major = 0, minor = 0] = version.replace(/^v/u, "").split(".").map(Number);
  return major > 24 || (major === 24 && minor >= 18);
};

const defaultFileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const defaultResolveLocalPackage = (root: string): string | undefined => {
  try {
    return createRequire(join(root, "package.json")).resolve("drever/package.json");
  } catch {
    return;
  }
};

const defaultChromiumPath = async (): Promise<string> => {
  const { chromium } = await import("playwright-core");
  return chromium.executablePath();
};

const inspectLocalPackage = async (
  root: string,
  resolveLocalPackage: NonNullable<InspectDoctorOptions["resolveLocalPackage"]>,
  readText: NonNullable<InspectDoctorOptions["readText"]>,
): Promise<DoctorCheck> => {
  const path = resolveLocalPackage(root);
  if (path === undefined) {
    return check(
      "package.local",
      "warning",
      "No project-local drever package was found.",
      "Install drever in this project to keep commands and output reproducible.",
    );
  }
  try {
    const metadata = JSON.parse(await readText(path)) as { version?: unknown };
    if (typeof metadata.version !== "string") {
      throw new TypeError("Missing package version.");
    }
    return check("package.local", "pass", `Found project-local drever ${metadata.version}.`);
  } catch {
    return check(
      "package.local",
      "warning",
      "The project-local drever package could not be read.",
      "Reinstall project dependencies, then run drever doctor again.",
    );
  }
};

const inspectEntry = async (
  root: string,
  loadConfig: NonNullable<InspectDoctorOptions["loadConfig"]>,
): Promise<DoctorCheck> => {
  try {
    const loaded = await loadConfig({ command: "check", root });
    const entry = await resolveDreverEntry({ config: loaded.config, root });
    return check("project.entry", "pass", `Found deck entry ${entry}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const hint =
      error instanceof Error && "hint" in error && typeof error.hint === "string"
        ? error.hint
        : "Create slides.mdx or fix drever.config.ts, then run drever doctor again.";
    return check("project.entry", "error", `Could not resolve the deck entry: ${message}`, hint);
  }
};

const inspectChromium = async (
  chromiumPath: NonNullable<InspectDoctorOptions["chromiumPath"]>,
  fileExists: NonNullable<InspectDoctorOptions["fileExists"]>,
): Promise<DoctorCheck> => {
  try {
    const path = await chromiumPath();
    return (await fileExists(path))
      ? check(
          "export.chromium",
          "pass",
          "Playwright Chromium is ready for rendered review, PDF export, and design import.",
        )
      : check("export.chromium", "warning", "Playwright Chromium is not installed.", CHROMIUM_HINT);
  } catch {
    return check(
      "export.chromium",
      "warning",
      "Playwright Chromium is unavailable.",
      CHROMIUM_HINT,
    );
  }
};

/** Inspects the local Drever environment without starting a server or downloading a browser. */
export const inspectDreverEnvironment = async ({
  chromiumPath = defaultChromiumPath,
  fileExists = defaultFileExists,
  loadConfig = loadDreverConfig,
  nodeVersion = process.versions.node,
  readText = (path) => readFile(path, "utf8"),
  resolveLocalPackage = defaultResolveLocalPackage,
  root,
}: InspectDoctorOptions): Promise<DoctorReport> => {
  const projectRoot = resolve(root);
  const checks = Object.freeze([
    supportsNode(nodeVersion)
      ? check("runtime.node", "pass", `Node.js ${nodeVersion} is supported.`)
      : check(
          "runtime.node",
          "error",
          `Node.js ${nodeVersion} is older than ${REQUIRED_NODE}.`,
          `Install Node.js ${REQUIRED_NODE} or newer.`,
        ),
    await inspectLocalPackage(projectRoot, resolveLocalPackage, readText),
    await inspectEntry(projectRoot, loadConfig),
    await inspectChromium(chromiumPath, fileExists),
  ]);
  const count = (status: DoctorCheck["status"]): number =>
    checks.filter((candidate) => candidate.status === status).length;
  const summary = Object.freeze({
    errors: count("error"),
    passed: count("pass"),
    warnings: count("warning"),
  });
  return Object.freeze({
    checks,
    ready: summary.errors === 0,
    root: projectRoot,
    summary,
    version: 1,
  });
};

export const formatDoctorReport = (report: DoctorReport): string => {
  const checks = report.checks.flatMap((candidate) => [
    `[${candidate.status}] ${candidate.message}`,
    ...(candidate.hint === undefined ? [] : [`        ${candidate.hint}`]),
  ]);
  const { errors, passed, warnings } = report.summary;
  return [
    "Drever doctor",
    `Project: ${report.root}`,
    "",
    ...checks,
    "",
    `Result: ${passed} passed, ${warnings} warnings, ${errors} errors.`,
    "",
  ].join("\n");
};

export const runDoctor = async ({
  json,
  stdout = process.stdout,
  ...options
}: RunDoctorRequest): Promise<DoctorExitCode> => {
  const report = await inspectDreverEnvironment(options);
  stdout.write(json ? `${JSON.stringify(report, null, 2)}\n` : formatDoctorReport(report));
  return report.ready ? 0 : 1;
};

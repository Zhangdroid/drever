import { preflightDeck } from "@drever/compiler";
import type { DeckPreflightReport, Diagnostic } from "@drever/schema";
import { readFile } from "node:fs/promises";
import { DreverCliError } from "./errors.ts";

export type CheckExitCode = 0 | 1;

export type CheckDeckRequest = Readonly<{
  entry: string;
  json: boolean;
  stdout: Pick<NodeJS.WriteStream, "write">;
}>;

const count = (value: number, singular: string, plural = `${singular}s`): string =>
  `${value} ${value === 1 ? singular : plural}`;

const location = (diagnostic: Diagnostic, sourcePath: string): string => {
  const source = diagnostic.source;
  return source === undefined
    ? sourcePath
    : `${source.path}:${source.start.line}:${source.start.column}`;
};

const formatDiagnostic = (diagnostic: Diagnostic, sourcePath: string): string =>
  [
    `${location(diagnostic, sourcePath)} ${diagnostic.severity.toUpperCase()} ${diagnostic.code}: ${diagnostic.message}`,
    ...(diagnostic.hint === undefined ? [] : [`  Hint: ${diagnostic.hint}`]),
  ].join("\n");

const orderedReport = (report: DeckPreflightReport): DeckPreflightReport => ({
  version: report.version,
  sourcePath: report.sourcePath,
  slideCount: report.slideCount,
  summary: {
    errors: report.summary.errors,
    warnings: report.summary.warnings,
    info: report.summary.info,
  },
  diagnostics: report.diagnostics,
});

export const formatCheckJson = (report: DeckPreflightReport): string =>
  `${JSON.stringify(orderedReport(report), null, 2)}\n`;

export const formatCheckHuman = (report: DeckPreflightReport): string => {
  const diagnostics = report.diagnostics.map((diagnostic) =>
    formatDiagnostic(diagnostic, report.sourcePath),
  );
  const status = report.summary.errors === 0 ? "passed" : "failed";
  const summary = `Check ${status} for ${report.sourcePath}: ${count(report.slideCount, "slide")}; ${count(report.summary.errors, "error")}, ${count(report.summary.warnings, "warning")}, ${count(report.summary.info, "info message")}.`;
  return `${[...diagnostics, summary].join("\n")}\n`;
};

const readDeck = async (path: string): Promise<string> => {
  try {
    return await readFile(path, "utf8");
  } catch (cause) {
    throw new DreverCliError("DREVER_CHECK_READ_FAILED", `Drever could not read ${path}.`, {
      cause,
      details: { path },
      hint: "Check the deck permissions and run the command again.",
    });
  }
};

/** Runs a read-only deck preflight and reports source diagnostics as data. */
export const checkDeck = async ({
  entry,
  json,
  stdout,
}: CheckDeckRequest): Promise<CheckExitCode> => {
  const report = preflightDeck(await readDeck(entry), { path: entry });
  stdout.write(json ? formatCheckJson(report) : formatCheckHuman(report));
  return report.summary.errors === 0 ? 0 : 1;
};

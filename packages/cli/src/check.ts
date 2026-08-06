import { preflightDeck } from "@drever/compiler";
import { DEFAULT_CANVAS } from "@drever/client";
import {
  DECK_PREFLIGHT_VERSION,
  RENDERED_PREFLIGHT_RULESET_VERSION,
  RENDERED_PREFLIGHT_VERSION,
  type DeckPreflightReport,
  type DeckPreflightReportV2,
  type DeckPreflightSummary,
  type Diagnostic,
  type RenderedPreflightReceipt,
} from "@drever/schema";
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { loadDreverDeckPlan } from "./deck-plan.ts";
import { DreverCliError } from "./errors.ts";
import type { ResolvedDreverProject } from "./project.ts";
import { checkRenderedProject } from "./rendered-check.ts";
import { invalidateRenderedEvidence } from "./rendered-evidence.ts";
import { checkStyleSources } from "./style-source-check.ts";

export type CheckExitCode = 0 | 1;

export type CheckDeckRequest = Readonly<{
  entry: string;
  evidenceDirectory?: string;
  json: boolean;
  project?: ResolvedDreverProject;
  root?: string;
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

const orderedReport = (report: DeckPreflightReport): DeckPreflightReport => {
  const fields = {
    sourcePath: report.sourcePath,
    slideCount: report.slideCount,
    summary: {
      errors: report.summary.errors,
      warnings: report.summary.warnings,
      info: report.summary.info,
    },
    diagnostics: report.diagnostics,
  };
  return report.version === 1
    ? { version: 1, ...fields }
    : {
        version: DECK_PREFLIGHT_VERSION,
        ...fields,
        ...(report.rendered === undefined ? {} : { rendered: report.rendered }),
      };
};

export const formatCheckJson = (report: DeckPreflightReport): string =>
  `${JSON.stringify(orderedReport(report), null, 2)}\n`;

export const formatCheckHuman = (report: DeckPreflightReport): string => {
  const diagnostics = report.diagnostics.map((diagnostic) =>
    formatDiagnostic(diagnostic, report.sourcePath),
  );
  const status = report.summary.errors === 0 ? "passed" : "failed";
  const summary = `Check ${status} for ${report.sourcePath}: ${count(report.slideCount, "slide")}; ${count(report.summary.errors, "error")}, ${count(report.summary.warnings, "warning")}, ${count(report.summary.info, "info message")}.`;
  const rendered =
    report.rendered === undefined
      ? []
      : [
          `Rendered preflight ${report.rendered.status}: ${count(report.rendered.stateCount, "state")} at ${report.rendered.canvas.width}×${report.rendered.canvas.height} in Chromium.`,
        ];
  return `${[...diagnostics, ...rendered, summary].join("\n")}\n`;
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

const summarize = (diagnostics: readonly Diagnostic[]): DeckPreflightSummary => ({
  errors: diagnostics.filter(({ severity }) => severity === "error").length,
  warnings: diagnostics.filter(({ severity }) => severity === "warning").length,
  info: diagnostics.filter(({ severity }) => severity === "info").length,
});

export const createCheckReport = async (
  entry: string,
  root = dirname(entry),
): Promise<DeckPreflightReportV2> => {
  const source = await readDeck(entry);
  const report = preflightDeck(source, { path: entry });
  const styles = await checkStyleSources({ entry, root, source });
  const plan = await loadDreverDeckPlan({ root, slideCount: report.slideCount });
  if (styles.length === 0 && plan.diagnostics.length === 0) return report;
  const diagnostics = [...report.diagnostics, ...styles, ...plan.diagnostics];
  return { ...report, summary: summarize(diagnostics), diagnostics };
};

const skippedRenderedReceipt = (project: ResolvedDreverProject): RenderedPreflightReceipt => ({
  version: RENDERED_PREFLIGHT_VERSION,
  rulesetVersion: RENDERED_PREFLIGHT_RULESET_VERSION,
  canvas: project.config.canvas ?? project.plan.theme.canvas ?? DEFAULT_CANVAS,
  engine: "chromium",
  stateCount: 0,
  status: "skipped",
  reason: "source-errors",
});

const withRenderedPreflight = async (
  source: DeckPreflightReportV2,
  project: ResolvedDreverProject,
  evidenceDirectory?: string,
): Promise<DeckPreflightReportV2> => {
  if (source.summary.errors > 0) {
    return { ...source, rendered: skippedRenderedReceipt(project) };
  }
  const rendered = await checkRenderedProject(
    project,
    evidenceDirectory === undefined ? {} : { evidenceDirectory },
  );
  const diagnostics = [...source.diagnostics, ...rendered.diagnostics];
  return {
    ...source,
    summary: summarize(diagnostics),
    diagnostics,
    rendered: rendered.receipt,
  };
};

/** Runs deck preflight; only an explicit evidence directory writes generated review artifacts. */
export const checkDeck = async ({
  entry,
  evidenceDirectory,
  json,
  project,
  root,
  stdout,
}: CheckDeckRequest): Promise<CheckExitCode> => {
  if (evidenceDirectory !== undefined) await invalidateRenderedEvidence(evidenceDirectory);
  const source = await createCheckReport(entry, root);
  const report =
    project === undefined
      ? source
      : await withRenderedPreflight(source, project, evidenceDirectory);
  stdout.write(json ? formatCheckJson(report) : formatCheckHuman(report));
  return report.summary.errors === 0 ? 0 : 1;
};

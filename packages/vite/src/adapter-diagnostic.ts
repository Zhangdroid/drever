import type { BuildCapability } from "@drever/plugin";
import type { Diagnostic, JsonObject, PlannedBuildPlugin } from "@drever/schema";

type DiagnosticOptions = Readonly<{
  capability?: BuildCapability;
  cause?: string;
  exportName?: string;
  extra?: JsonObject;
}>;

export const errorMessage = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return "The build module failed with an unknown error.";
  }
  const line =
    "line" in error && typeof error.line === "number" && Number.isSafeInteger(error.line)
      ? error.line
      : undefined;
  const column =
    "column" in error && typeof error.column === "number" && Number.isSafeInteger(error.column)
      ? error.column
      : undefined;
  const source = "source" in error && typeof error.source === "string" ? error.source : undefined;
  const ruleId = "ruleId" in error && typeof error.ruleId === "string" ? error.ruleId : undefined;
  const location = line === undefined || column === undefined ? undefined : `${line}:${column}`;
  const origin = source === undefined || ruleId === undefined ? undefined : `[${source}:${ruleId}]`;
  const message = origin === undefined ? error.message : `${error.message} ${origin}`;
  return location === undefined ? message : `${location}: ${message}`;
};

export const buildDiagnostic = (
  code: string,
  message: string,
  hint: string,
  entry: PlannedBuildPlugin,
  options: DiagnosticOptions = {},
): Diagnostic =>
  Object.freeze({
    code,
    severity: "error",
    stage: "bundle",
    message,
    hint,
    plugin: entry.owner.id,
    details: Object.freeze({
      capability: options.capability ?? "vite",
      exportName: options.exportName ?? entry.module.exportName ?? "default",
      owner: `${entry.owner.kind}:${entry.owner.id}`,
      phase: entry.phase,
      specifier: entry.module.specifier,
      ...(options.cause === undefined ? {} : { cause: options.cause }),
      ...options.extra,
    }),
  });

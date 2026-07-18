import type { BuildCapability } from "@drever/plugin";
import type { Diagnostic, JsonObject, PlannedBuildPlugin } from "@drever/schema";

type DiagnosticOptions = Readonly<{
  capability?: BuildCapability;
  cause?: string;
  exportName?: string;
  extra?: JsonObject;
}>;

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "The build module failed with an unknown error.";

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

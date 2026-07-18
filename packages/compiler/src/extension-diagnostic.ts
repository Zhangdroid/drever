import type { Diagnostic, ExtensionOwner, JsonObject } from "@drever/schema";
import { createDiagnostic } from "./diagnostics.ts";

type ExtensionDiagnosticOptions = Readonly<{
  plugin?: string | undefined;
  details?: JsonObject | undefined;
}>;

export const ownerLabel = (owner: ExtensionOwner): string => `${owner.kind}:${owner.id}`;

export const extensionDiagnostic = (
  code: string,
  message: string,
  hint: string,
  options: ExtensionDiagnosticOptions = {},
): Diagnostic =>
  createDiagnostic(code, "error", message, {
    stage: "config",
    hint,
    ...(options.plugin === undefined ? {} : { plugin: options.plugin }),
    ...(options.details === undefined ? {} : { details: options.details }),
  });

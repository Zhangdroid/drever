import type { Diagnostic, JsonObject, SourceRange } from "@drever/schema";

export const createDiagnostic = (
  code: string,
  severity: Diagnostic["severity"],
  message: string,
  options: {
    stage: Diagnostic["stage"];
    hint?: string;
    source?: SourceRange;
    slideId?: string;
    plugin?: string;
    details?: JsonObject;
  },
): Diagnostic => ({
  code,
  severity,
  message,
  ...options,
});

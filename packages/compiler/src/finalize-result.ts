import type { DiagnosticResult } from "@drever/schema";
import { createDiagnostic } from "./diagnostics.ts";
import { createJsonSnapshot } from "./json-snapshot.ts";
import { findJsonIssue } from "./json-value.ts";

export const finalizeResult = <Value>(result: DiagnosticResult<Value>): DiagnosticResult<Value> => {
  const issue = findJsonIssue(result);
  if (issue) {
    return createJsonSnapshot({
      ok: false,
      diagnostics: [
        createDiagnostic(
          "DREVER_INTERNAL_RESULT_SERIALIZATION",
          "error",
          `Compiler result is not JSON-safe at ${issue.path}: ${issue.reason}.`,
          {
            stage: "compile",
            hint: "Please report this as a Drever compiler bug.",
            details: { path: issue.path, reason: issue.reason },
          },
        ),
      ],
    });
  }

  return createJsonSnapshot(result);
};

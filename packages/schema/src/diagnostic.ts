import type { JsonObject } from "./json.ts";
import type { SourceRange } from "./source.ts";

export type DiagnosticSeverity = "error" | "warning" | "info";

export type DiagnosticStage =
  | "config"
  | "parse"
  | "compile"
  | "transform"
  | "bundle"
  | "design"
  | "runtime"
  | "export";

export type Diagnostic = Readonly<{
  code: string;
  severity: DiagnosticSeverity;
  stage: DiagnosticStage;
  message: string;
  hint?: string;
  source?: SourceRange;
  slideId?: string;
  plugin?: string;
  details?: JsonObject;
}>;

export type DiagnosticResult<T> =
  | Readonly<{
      ok: true;
      value: T;
      diagnostics: readonly Diagnostic[];
    }>
  | Readonly<{
      ok: false;
      diagnostics: readonly Diagnostic[];
    }>;

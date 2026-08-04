import {
  type Diagnostic,
  type DreverDeckPlan,
  type SourceRange,
  validateDreverDeckPlanValue,
} from "@drever/schema";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const DREVER_DECK_PLAN_FILE = "drever.plan.json";

export type LoadDreverDeckPlanOptions = Readonly<{
  root: string;
  slideCount?: number;
}>;

export type LoadedDreverDeckPlan = Readonly<{
  path: string;
  plan?: DreverDeckPlan;
  diagnostics: readonly Diagnostic[];
}>;

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sourceRange = (source: string, path: string): SourceRange => {
  const lines = source.split(/\r\n|\r|\n/u);
  return {
    path,
    start: { line: 1, column: 1, offset: 0 },
    end: {
      line: lines.length,
      column: (lines.at(-1)?.length ?? 0) + 1,
      offset: source.length,
    },
  };
};

const planDiagnostic = (
  code: string,
  field: string,
  message: string,
  source: SourceRange,
  severity: Diagnostic["severity"] = "error",
): Diagnostic => ({
  code,
  severity,
  stage: "design",
  message,
  hint: "Update drever.plan.json and run the command again.",
  source,
  details: { field },
});

const validatePlan = (
  value: unknown,
  source: SourceRange,
  slideCount?: number,
): Readonly<{ plan?: DreverDeckPlan; diagnostics: readonly Diagnostic[] }> => {
  const validation = validateDreverDeckPlanValue(value);
  if (!validation.ok) {
    return {
      diagnostics: validation.issues.map(({ code, field, message }) =>
        planDiagnostic(code, field, message, source),
      ),
    };
  }

  const { value: plan } = validation;
  if (plan.status === "awaiting-input") {
    return {
      plan,
      diagnostics: [
        planDiagnostic(
          "DREVER_PLAN_AWAITING_INPUT",
          "status",
          "The deck plan is awaiting input.",
          source,
          "warning",
        ),
      ],
    };
  }
  if (plan.status === "awaiting-approval") {
    return {
      plan,
      diagnostics: [
        planDiagnostic(
          "DREVER_PLAN_AWAITING_APPROVAL",
          "status",
          "The deck plan is awaiting approval.",
          source,
          "warning",
        ),
      ],
    };
  }
  if (slideCount !== undefined && plan.slides.length !== slideCount) {
    return {
      diagnostics: [
        planDiagnostic(
          "DREVER_PLAN_SLIDE_COUNT_MISMATCH",
          "slides",
          `The approved plan contains ${String(plan.slides.length)} slides, but the deck contains ${String(slideCount)}.`,
          source,
        ),
      ],
    };
  }
  return { plan, diagnostics: [] };
};

const hasErrorCode = (error: unknown, code: string): boolean =>
  isRecord(error) && error.code === code;

export const loadDreverDeckPlan = async ({
  root,
  slideCount,
}: LoadDreverDeckPlanOptions): Promise<LoadedDreverDeckPlan> => {
  const path = join(root, DREVER_DECK_PLAN_FILE);
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch (cause) {
    if (hasErrorCode(cause, "ENOENT")) return { path, diagnostics: [] };
    return {
      path,
      diagnostics: [
        planDiagnostic(
          "DREVER_PLAN_READ_FAILED",
          "$",
          `Drever could not read ${path}.`,
          sourceRange("", path),
        ),
      ],
    };
  }
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return {
      path,
      diagnostics: [
        planDiagnostic(
          "DREVER_PLAN_JSON_INVALID",
          "$",
          "drever.plan.json is not valid JSON.",
          sourceRange(source, path),
        ),
      ],
    };
  }
  return { path, ...validatePlan(value, sourceRange(source, path), slideCount) };
};

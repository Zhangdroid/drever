import type { Diagnostic } from "./diagnostic.ts";
import type { CanvasDefinition } from "./extension.ts";

export const DECK_PREFLIGHT_VERSION = 2 as const;
export const RENDERED_PREFLIGHT_VERSION = 1 as const;
export const RENDERED_PREFLIGHT_RULESET_VERSION = 6 as const;

/** Every rendered ruleset accepted by the current receipt wire format. */
export type RenderedPreflightRulesetVersion =
  | 1
  | 2
  | 3
  | 4
  | 5
  | typeof RENDERED_PREFLIGHT_RULESET_VERSION;

export type DeckPreflightSummary = Readonly<{
  errors: number;
  warnings: number;
  info: number;
}>;

export type RenderedPreflightReceipt = Readonly<{
  version: typeof RENDERED_PREFLIGHT_VERSION;
  rulesetVersion: RenderedPreflightRulesetVersion;
  canvas: CanvasDefinition;
  engine: "chromium";
  browserVersion?: string;
  evidence?: Readonly<{
    inputSha256: string;
    manifest: "manifest.json";
    schemaVersion: 1;
  }>;
  stateCount: number;
  status: "failed" | "passed" | "skipped";
  reason?: "browser-missing" | "runtime-failed" | "source-errors";
}>;

type DeckPreflightReportBase = Readonly<{
  sourcePath: string;
  slideCount: number;
  summary: DeckPreflightSummary;
  diagnostics: readonly Diagnostic[];
}>;

/** Legacy source-only report emitted before rendered preflight existed. */
export type DeckPreflightReportV1 = DeckPreflightReportBase &
  Readonly<{
    version: 1;
    rendered?: never;
  }>;

/** Current source report with an optional rendered-preflight receipt. */
export type DeckPreflightReportV2 = DeckPreflightReportBase &
  Readonly<{
    version: typeof DECK_PREFLIGHT_VERSION;
    rendered?: RenderedPreflightReceipt;
  }>;

/** Every report version that current consumers can inspect safely. */
export type DeckPreflightReport = DeckPreflightReportV1 | DeckPreflightReportV2;

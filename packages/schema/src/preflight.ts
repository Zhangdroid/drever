import type { Diagnostic } from "./diagnostic.ts";

export const DECK_PREFLIGHT_VERSION = 1 as const;

export type DeckPreflightSummary = Readonly<{
  errors: number;
  warnings: number;
  info: number;
}>;

/** Serializable design and accessibility findings for one authored deck. */
export type DeckPreflightReport = Readonly<{
  version: typeof DECK_PREFLIGHT_VERSION;
  sourcePath: string;
  slideCount: number;
  summary: DeckPreflightSummary;
  diagnostics: readonly Diagnostic[];
}>;

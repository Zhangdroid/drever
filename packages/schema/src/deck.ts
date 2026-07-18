import type { SourceFragment } from "./source.ts";

export const DECK_IR_VERSION = 1 as const;

export type SlideIR = Readonly<{
  id: string;
  index: number;
  source: string;
  fragments: readonly SourceFragment[];
}>;

export type DeckIR = Readonly<{
  version: typeof DECK_IR_VERSION;
  sourcePath: string;
  preamble: readonly SourceFragment[];
  slides: readonly SlideIR[];
}>;

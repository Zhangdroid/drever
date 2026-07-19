export interface FlatBrandToken {
  readonly name: string;
  readonly type: string;
  readonly value: string;
}

export function collectTokens(document: unknown): FlatBrandToken[];
export function renderCss(tokens: readonly FlatBrandToken[]): string;
export function renderTypescript(tokens: readonly FlatBrandToken[]): string;
export function toCssValue(type: string, value: unknown, path?: string): string;
export const packageRoot: string;

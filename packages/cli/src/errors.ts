export type DreverCliErrorOptions = Readonly<{
  cause?: unknown;
  details?: Readonly<Record<string, unknown>>;
  hint?: string;
}>;

/** A stable, user-facing failure emitted before Vite internals reach the terminal. */
export class DreverCliError extends Error {
  readonly code: string;
  readonly details: Readonly<Record<string, unknown>>;
  readonly hint: string | undefined;

  constructor(code: string, message: string, options: DreverCliErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "DreverCliError";
    this.code = code;
    this.details = Object.freeze({ ...options.details });
    this.hint = options.hint;
  }
}

export const formatCliError = (error: unknown): string => {
  if (error instanceof DreverCliError) {
    return [
      `[${error.code}] ${error.message}`,
      ...(error.hint === undefined ? [] : [`Hint: ${error.hint}`]),
    ].join("\n");
  }
  if (error instanceof Error) {
    return `[DREVER_UNEXPECTED] ${error.message}`;
  }
  return `[DREVER_UNEXPECTED] ${String(error)}`;
};

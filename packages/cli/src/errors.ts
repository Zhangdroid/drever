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

const exportContext = (error: DreverCliError): string | undefined => {
  if (error.code !== "DREVER_EXPORT_FAILED") {
    return;
  }
  const values = ["stage", "owner", "capability", "specifier"].flatMap((key) => {
    const value = error.details[key];
    return typeof value === "string" ? [`${key}=${value}`] : [];
  });
  return values.length === 0 ? undefined : `Context: ${values.join(" ")}`;
};

const nestedCause = (error: DreverCliError): string | undefined => {
  if (!(error.cause instanceof Error)) {
    return;
  }
  const message = error.cause.message.trim();
  return message.length === 0 ? undefined : `Cause: ${message}`;
};

export const formatCliError = (error: unknown): string => {
  if (error instanceof DreverCliError) {
    const context = exportContext(error);
    const cause = nestedCause(error);
    return [
      `[${error.code}] ${error.message}`,
      ...(context === undefined ? [] : [context]),
      ...(cause === undefined ? [] : [cause]),
      ...(error.hint === undefined ? [] : [`Hint: ${error.hint}`]),
    ].join("\n");
  }
  if (error instanceof Error) {
    return `[DREVER_UNEXPECTED] ${error.message}`;
  }
  return `[DREVER_UNEXPECTED] ${String(error)}`;
};

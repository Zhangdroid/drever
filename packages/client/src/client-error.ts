import type { JsonObject } from "@drever/schema";

export type DreverClientErrorOptions = Readonly<{
  cause?: unknown;
  details?: JsonObject;
}>;

export class DreverClientError extends Error {
  readonly code: string;
  readonly details?: JsonObject;

  constructor(code: string, message: string, options: DreverClientErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "DreverClientError";
    this.code = code;
    if (options.details !== undefined) {
      this.details = Object.freeze({ ...options.details });
    }
  }
}

export const isAbortError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";

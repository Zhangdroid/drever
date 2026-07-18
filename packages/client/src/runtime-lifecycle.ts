import { DreverClientError, isAbortError } from "./client-error.ts";

export type Awaitable<Value> = Value | PromiseLike<Value>;
export type RuntimeDisposer = () => Awaitable<void>;

export const abortReason = (signal: AbortSignal): unknown =>
  signal.reason ?? new DOMException("Presentation creation was aborted.", "AbortError");

export const isSignalAbort = (error: unknown, signal: AbortSignal): boolean =>
  signal.aborted && (error === signal.reason || isAbortError(error));

export const destroyedReason = (surface: "export" | "speaker view" | "viewer"): DOMException =>
  new DOMException(`The Drever ${surface} was destroyed.`, "AbortError");

const reportGlobally = (error: unknown): void => {
  const reporter = (globalThis as Readonly<{ reportError?: (reason: unknown) => void }>)
    .reportError;
  reporter?.(error);
};

export const createReporter = (handler?: (error: unknown) => void): ((error: unknown) => void) =>
  handler === undefined
    ? reportGlobally
    : (error) => {
        try {
          handler(error);
        } catch (handlerError) {
          reportGlobally(handlerError);
        }
      };

export const setupFailure = (cause: unknown): DreverClientError =>
  new DreverClientError("DREVER_CLIENT_SETUP_FAILED", "A Drever runtime setup hook failed.", {
    cause,
  });

const lifecycleDetails = (cause: unknown): Readonly<Record<string, string>> | undefined => {
  if (typeof cause !== "object" || cause === null) {
    return;
  }
  const source = cause as Readonly<Record<string, unknown>>;
  const details = Object.fromEntries(
    ["capability", "code", "owner", "specifier", "stage"].flatMap((key) =>
      typeof source[key] === "string" ? [[key, source[key]]] : [],
    ),
  ) as Record<string, string>;
  return Object.keys(details).length === 0 ? undefined : Object.freeze(details);
};

export const disposalFailure = (cause: unknown): DreverClientError => {
  const details = lifecycleDetails(cause);
  return new DreverClientError(
    "DREVER_CLIENT_DISPOSE_FAILED",
    "The Drever presentation could not release every runtime resource.",
    {
      cause,
      ...(details === undefined ? {} : { details }),
    },
  );
};

export const subscriberFailure = (cause: unknown): DreverClientError =>
  new DreverClientError(
    "DREVER_CLIENT_SUBSCRIBER_FAILED",
    "A Drever presentation position subscriber failed.",
    { cause },
  );

export const validateDisposer = (value: void | RuntimeDisposer): RuntimeDisposer | undefined => {
  if (value !== undefined && typeof value !== "function") {
    throw new DreverClientError(
      "DREVER_CLIENT_SETUP_DISPOSER_INVALID",
      "The runtime setup runner must return a function or undefined.",
      { details: { receivedType: typeof value } },
    );
  }
  return value as RuntimeDisposer | undefined;
};

export const reportCleanupFailures = (errors: readonly unknown[]): never => {
  const wrapped = errors.map(disposalFailure);
  const first = wrapped[0] as DreverClientError;
  if (wrapped.length > 1) {
    Object.defineProperty(first, "suppressedErrors", {
      configurable: false,
      enumerable: true,
      value: Object.freeze(wrapped.slice(1)),
      writable: false,
    });
  }
  throw first;
};

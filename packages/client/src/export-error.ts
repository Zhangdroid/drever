export type ExportErrorSnapshot = Readonly<{
  name: string;
  message: string;
  code?: string;
  details?: unknown;
  stack?: string;
  owner?: string;
  capability?: string;
  specifier?: string;
}>;

const recordFrom = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof value === "object" && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;

const stringField = (
  source: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string | undefined => (typeof source?.[key] === "string" ? source[key] : undefined);

export const snapshotExportError = (error: unknown): ExportErrorSnapshot => {
  const source = recordFrom(error);
  const details = recordFrom(source?.details);
  const contextField = (key: "capability" | "owner" | "specifier"): string | undefined =>
    stringField(source, key) ?? stringField(details, key);
  const code = stringField(source, "code");
  const stack = stringField(source, "stack");
  const owner = contextField("owner");
  const capability = contextField("capability");
  const specifier = contextField("specifier");

  return Object.freeze({
    name: stringField(source, "name") ?? "Error",
    message: stringField(source, "message") ?? String(error),
    ...(code === undefined ? {} : { code }),
    ...(source?.details === undefined ? {} : { details: source.details }),
    ...(stack === undefined ? {} : { stack }),
    ...(owner === undefined ? {} : { owner }),
    ...(capability === undefined ? {} : { capability }),
    ...(specifier === undefined ? {} : { specifier }),
  });
};

export const serializeExportError = (error: unknown): string => {
  const snapshot = snapshotExportError(error);
  try {
    return JSON.stringify(snapshot);
  } catch {
    const { details: _details, ...serializable } = snapshot;
    return JSON.stringify({ ...serializable, details: "The error details were not serializable." });
  }
};

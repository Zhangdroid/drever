import {
  DREVER_EXTENSION_API_VERSION,
  type CompilerTarget,
  type Diagnostic,
  type DiagnosticResult,
  type PluginRegistration,
  type ThemeDefinition,
} from "@drever/schema";
import { createDiagnostic } from "./diagnostics.ts";
import { createJsonSnapshot } from "./json-snapshot.ts";
import { findJsonIssue } from "./json-value.ts";

export type CompilePlanInput = Readonly<{
  target?: CompilerTarget;
  theme: ThemeDefinition;
  plugins?: readonly PluginRegistration[];
}>;

type Shape =
  | Readonly<{ kind: "array"; item: Shape }>
  | Readonly<{ kind: "boolean" }>
  | Readonly<{ kind: "enum"; values: readonly (boolean | number | string)[] }>
  | Readonly<{ kind: "json-object" }>
  | Readonly<{ kind: "number" }>
  | Readonly<{ kind: "object"; fields: Readonly<Record<string, ShapeField>> }>
  | Readonly<{ kind: "primitive" }>
  | Readonly<{ kind: "record"; value: Shape }>
  | Readonly<{ kind: "string" }>
  | Readonly<{ kind: "unknown" }>;

type ShapeField = Readonly<{
  shape: Shape;
  optional?: boolean;
}>;

type UnknownRecord = Readonly<Record<string, unknown>>;

const array = (item: Shape): Shape => ({ kind: "array", item });
const boolean: Shape = { kind: "boolean" };
const enumeration = (...values: readonly (boolean | number | string)[]): Shape => ({
  kind: "enum",
  values,
});
const jsonObject: Shape = { kind: "json-object" };
const number: Shape = { kind: "number" };
const object = (fields: Readonly<Record<string, ShapeField>>): Shape => ({
  kind: "object",
  fields,
});
const primitive: Shape = { kind: "primitive" };
const record = (value: Shape): Shape => ({ kind: "record", value });
const string: Shape = { kind: "string" };
const unknown: Shape = { kind: "unknown" };
const field = (shape: Shape): ShapeField => ({ shape });
const optional = (shape: Shape): ShapeField => ({ shape, optional: true });

const compilerTarget = enumeration("canonical", "browser-lite");
const stringArray = array(string);

const moduleReference = object({
  specifier: field(string),
  exportName: optional(string),
});

const buildPluginReference = object({
  specifier: field(string),
  exportName: optional(string),
  options: optional(unknown),
});

const styleReference = object({
  specifier: field(string),
  layer: field(enumeration("theme", "layout", "component", "utility")),
});

const extensionIdentity = {
  apiVersion: field(number),
  baseURL: optional(string),
  compilerTargets: optional(array(compilerTarget)),
  id: field(string),
  version: optional(string),
} as const;

const componentPropManifest = object({
  type: field(enumeration("string", "number", "boolean", "json")),
  description: field(string),
  required: optional(boolean),
  values: optional(array(primitive)),
  default: optional(unknown),
});

const componentManifest = object({
  description: field(string),
  props: optional(record(componentPropManifest)),
  example: optional(string),
});

const pluginComponent = object({
  name: field(string),
  module: field(moduleReference),
  manifest: field(componentManifest),
});

const pluginDefinition = object({
  ...extensionIdentity,
  kind: field(enumeration("plugin")),
  order: optional(
    object({
      before: optional(stringArray),
      after: optional(stringArray),
      requires: optional(stringArray),
    }),
  ),
  build: optional(
    object({
      enforce: optional(enumeration("pre", "normal", "post")),
      remark: optional(array(buildPluginReference)),
      rehype: optional(array(buildPluginReference)),
      recma: optional(array(buildPluginReference)),
      vite: optional(array(buildPluginReference)),
    }),
  ),
  runtime: optional(
    object({
      components: optional(array(pluginComponent)),
      styles: optional(array(styleReference)),
      setup: optional(array(moduleReference)),
      exportSetup: optional(array(moduleReference)),
    }),
  ),
  manifest: field(
    object({
      title: field(string),
      summary: field(string),
      config: optional(
        object({
          description: field(string),
          properties: field(record(componentPropManifest)),
          additionalProperties: optional(boolean),
        }),
      ),
    }),
  ),
});

const layoutSlot = object({
  name: field(string),
  purpose: field(string),
  accepts: field(array(enumeration("text", "media", "code", "component"))),
  required: optional(boolean),
  maxItems: optional(number),
});

const layoutDefinition = object({
  name: field(string),
  module: field(moduleReference),
  description: field(string),
  slots: field(array(layoutSlot)),
  variants: optional(stringArray),
  constraints: optional(jsonObject),
  example: optional(string),
});

const themeDefinition = object({
  ...extensionIdentity,
  kind: field(enumeration("theme")),
  canvas: optional(
    object({
      width: field(number),
      height: field(number),
    }),
  ),
  tokens: field(jsonObject),
  styles: optional(array(styleReference)),
  elements: optional(record(moduleReference)),
  layouts: optional(array(layoutDefinition)),
  motion: optional(
    object({
      id: field(string),
      module: field(moduleReference),
      intents: field(
        array(enumeration("reveal", "focus", "replace", "continuity", "stagger", "ambient")),
      ),
      guidance: optional(stringArray),
    }),
  ),
  manifest: field(
    object({
      title: field(string),
      summary: field(string),
      artDirection: optional(
        object({
          keywords: field(stringArray),
          principles: field(stringArray),
          avoid: field(stringArray),
        }),
      ),
      choices: optional(
        object({
          tones: optional(stringArray),
          emphases: optional(stringArray),
          densities: optional(stringArray),
        }),
      ),
    }),
  ),
});

const pluginRegistration = object({
  plugin: field(pluginDefinition),
  origin: field(enumeration("required", "default", "user")),
  enabled: optional(boolean),
  config: optional(jsonObject),
});

const compilePlanInput = object({
  target: optional(compilerTarget),
  theme: field(themeDefinition),
  plugins: optional(array(pluginRegistration)),
});

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const actualType = (value: unknown): string => {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
};

const ownDataValue = (value: unknown, key: string): unknown => {
  if (!isRecord(value)) {
    return;
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
};

const extensionVersionDiagnostic = (
  definition: unknown,
  kind: "plugin" | "theme",
): Diagnostic | undefined => {
  const apiVersion = ownDataValue(definition, "apiVersion");
  if (
    typeof apiVersion !== "number" ||
    !Number.isFinite(apiVersion) ||
    Object.is(apiVersion, -0) ||
    apiVersion === DREVER_EXTENSION_API_VERSION
  ) {
    return;
  }

  const rawId = ownDataValue(definition, "id");
  const id = typeof rawId === "string" ? rawId : "<unknown>";
  return createDiagnostic(
    "DREVER_EXTENSION_API_VERSION",
    "error",
    `${kind === "plugin" ? "Plugin" : "Theme"} "${id}" uses API version ${apiVersion}; Drever expects ${DREVER_EXTENSION_API_VERSION}.`,
    {
      stage: "config",
      hint: "Install a compatible extension version or update its apiVersion.",
      ...(kind === "plugin" && typeof rawId === "string" ? { plugin: rawId } : {}),
      details: { actual: apiVersion, expected: DREVER_EXTENSION_API_VERSION },
    },
  );
};

const findVersionDiagnostics = (value: unknown): Diagnostic[] => {
  if (!isRecord(value)) {
    return [];
  }

  const diagnostics: Diagnostic[] = [];
  const themeDiagnostic = extensionVersionDiagnostic(ownDataValue(value, "theme"), "theme");
  if (themeDiagnostic) {
    diagnostics.push(themeDiagnostic);
  }

  const plugins = ownDataValue(value, "plugins");
  if (Array.isArray(plugins)) {
    for (const registration of plugins) {
      const diagnostic = extensionVersionDiagnostic(ownDataValue(registration, "plugin"), "plugin");
      if (diagnostic) {
        diagnostics.push(diagnostic);
      }
    }
  }
  return diagnostics;
};

type JsonIssue = Readonly<{ path: string; reason: string }>;

const relativePath = (path: string, prefix: string): string =>
  path === prefix ? "$" : `$${path.slice(prefix.length)}`;

const jsonIssueDiagnostic = (input: CompilePlanInput, issue: JsonIssue): Diagnostic => {
  const pluginMatch = /^\$\.plugins\[(\d+)\]\.(config|plugin)(?=\.|\[|$)/u.exec(issue.path);
  if (pluginMatch) {
    const index = Number(pluginMatch[1]);
    const part = pluginMatch[2];
    const registration = input.plugins?.[index];
    const pluginId = registration?.plugin.id ?? "<unknown>";
    const prefix = `$.plugins[${index}]${part === "plugin" ? ".plugin" : ""}`;
    const path = relativePath(issue.path, prefix);
    const isConfig = part === "config";
    return createDiagnostic(
      isConfig ? "DREVER_PLUGIN_CONFIG_NOT_SERIALIZABLE" : "DREVER_EXTENSION_NOT_SERIALIZABLE",
      "error",
      isConfig
        ? `Plugin "${pluginId}" config is not JSON-safe at ${path}: ${issue.reason}.`
        : `Plugin "${pluginId}" is not JSON-safe at ${path}: ${issue.reason}.`,
      {
        stage: "config",
        plugin: pluginId,
        hint: isConfig
          ? "Use only canonical JSON values in registration.config."
          : "Move executable values into module references and keep options as JSON data.",
        details: { path, reason: issue.reason },
      },
    );
  }

  if (
    issue.path === "$.theme" ||
    issue.path.startsWith("$.theme.") ||
    issue.path.startsWith("$.theme[")
  ) {
    const path = relativePath(issue.path, "$.theme");
    return createDiagnostic(
      "DREVER_EXTENSION_NOT_SERIALIZABLE",
      "error",
      `Theme "${input.theme.id}" is not JSON-safe at ${path}: ${issue.reason}.`,
      {
        stage: "config",
        hint: "Move executable values into module references and keep options as JSON data.",
        details: { path, reason: issue.reason },
      },
    );
  }

  return createDiagnostic(
    "DREVER_CONFIG_NOT_SERIALIZABLE",
    "error",
    `Drever configuration is not JSON-safe at ${issue.path}: ${issue.reason}.`,
    {
      stage: "config",
      hint: "Use only canonical JSON values in drever.config.ts.",
      details: { path: issue.path, reason: issue.reason },
    },
  );
};

const accessFailure = (): DiagnosticResult<CompilePlanInput> => ({
  ok: false,
  diagnostics: [
    createDiagnostic(
      "DREVER_CONFIG_ACCESS_FAILED",
      "error",
      "Drever could not safely read the configuration object.",
      {
        stage: "config",
        hint: "Use plain data objects without getters, proxies, or other executable property access.",
        details: { path: "$" },
      },
    ),
  ],
});

const expectedType = (shape: Shape): string => {
  switch (shape.kind) {
    case "array":
      return "array";
    case "boolean":
    case "number":
    case "string":
      return shape.kind;
    case "enum":
      return shape.values.map((value) => JSON.stringify(value)).join(" | ");
    case "json-object":
    case "object":
    case "record":
      return "object";
    case "primitive":
      return "JSON primitive";
    case "unknown":
      return "value";
  }
};

const addShapeDiagnostic = (
  diagnostics: Diagnostic[],
  path: string,
  expected: string,
  value: unknown,
): void => {
  diagnostics.push(
    createDiagnostic(
      "DREVER_CONFIG_SHAPE_INVALID",
      "error",
      `Invalid Drever configuration at ${path}: expected ${expected}, received ${actualType(value)}.`,
      {
        stage: "config",
        hint: "Check the extension API reference or regenerate this configuration from the documented schema.",
        details: { actualType: actualType(value), expected, path },
      },
    ),
  );
};

const joinPath = (path: string, key: number | string): string =>
  typeof key === "number" ? `${path}[${key}]` : `${path}.${key}`;

const validateShape = (
  value: unknown,
  shape: Shape,
  path: string,
  diagnostics: Diagnostic[],
): boolean => {
  switch (shape.kind) {
    case "unknown":
      return true;
    case "string":
    case "number":
    case "boolean": {
      if (typeof value === shape.kind) {
        return true;
      }
      addShapeDiagnostic(diagnostics, path, expectedType(shape), value);
      return false;
    }
    case "primitive": {
      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        return true;
      }
      addShapeDiagnostic(diagnostics, path, expectedType(shape), value);
      return false;
    }
    case "enum": {
      if (shape.values.includes(value as boolean | number | string)) {
        return true;
      }
      addShapeDiagnostic(diagnostics, path, expectedType(shape), value);
      return false;
    }
    case "array": {
      if (!Array.isArray(value)) {
        addShapeDiagnostic(diagnostics, path, expectedType(shape), value);
        return false;
      }
      let valid = true;
      for (const [index, item] of value.entries()) {
        valid = validateShape(item, shape.item, joinPath(path, index), diagnostics) && valid;
      }
      return valid;
    }
    case "json-object": {
      if (isRecord(value)) {
        return true;
      }
      addShapeDiagnostic(diagnostics, path, expectedType(shape), value);
      return false;
    }
    case "record": {
      if (!isRecord(value)) {
        addShapeDiagnostic(diagnostics, path, expectedType(shape), value);
        return false;
      }
      let valid = true;
      for (const [key, entry] of Object.entries(value)) {
        valid = validateShape(entry, shape.value, joinPath(path, key), diagnostics) && valid;
      }
      return valid;
    }
    case "object": {
      if (!isRecord(value)) {
        addShapeDiagnostic(diagnostics, path, expectedType(shape), value);
        return false;
      }

      let valid = true;
      for (const [key, shapeField] of Object.entries(shape.fields)) {
        const entry = value[key];
        if (entry === undefined) {
          if (!shapeField.optional) {
            addShapeDiagnostic(
              diagnostics,
              joinPath(path, key),
              expectedType(shapeField.shape),
              entry,
            );
            valid = false;
          }
          continue;
        }
        valid = validateShape(entry, shapeField.shape, joinPath(path, key), diagnostics) && valid;
      }

      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(shape.fields, key)) {
          addShapeDiagnostic(diagnostics, joinPath(path, key), "known property", value[key]);
          valid = false;
        }
      }
      return valid;
    }
  }
};

export const decodeCompilePlanInput = (value: unknown): DiagnosticResult<CompilePlanInput> => {
  try {
    const versionDiagnostics = findVersionDiagnostics(value);
    if (versionDiagnostics.length > 0) {
      return { ok: false, diagnostics: versionDiagnostics };
    }

    const diagnostics: Diagnostic[] = [];
    const valid = validateShape(value, compilePlanInput, "$", diagnostics);
    if (!valid) {
      return { ok: false, diagnostics };
    }

    const input = value as CompilePlanInput;
    const issue = findJsonIssue(input);
    if (issue) {
      return { ok: false, diagnostics: [jsonIssueDiagnostic(input, issue)] };
    }

    const snapshot = createJsonSnapshot(input);
    const snapshotDiagnostics: Diagnostic[] = [];
    if (!validateShape(snapshot, compilePlanInput, "$", snapshotDiagnostics)) {
      return { ok: false, diagnostics: snapshotDiagnostics };
    }
    const snapshotIssue = findJsonIssue(snapshot);
    return snapshotIssue
      ? { ok: false, diagnostics: [jsonIssueDiagnostic(snapshot, snapshotIssue)] }
      : { ok: true, value: snapshot, diagnostics: [] };
  } catch {
    return accessFailure();
  }
};

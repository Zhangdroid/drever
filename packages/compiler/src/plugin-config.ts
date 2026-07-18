import type {
  ComponentPropManifest,
  Diagnostic,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  PluginRegistration,
} from "@drever/schema";
import { extensionDiagnostic } from "./extension-diagnostic.ts";
import { findJsonIssue } from "./json-value.ts";

const valueType = (value: JsonValue): string => {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
};

const matchesPropertyType = (property: ComponentPropManifest, value: JsonValue): boolean => {
  switch (property.type) {
    case "boolean":
    case "number":
    case "string":
      return typeof value === property.type;
    case "json":
      return true;
  }
};

const isAllowedValue = (
  allowedValues: readonly JsonPrimitive[] | undefined,
  value: JsonValue,
): boolean =>
  allowedValues === undefined || allowedValues.some((allowed) => Object.is(allowed, value));

const validatePropertyManifest = (
  pluginId: string,
  name: string,
  property: ComponentPropManifest,
  diagnostics: Diagnostic[],
): boolean => {
  if (property.description.trim().length === 0) {
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_PLUGIN_CONFIG_SCHEMA_INVALID",
        `Plugin "${pluginId}" config property "${name}" has no description.`,
        "Describe how authors and AI should use this option.",
        { plugin: pluginId, details: { plugin: pluginId, property: name } },
      ),
    );
  }

  if (property.values) {
    const invalidValue = property.values.find((value) => !matchesPropertyType(property, value));
    if (
      property.values.length === 0 ||
      invalidValue !== undefined ||
      new Set(property.values).size !== property.values.length
    ) {
      diagnostics.push(
        extensionDiagnostic(
          "DREVER_PLUGIN_CONFIG_SCHEMA_INVALID",
          `Plugin "${pluginId}" config property "${name}" has invalid allowed values.`,
          "Declare at least one unique value compatible with the property's type.",
          {
            plugin: pluginId,
            details: { plugin: pluginId, property: name, values: property.values },
          },
        ),
      );
    }
  }

  const defaultIsValid =
    property.default === undefined ||
    (matchesPropertyType(property, property.default) &&
      isAllowedValue(property.values, property.default));
  if (property.default !== undefined && !defaultIsValid) {
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_PLUGIN_CONFIG_SCHEMA_INVALID",
        `Plugin "${pluginId}" config property "${name}" has an invalid default.`,
        "Use a default compatible with the property's type and allowed values.",
        { plugin: pluginId, details: { plugin: pluginId, property: name } },
      ),
    );
  }
  return defaultIsValid;
};

const validateConfiguredValue = (
  pluginId: string,
  name: string,
  property: ComponentPropManifest,
  value: JsonValue,
  diagnostics: Diagnostic[],
): boolean => {
  if (matchesPropertyType(property, value) && isAllowedValue(property.values, value)) {
    return true;
  }

  diagnostics.push(
    extensionDiagnostic(
      "DREVER_PLUGIN_CONFIG_VALUE_INVALID",
      `Plugin "${pluginId}" received an invalid value for config property "${name}".`,
      property.values
        ? `Use one of the declared values: ${property.values.map(String).join(", ")}.`
        : `Use a value of type "${property.type}".`,
      {
        plugin: pluginId,
        details: {
          actualType: valueType(value),
          expectedType: property.type,
          plugin: pluginId,
          property: name,
        },
      },
    ),
  );
  return false;
};

export const resolvePluginRegistrationConfig = (
  registration: PluginRegistration,
  diagnostics: Diagnostic[],
): JsonObject | undefined => {
  const pluginId = registration.plugin.id;
  const configIssue =
    registration.config === undefined ? undefined : findJsonIssue(registration.config, "$.config");
  if (configIssue) {
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_PLUGIN_CONFIG_NOT_SERIALIZABLE",
        `Plugin "${pluginId}" config is not JSON-safe at ${configIssue.path}: ${configIssue.reason}.`,
        "Use only canonical JSON values in registration.config.",
        {
          plugin: pluginId,
          details: { path: configIssue.path, plugin: pluginId, reason: configIssue.reason },
        },
      ),
    );
    return;
  }

  const configured = registration.config ?? {};
  const manifest = registration.plugin.manifest.config;

  if (!manifest) {
    if (Object.keys(configured).length > 0) {
      diagnostics.push(
        extensionDiagnostic(
          "DREVER_PLUGIN_CONFIG_UNDECLARED",
          `Plugin "${pluginId}" does not declare project-level configuration.`,
          "Remove the config object or install a plugin version that publishes a config manifest.",
          { plugin: pluginId, details: { plugin: pluginId } },
        ),
      );
    }
    return;
  }

  if (manifest.description.trim().length === 0) {
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_PLUGIN_CONFIG_SCHEMA_INVALID",
        `Plugin "${pluginId}" has no description for its config object.`,
        "Describe the configuration so authors and AI can use it safely.",
        { plugin: pluginId, details: { plugin: pluginId } },
      ),
    );
  }

  const resolved: [string, JsonValue][] = [];
  const properties = Object.entries(manifest.properties).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  for (const [name, property] of properties) {
    const defaultIsValid = validatePropertyManifest(pluginId, name, property, diagnostics);
    const isConfigured = Object.hasOwn(configured, name);
    const value = isConfigured ? configured[name] : property.default;
    if (value === undefined) {
      if (property.required) {
        diagnostics.push(
          extensionDiagnostic(
            "DREVER_PLUGIN_CONFIG_REQUIRED",
            `Plugin "${pluginId}" requires config property "${name}".`,
            `Set plugins[].config.${name} in drever.config.ts.`,
            { plugin: pluginId, details: { plugin: pluginId, property: name } },
          ),
        );
      }
      continue;
    }

    if (!isConfigured && !defaultIsValid) {
      continue;
    }

    if (validateConfiguredValue(pluginId, name, property, value, diagnostics)) {
      resolved.push([name, value]);
    }
  }

  for (const [name, value] of Object.entries(configured).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (Object.hasOwn(manifest.properties, name)) {
      continue;
    }
    if (manifest.additionalProperties) {
      resolved.push([name, value]);
      continue;
    }
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_PLUGIN_CONFIG_UNKNOWN_PROPERTY",
        `Plugin "${pluginId}" does not declare config property "${name}".`,
        "Remove the property or check the plugin's config manifest.",
        { plugin: pluginId, details: { plugin: pluginId, property: name } },
      ),
    );
  }

  return resolved.length > 0 ? Object.fromEntries(resolved) : undefined;
};

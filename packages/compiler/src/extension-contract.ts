import {
  DREVER_EXTENSION_API_VERSION,
  type ComponentPropManifest,
  type CompilerTarget,
  type Diagnostic,
  type DreverPlugin,
  type JsonValue,
  type ThemeDefinition,
} from "@drever/schema";
import { extensionDiagnostic } from "./extension-diagnostic.ts";
import { findJsonIssue } from "./json-value.ts";

const COMPILER_TARGETS: readonly CompilerTarget[] = ["canonical", "browser-lite"];

const isValidId = (value: string): boolean =>
  value.length > 0 && value.trim() === value && !/\s/u.test(value);

const validateBaseURL = (
  definition: ThemeDefinition | DreverPlugin,
  diagnostics: Diagnostic[],
): void => {
  if (definition.baseURL === undefined) {
    return;
  }

  try {
    new URL(definition.baseURL);
  } catch {
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_EXTENSION_BASE_URL_INVALID",
        `Extension "${definition.id}" has invalid baseURL "${definition.baseURL}".`,
        "Use an absolute URL such as import.meta.url, or omit baseURL when no relative references are used.",
        {
          plugin: definition.kind === "plugin" ? definition.id : undefined,
          details: { baseURL: definition.baseURL, extension: definition.id },
        },
      ),
    );
  }
};

const validateTargets = (
  id: string,
  targets: readonly CompilerTarget[] | undefined,
  diagnostics: Diagnostic[],
  plugin?: string,
): void => {
  if (!targets) {
    return;
  }

  if (targets.length === 0 || new Set(targets).size !== targets.length) {
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_EXTENSION_TARGETS_INVALID",
        `Extension "${id}" has an empty or duplicate compilerTargets list.`,
        "Declare each supported compiler target exactly once.",
        { plugin, details: { targets } },
      ),
    );
    return;
  }

  const unknown = targets.find((target) => !COMPILER_TARGETS.includes(target));
  if (unknown) {
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_EXTENSION_TARGETS_INVALID",
        `Extension "${id}" declares unknown compiler target "${unknown}".`,
        'Use "canonical" or "browser-lite".',
        { plugin, details: { target: unknown } },
      ),
    );
  }
};

export const validateDefinition = (
  definition: ThemeDefinition | DreverPlugin,
  expectedKind: "theme" | "plugin",
  diagnostics: Diagnostic[],
): void => {
  const plugin = expectedKind === "plugin" ? definition.id : undefined;
  const issue = findJsonIssue(definition);
  if (issue) {
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_EXTENSION_NOT_SERIALIZABLE",
        `${expectedKind === "plugin" ? "Plugin" : "Theme"} "${definition.id}" is not JSON-safe at ${issue.path}: ${issue.reason}.`,
        "Move executable values into module references and keep options as JSON data.",
        { plugin, details: { path: issue.path, reason: issue.reason } },
      ),
    );
  }

  if (definition.kind !== expectedKind) {
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_EXTENSION_KIND_INVALID",
        `Extension "${definition.id}" must declare kind "${expectedKind}".`,
        `Set kind to "${expectedKind}".`,
        { plugin, details: { actual: definition.kind, expected: expectedKind } },
      ),
    );
  }

  const apiVersion: number = definition.apiVersion;
  if (apiVersion !== DREVER_EXTENSION_API_VERSION) {
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_EXTENSION_API_VERSION",
        `Extension "${definition.id}" uses API version ${apiVersion}; Drever expects ${DREVER_EXTENSION_API_VERSION}.`,
        "Install a compatible extension version or update its apiVersion.",
        {
          plugin,
          details: { actual: apiVersion, expected: DREVER_EXTENSION_API_VERSION },
        },
      ),
    );
  }

  if (!isValidId(definition.id)) {
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_EXTENSION_ID_INVALID",
        `Extension id "${definition.id}" is invalid.`,
        "Use a non-empty stable id without whitespace.",
        { plugin, details: { id: definition.id } },
      ),
    );
  }

  validateBaseURL(definition, diagnostics);
  validateTargets(definition.id, definition.compilerTargets, diagnostics, plugin);
};

const valueMatchesPropType = (value: JsonValue, type: ComponentPropManifest["type"]): boolean =>
  type === "json" || typeof value === type;

const propManifestDiagnostic = (
  plugin: DreverPlugin,
  component: string,
  prop: string,
  issue: string,
  message: string,
  hint: string,
): Diagnostic =>
  extensionDiagnostic("DREVER_COMPONENT_PROP_MANIFEST_INVALID", message, hint, {
    plugin: plugin.id,
    details: { component, issue, plugin: plugin.id, prop },
  });

const validateComponentPropManifest = (
  plugin: DreverPlugin,
  component: string,
  prop: string,
  manifest: ComponentPropManifest,
  diagnostics: Diagnostic[],
): void => {
  if (manifest.description.trim().length === 0) {
    diagnostics.push(
      propManifestDiagnostic(
        plugin,
        component,
        prop,
        "description-empty",
        `Prop "${prop}" on component "${component}" from plugin "${plugin.id}" has no description.`,
        "Describe the prop so authors and AI know when and how to set it.",
      ),
    );
  }

  const values = manifest.values;
  if (values) {
    if (values.length === 0) {
      diagnostics.push(
        propManifestDiagnostic(
          plugin,
          component,
          prop,
          "values-empty",
          `Prop "${prop}" on component "${component}" declares an empty values list.`,
          "Omit values or declare at least one allowed value.",
        ),
      );
    }

    if (new Set(values).size !== values.length) {
      diagnostics.push(
        propManifestDiagnostic(
          plugin,
          component,
          prop,
          "values-duplicate",
          `Prop "${prop}" on component "${component}" declares duplicate values.`,
          "Declare each allowed value exactly once.",
        ),
      );
    }

    const invalidValueIndex = values.findIndex(
      (value) => !valueMatchesPropType(value, manifest.type),
    );
    if (invalidValueIndex >= 0) {
      diagnostics.push(
        extensionDiagnostic(
          "DREVER_COMPONENT_PROP_MANIFEST_INVALID",
          `Prop "${prop}" on component "${component}" declares a value that does not match type "${manifest.type}".`,
          "Make every allowed value match the declared prop type.",
          {
            plugin: plugin.id,
            details: {
              component,
              index: invalidValueIndex,
              issue: "value-type-mismatch",
              plugin: plugin.id,
              prop,
              type: manifest.type,
            },
          },
        ),
      );
    }
  }

  if (manifest.default === undefined) {
    return;
  }

  if (!valueMatchesPropType(manifest.default, manifest.type)) {
    diagnostics.push(
      propManifestDiagnostic(
        plugin,
        component,
        prop,
        "default-type-mismatch",
        `Prop "${prop}" on component "${component}" has a default that does not match type "${manifest.type}".`,
        "Use a default value matching the declared prop type.",
      ),
    );
    return;
  }

  if (values && values.length > 0 && !values.some((value) => Object.is(value, manifest.default))) {
    diagnostics.push(
      propManifestDiagnostic(
        plugin,
        component,
        prop,
        "default-not-allowed",
        `Prop "${prop}" on component "${component}" has a default outside its allowed values.`,
        "Choose a default from values, or omit the values restriction.",
      ),
    );
  }
};

export const validateThemeContract = (theme: ThemeDefinition, diagnostics: Diagnostic[]): void => {
  if (
    theme.canvas &&
    (!Number.isSafeInteger(theme.canvas.width) ||
      theme.canvas.width <= 0 ||
      !Number.isSafeInteger(theme.canvas.height) ||
      theme.canvas.height <= 0)
  ) {
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_THEME_CANVAS_INVALID",
        `Theme "${theme.id}" has an invalid default canvas.`,
        "Use positive integer width and height values.",
        { details: { canvas: theme.canvas, theme: theme.id } },
      ),
    );
  }

  if (theme.manifest.title.trim().length === 0 || theme.manifest.summary.trim().length === 0) {
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_EXTENSION_MANIFEST_INVALID",
        `Theme "${theme.id}" must provide a title and summary for humans and AI.`,
        "Add non-empty manifest.title and manifest.summary values.",
        { details: { theme: theme.id } },
      ),
    );
  }

  if (theme.motion) {
    if (!isValidId(theme.motion.id)) {
      diagnostics.push(
        extensionDiagnostic(
          "DREVER_THEME_MOTION_INVALID",
          `Theme "${theme.id}" has an invalid motion profile id.`,
          "Use a non-empty stable id without whitespace.",
          { details: { issue: "id-invalid", motion: theme.motion.id, theme: theme.id } },
        ),
      );
    }

    if (new Set(theme.motion.intents).size !== theme.motion.intents.length) {
      diagnostics.push(
        extensionDiagnostic(
          "DREVER_THEME_MOTION_INVALID",
          `Theme "${theme.id}" declares duplicate motion intents.`,
          "Declare each supported core motion intent once.",
          {
            details: { intents: theme.motion.intents, issue: "intents-duplicate", theme: theme.id },
          },
        ),
      );
    }

    for (const [index, guidance] of (theme.motion.guidance ?? []).entries()) {
      if (guidance.trim().length === 0) {
        diagnostics.push(
          extensionDiagnostic(
            "DREVER_THEME_MOTION_INVALID",
            `Theme "${theme.id}" contains empty motion guidance.`,
            "Remove the entry or explain when AI and authors should use the motion profile.",
            {
              details: {
                guidanceIndex: index,
                issue: "guidance-empty",
                motion: theme.motion.id,
                theme: theme.id,
              },
            },
          ),
        );
      }
    }
  }

  for (const layout of theme.layouts ?? []) {
    if (layout.description.trim().length === 0) {
      diagnostics.push(
        extensionDiagnostic(
          "DREVER_LAYOUT_MANIFEST_INVALID",
          `Layout "${layout.name}" in theme "${theme.id}" has no description.`,
          "Describe when AI and authors should use this layout.",
          { details: { layout: layout.name, theme: theme.id } },
        ),
      );
    }

    const slots = new Set<string>();
    for (const slot of layout.slots) {
      if (!/^[a-z][A-Za-z\d]*$/u.test(slot.name) || slots.has(slot.name)) {
        diagnostics.push(
          extensionDiagnostic(
            "DREVER_LAYOUT_SLOT_INVALID",
            `Layout "${layout.name}" has invalid or duplicate slot "${slot.name}".`,
            "Use a unique lower-camel-case slot name.",
            { details: { layout: layout.name, slot: slot.name, theme: theme.id } },
          ),
        );
      }
      slots.add(slot.name);

      if (slot.purpose.trim().length === 0) {
        diagnostics.push(
          extensionDiagnostic(
            "DREVER_LAYOUT_SLOT_MANIFEST_INVALID",
            `Slot "${slot.name}" in layout "${layout.name}" has no purpose.`,
            "Describe the slot so authors and AI know what content belongs there.",
            {
              details: {
                issue: "purpose-empty",
                layout: layout.name,
                slot: slot.name,
                theme: theme.id,
              },
            },
          ),
        );
      }

      if (
        slot.accepts.length === 0 ||
        (slot.maxItems !== undefined &&
          (!Number.isSafeInteger(slot.maxItems) || slot.maxItems <= 0))
      ) {
        diagnostics.push(
          extensionDiagnostic(
            "DREVER_LAYOUT_SLOT_CONSTRAINT_INVALID",
            `Slot "${slot.name}" in layout "${layout.name}" has invalid content constraints.`,
            "Declare at least one accepted content kind and a positive integer maxItems.",
            { details: { layout: layout.name, slot: slot.name, theme: theme.id } },
          ),
        );
      }

      if (new Set(slot.accepts).size !== slot.accepts.length) {
        diagnostics.push(
          extensionDiagnostic(
            "DREVER_LAYOUT_SLOT_CONSTRAINT_INVALID",
            `Slot "${slot.name}" in layout "${layout.name}" declares duplicate accepted content kinds.`,
            "Declare each accepted content kind exactly once.",
            {
              details: {
                accepts: slot.accepts,
                issue: "accepts-duplicate",
                layout: layout.name,
                slot: slot.name,
                theme: theme.id,
              },
            },
          ),
        );
      }
    }

    if (layout.variants && new Set(layout.variants).size !== layout.variants.length) {
      diagnostics.push(
        extensionDiagnostic(
          "DREVER_LAYOUT_VARIANT_INVALID",
          `Layout "${layout.name}" declares duplicate variants.`,
          "Declare each variant once.",
          { details: { layout: layout.name, theme: theme.id, variants: layout.variants } },
        ),
      );
    }
  }
};

export const validatePluginContract = (plugin: DreverPlugin, diagnostics: Diagnostic[]): void => {
  if (plugin.manifest.title.trim().length === 0 || plugin.manifest.summary.trim().length === 0) {
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_EXTENSION_MANIFEST_INVALID",
        `Plugin "${plugin.id}" must provide a title and summary for humans and AI.`,
        "Add non-empty manifest.title and manifest.summary values.",
        { plugin: plugin.id },
      ),
    );
  }

  const enforce: string | undefined = plugin.build?.enforce;
  if (enforce !== undefined && enforce !== "pre" && enforce !== "normal" && enforce !== "post") {
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_PLUGIN_ENFORCE_INVALID",
        `Plugin "${plugin.id}" declares unknown build phase "${enforce}".`,
        'Use "pre", "normal", or "post".',
        { plugin: plugin.id, details: { enforce } },
      ),
    );
  }

  for (const component of plugin.runtime?.components ?? []) {
    if (component.manifest.description.trim().length === 0) {
      diagnostics.push(
        extensionDiagnostic(
          "DREVER_COMPONENT_MANIFEST_INVALID",
          `Component "${component.name}" from plugin "${plugin.id}" has no description.`,
          "Describe the component so authors and AI know when to use it.",
          { plugin: plugin.id, details: { component: component.name } },
        ),
      );
    }

    for (const [prop, manifest] of Object.entries(component.manifest.props ?? {})) {
      validateComponentPropManifest(plugin, component.name, prop, manifest, diagnostics);
    }
  }
};

const supportsTarget = (
  definition: ThemeDefinition | DreverPlugin,
  target: CompilerTarget,
): boolean => (definition.compilerTargets ?? ["canonical"]).includes(target);

export const validateTargetSupport = (
  definition: ThemeDefinition | DreverPlugin,
  target: CompilerTarget,
  diagnostics: Diagnostic[],
): void => {
  if (supportsTarget(definition, target)) {
    return;
  }

  const plugin = definition.kind === "plugin" ? definition.id : undefined;
  diagnostics.push(
    extensionDiagnostic(
      "DREVER_EXTENSION_TARGET_UNSUPPORTED",
      `${definition.kind === "plugin" ? "Plugin" : "Theme"} "${definition.id}" does not support the ${target} compiler.`,
      target === "browser-lite"
        ? "Use the canonical compiler or select an extension with a registered browser-lite implementation."
        : "Select an extension that supports the canonical compiler.",
      { plugin, details: { target } },
    ),
  );
};

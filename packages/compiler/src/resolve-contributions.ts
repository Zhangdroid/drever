import type {
  CompilePlan,
  Diagnostic,
  ExtensionOwner,
  OwnedModuleReference,
  OwnedStyleReference,
  PlannedComponent,
  PlannedElement,
  PlannedLayout,
  PlannedPlugin,
  PluginRegistration,
  ThemeDefinition,
} from "@drever/schema";
import { isThemeElementName, registerComponentName } from "./component-registry.ts";
import { extensionDiagnostic, ownerLabel } from "./extension-diagnostic.ts";
import { collectOwnedModules, normalizeModule, normalizeStyle } from "./module-reference.ts";
import { resolvePluginRegistrationConfig } from "./plugin-config.ts";

type ThemeContributions = Readonly<{
  elements: readonly PlannedElement[];
  layouts: readonly PlannedLayout[];
  styles: readonly OwnedStyleReference[];
}>;

type PluginContributions = Readonly<{
  plugins: readonly PlannedPlugin[];
  components: readonly PlannedComponent[];
  styles: readonly OwnedStyleReference[];
  setup: readonly OwnedModuleReference[];
  exportSetup: readonly OwnedModuleReference[];
}>;

type BuildContributions = CompilePlan["build"];

export const resolveThemeContributions = (
  theme: ThemeDefinition,
  owner: ExtensionOwner,
  componentNames: Map<string, string>,
  diagnostics: Diagnostic[],
): ThemeContributions => {
  const elements: PlannedElement[] = [];
  for (const [name, reference] of Object.entries(theme.elements ?? {}).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (!isThemeElementName(name)) {
      diagnostics.push(
        extensionDiagnostic(
          "DREVER_THEME_ELEMENT_INVALID",
          `Theme "${theme.id}" cannot provide unknown Markdown element "${name}".`,
          "Use a supported intrinsic element or define a layout instead.",
          { details: { element: name, theme: theme.id } },
        ),
      );
      continue;
    }
    const module = normalizeModule(reference, theme.baseURL, owner, diagnostics);
    if (module) {
      elements.push({ name, owner, module });
    }
  }

  const layouts: PlannedLayout[] = [];
  for (const layout of theme.layouts ?? []) {
    if (!registerComponentName(layout.name, owner, componentNames, diagnostics)) {
      continue;
    }
    const module = normalizeModule(layout.module, theme.baseURL, owner, diagnostics);
    if (module) {
      layouts.push({ ...layout, owner, module });
    }
  }

  const styles: OwnedStyleReference[] = [];
  for (const style of theme.styles ?? []) {
    if (style.layer !== "theme" && style.layer !== "layout") {
      diagnostics.push(
        extensionDiagnostic(
          "DREVER_STYLE_LAYER_INVALID",
          `Theme "${theme.id}" cannot write to the "${style.layer}" style layer.`,
          'Theme styles must use the "theme" or "layout" layer.',
          { details: { layer: style.layer, owner: ownerLabel(owner) } },
        ),
      );
      continue;
    }
    const normalized = normalizeStyle(style, theme.baseURL, owner, diagnostics);
    if (normalized) {
      styles.push({ owner, style: normalized });
    }
  }

  return {
    elements,
    layouts,
    styles,
  };
};

export const resolvePluginContributions = (
  registrations: readonly PluginRegistration[],
  componentNames: Map<string, string>,
  diagnostics: Diagnostic[],
): PluginContributions => {
  const plugins: PlannedPlugin[] = [];
  const components: PlannedComponent[] = [];
  const styles: OwnedStyleReference[] = [];
  const setup: OwnedModuleReference[] = [];
  const exportSetup: OwnedModuleReference[] = [];

  for (const registration of registrations) {
    const plugin = registration.plugin;
    const owner: ExtensionOwner = { kind: "plugin", id: plugin.id };
    const config = resolvePluginRegistrationConfig(registration, diagnostics);
    plugins.push({
      id: plugin.id,
      ...(plugin.version === undefined ? {} : { version: plugin.version }),
      origin: registration.origin,
      ...(config === undefined ? {} : { config }),
    });

    for (const component of plugin.runtime?.components ?? []) {
      if (!registerComponentName(component.name, owner, componentNames, diagnostics)) {
        continue;
      }
      const module = normalizeModule(component.module, plugin.baseURL, owner, diagnostics);
      if (module) {
        components.push({ ...component, owner, module });
      }
    }

    for (const style of plugin.runtime?.styles ?? []) {
      if (style.layer !== "component" && style.layer !== "utility") {
        diagnostics.push(
          extensionDiagnostic(
            "DREVER_STYLE_LAYER_INVALID",
            `Plugin "${plugin.id}" cannot write to the "${style.layer}" style layer.`,
            'Plugin styles must use the "component" or "utility" layer.',
            { plugin: plugin.id, details: { layer: style.layer, owner: ownerLabel(owner) } },
          ),
        );
        continue;
      }
      const normalized = normalizeStyle(style, plugin.baseURL, owner, diagnostics);
      if (normalized) {
        styles.push({ owner, style: normalized });
      }
    }

    setup.push(...collectOwnedModules(plugin.runtime?.setup, owner, plugin.baseURL, diagnostics));
    exportSetup.push(
      ...collectOwnedModules(plugin.runtime?.exportSetup, owner, plugin.baseURL, diagnostics),
    );
  }

  return { plugins, components, styles, setup, exportSetup };
};

export const resolveBuildContributions = (
  registrations: readonly PluginRegistration[],
  diagnostics: Diagnostic[],
): BuildContributions => {
  const collect = (key: "remark" | "rehype" | "recma" | "vite"): BuildContributions["remark"] =>
    registrations.flatMap((registration) => {
      const plugin = registration.plugin;
      const owner: ExtensionOwner = { kind: "plugin", id: plugin.id };
      const phase = plugin.build?.enforce ?? "normal";
      return collectOwnedModules(plugin.build?.[key], owner, plugin.baseURL, diagnostics).map(
        (reference) => ({ ...reference, phase }),
      );
    });

  return {
    remark: collect("remark"),
    rehype: collect("rehype"),
    recma: collect("recma"),
    vite: collect("vite"),
  };
};

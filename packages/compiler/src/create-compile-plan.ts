import {
  COMPILE_PLAN_VERSION,
  type CompilePlan,
  type CompilerTarget,
  type Diagnostic,
  type DiagnosticResult,
  type ExtensionOwner,
  type PluginRegistration,
} from "@drever/schema";
import { createDiagnostic } from "./diagnostics.ts";
import { decodeCompilePlanInput, type CompilePlanInput } from "./decode-compile-plan-input.ts";
import {
  validateDefinition,
  validatePluginContract,
  validateTargetSupport,
  validateThemeContract,
} from "./extension-contract.ts";
import { extensionDiagnostic } from "./extension-diagnostic.ts";
import { finalizeResult } from "./finalize-result.ts";
import { findJsonIssue } from "./json-value.ts";
import { orderBuildPlugins } from "./order-plugins.ts";
import {
  resolveBuildContributions,
  resolvePluginContributions,
  resolveThemeContributions,
} from "./resolve-contributions.ts";

export type CreateCompilePlanOptions = CompilePlanInput;

const PLUGIN_ORIGIN_RANK: Readonly<Record<PluginRegistration["origin"], number>> = {
  required: 0,
  default: 1,
  user: 2,
};

const validateRegistrations = (
  registrations: readonly PluginRegistration[],
  diagnostics: Diagnostic[],
): void => {
  const registrationsById = new Map<string, PluginRegistration>();

  for (const registration of registrations) {
    const plugin = registration.plugin;
    validateDefinition(plugin, "plugin", diagnostics);
    validatePluginContract(plugin, diagnostics);

    if (registration.origin === "user" && plugin.id.startsWith("drever:")) {
      diagnostics.push(
        extensionDiagnostic(
          "DREVER_PLUGIN_ID_RESERVED",
          `Plugin id "${plugin.id}" uses Drever's reserved internal namespace.`,
          "Use your npm package name or another globally stable id.",
          { plugin: plugin.id, details: { id: plugin.id } },
        ),
      );
    }

    const existing = registrationsById.get(plugin.id);
    if (existing) {
      diagnostics.push(
        extensionDiagnostic(
          "DREVER_PLUGIN_DUPLICATE",
          `Plugin "${plugin.id}" is registered more than once.`,
          "Keep one registration and configure that instance explicitly.",
          {
            plugin: plugin.id,
            details: { origins: [existing.origin, registration.origin] },
          },
        ),
      );
    } else {
      registrationsById.set(plugin.id, registration);
    }

    if (registration.origin === "required" && registration.enabled === false) {
      diagnostics.push(
        extensionDiagnostic(
          "DREVER_PLUGIN_REQUIRED_DISABLED",
          `Required plugin "${plugin.id}" cannot be disabled.`,
          "Remove the disabled setting for this plugin.",
          { plugin: plugin.id },
        ),
      );
    }
  }
};

const activeRegistrations = (
  registrations: readonly PluginRegistration[],
): readonly PluginRegistration[] =>
  registrations
    .filter((registration) => registration.enabled !== false)
    .toSorted((left, right) => PLUGIN_ORIGIN_RANK[left.origin] - PLUGIN_ORIGIN_RANK[right.origin]);

const validateActiveTargets = (
  registrations: readonly PluginRegistration[],
  target: CompilerTarget,
  diagnostics: Diagnostic[],
): void => {
  for (const registration of registrations) {
    const plugin = registration.plugin;
    validateTargetSupport(plugin, target, diagnostics);
    if (target === "browser-lite" && (plugin.build?.vite?.length ?? 0) > 0) {
      diagnostics.push(
        extensionDiagnostic(
          "DREVER_PLUGIN_CAPABILITY_UNSUPPORTED",
          `Plugin "${plugin.id}" contributes Vite plugins and cannot run in browser-lite.`,
          "Use the canonical compiler or provide a browser-lite variant without Vite hooks.",
          { plugin: plugin.id, details: { capability: "vite", target } },
        ),
      );
    }
  }
};

const createCompilePlanResult = (
  options: CreateCompilePlanOptions,
): DiagnosticResult<CompilePlan> => {
  const decoded = decodeCompilePlanInput(options);
  if (!decoded.ok) {
    return decoded;
  }

  const input = decoded.value;
  const target = input.target ?? "canonical";
  const registrations = input.plugins ?? [];
  const diagnostics: Diagnostic[] = [];

  validateDefinition(input.theme, "theme", diagnostics);
  validateThemeContract(input.theme, diagnostics);
  validateTargetSupport(input.theme, target, diagnostics);
  validateRegistrations(registrations, diagnostics);

  const active = activeRegistrations(registrations);
  validateActiveTargets(active, target, diagnostics);
  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }

  const buildOrder = orderBuildPlugins(active);
  if (!buildOrder.ok) {
    return buildOrder;
  }

  const themeOwner: ExtensionOwner = { kind: "theme", id: input.theme.id };
  const componentNames = new Map<string, string>();
  const theme = resolveThemeContributions(input.theme, themeOwner, componentNames, diagnostics);
  const plugins = resolvePluginContributions(active, componentNames, diagnostics);
  const build = resolveBuildContributions(buildOrder.value, diagnostics);
  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }

  const plan: CompilePlan = {
    version: COMPILE_PLAN_VERSION,
    target,
    theme: {
      id: input.theme.id,
      ...(input.theme.version === undefined ? {} : { version: input.theme.version }),
      ...(input.theme.canvas === undefined ? {} : { canvas: input.theme.canvas }),
      tokens: input.theme.tokens,
      ...(input.theme.motion && theme.motionModule
        ? { motion: { ...input.theme.motion, module: theme.motionModule } }
        : {}),
      manifest: input.theme.manifest,
    },
    plugins: plugins.plugins,
    build,
    runtime: {
      elements: theme.elements,
      layouts: theme.layouts,
      components: plugins.components,
      styles: [...theme.styles, ...plugins.styles],
      setup: plugins.setup,
      exportSetup: plugins.exportSetup,
    },
  };

  const planIssue = findJsonIssue(plan);
  if (planIssue) {
    return {
      ok: false,
      diagnostics: [
        createDiagnostic(
          "DREVER_INTERNAL_PLAN_SERIALIZATION",
          "error",
          `CompilePlan is not JSON-safe at ${planIssue.path}: ${planIssue.reason}.`,
          {
            stage: "compile",
            hint: "Please report this as a Drever compiler bug.",
            details: { path: planIssue.path, reason: planIssue.reason },
          },
        ),
      ],
    };
  }

  return { ok: true, value: plan, diagnostics: [] };
};

export const createCompilePlan = (
  options: CreateCompilePlanOptions,
): DiagnosticResult<CompilePlan> => finalizeResult(createCompilePlanResult(options));

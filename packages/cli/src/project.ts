import defaultTheme from "@drever/designs/default";
import shikiPlugin from "@drever/plugin-shiki";
import tailwindCssPlugin from "@drever/plugin-tailwindcss";
import {
  createCompilePlan,
  type CompilePlan,
  type DreverPlugin,
  type PluginRegistration,
} from "@drever/compiler";
import { createDreverVitePlugins } from "@drever/vite";
import type { DeckManifest } from "@drever/schema";
import { realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, sep } from "node:path";
import type { PluginOption } from "vite";
import type { DreverConfig, DreverPluginUse } from "./config.ts";
import { resolveConfigPath } from "./config.ts";
import { DreverCliError } from "./errors.ts";

export type ResolvedDreverPlan = Readonly<{
  config: DreverConfig;
  entry: string;
  plan: CompilePlan;
  root: string;
}>;

export type ResolvedDreverProject = ResolvedDreverPlan &
  Readonly<{
    outDir: string;
    plugins: readonly PluginOption[];
    getDeckManifest(): DeckManifest | undefined;
  }>;

const DEFAULT_ENTRY = "slides.mdx";
const DEFAULT_OUT_DIR = "dist";
const DEFAULT_PLUGINS: readonly DreverPlugin[] = Object.freeze([shikiPlugin, tailwindCssPlugin]);

const entryNotFound = (path: string, cause?: unknown): DreverCliError =>
  new DreverCliError("DREVER_ENTRY_NOT_FOUND", `Deck entry not found: ${path}`, {
    ...(cause === undefined ? {} : { cause }),
    details: { path },
    hint: "Create slides.mdx, set entry in drever.config.ts, or pass an entry path.",
  });

const diagnosticsMessage = (
  diagnostics: readonly Readonly<{ code: string; message: string }>[],
): string => diagnostics.map(({ code, message }) => `${code}: ${message}`).join("\n");

const normalizePlugin = (input: DreverPlugin | DreverPluginUse): PluginRegistration => {
  if (!("plugin" in input)) {
    return Object.freeze({ origin: "user", plugin: input });
  }
  return Object.freeze({
    origin: "user",
    plugin: input.plugin,
    ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
    ...(input.config === undefined ? {} : { config: input.config }),
  });
};

const defaultRegistration = (
  plugin: DreverPlugin,
  override?: PluginRegistration,
): PluginRegistration =>
  Object.freeze({
    origin: "default",
    plugin,
    ...(override?.enabled === undefined ? {} : { enabled: override.enabled }),
    ...(override?.config === undefined ? {} : { config: override.config }),
  });

/** Resolves built-in defaults and lets the first matching config entry override each default. */
export const resolvePluginRegistrations = (
  inputs: readonly (DreverPlugin | DreverPluginUse)[] = [],
): readonly PluginRegistration[] => {
  const defaultIds = new Set(DEFAULT_PLUGINS.map((plugin) => plugin.id));
  const overrides = new Map<string, PluginRegistration>();
  const users: PluginRegistration[] = [];

  for (const input of inputs) {
    const registration = normalizePlugin(input);
    const id = registration.plugin.id;
    if (defaultIds.has(id) && !overrides.has(id)) {
      overrides.set(id, registration);
    } else {
      users.push(registration);
    }
  }

  return Object.freeze([
    ...DEFAULT_PLUGINS.map((plugin) => defaultRegistration(plugin, overrides.get(plugin.id))),
    ...users,
  ]);
};

const ensureEntry = async (path: string): Promise<void> => {
  let metadata;
  try {
    metadata = await stat(path);
  } catch (cause) {
    throw entryNotFound(path, cause);
  }
  if (!metadata.isFile()) {
    throw entryNotFound(path);
  }

  const extension = extname(path).toLowerCase();
  if (extension !== ".md" && extension !== ".mdx") {
    throw new DreverCliError(
      "DREVER_ENTRY_EXTENSION_UNSUPPORTED",
      `Deck entry must use .md or .mdx: ${path}`,
      { details: { extension, path } },
    );
  }
};

const resolveOutDir = (root: string, configured?: string): string => {
  const outDir = resolveConfigPath(root, configured ?? DEFAULT_OUT_DIR);
  const relation = relative(root, outDir);
  if (
    relation === "" ||
    relation === ".." ||
    isAbsolute(relation) ||
    relation.startsWith(`..${sep}`)
  ) {
    throw new DreverCliError(
      "DREVER_BUILD_OUT_DIR_UNSAFE",
      "build.outDir must be a directory inside the Drever project.",
      {
        details: { outDir, root },
        hint: 'Use a relative directory such as "dist".',
      },
    );
  }
  return outDir;
};

export type ResolveDreverEntryOptions = Readonly<{
  config: DreverConfig;
  entry?: string;
  root: string;
}>;

export type ResolveDreverProjectOptions = ResolveDreverEntryOptions;
export type ResolveDreverPlanOptions = ResolveDreverEntryOptions;

export const resolveDreverEntry = async ({
  config,
  entry: positionalEntry,
  root,
}: ResolveDreverEntryOptions): Promise<string> => {
  const entry = resolveConfigPath(root, positionalEntry ?? config.entry ?? DEFAULT_ENTRY);
  await ensureEntry(entry);
  return entry;
};

/** Resolves the entry and canonical extension plan without loading adapter modules. */
export const resolveDreverPlan = async ({
  config,
  entry: positionalEntry,
  root,
}: ResolveDreverPlanOptions): Promise<ResolvedDreverPlan> => {
  const entry = await resolveDreverEntry({
    config,
    ...(positionalEntry === undefined ? {} : { entry: positionalEntry }),
    root,
  });
  const planResult = createCompilePlan({
    theme: config.theme ?? defaultTheme,
    plugins: resolvePluginRegistrations(config.plugins),
  });
  if (!planResult.ok) {
    throw new DreverCliError(
      "DREVER_COMPILE_PLAN_INVALID",
      diagnosticsMessage(planResult.diagnostics),
      {
        details: { diagnostics: planResult.diagnostics },
        hint: "Fix the theme or plugin registrations in drever.config.ts.",
      },
    );
  }

  return Object.freeze({ config, entry, plan: planResult.value, root });
};

export const resolveDreverProject = async (
  options: ResolveDreverProjectOptions,
): Promise<ResolvedDreverProject> => {
  const resolved = await resolveDreverPlan(options);
  const canonicalEntry = await realpath(resolved.entry);

  let deckManifest: DeckManifest | undefined;
  const pluginResult = await createDreverVitePlugins(resolved.plan, {
    root: resolved.root,
    onDeckManifest(manifest, path) {
      if (path === resolved.entry || path === canonicalEntry) {
        deckManifest = manifest;
      }
    },
  });
  if (!pluginResult.ok) {
    throw new DreverCliError(
      "DREVER_ADAPTER_CONFIG_INVALID",
      diagnosticsMessage(pluginResult.diagnostics),
      {
        details: { diagnostics: pluginResult.diagnostics },
        hint: "Fix the build-time modules contributed by the configured extensions.",
      },
    );
  }

  return Object.freeze({
    ...resolved,
    getDeckManifest: () => deckManifest,
    outDir: resolveOutDir(resolved.root, resolved.config.build?.outDir),
    plugins: pluginResult.value,
  });
};

import {
  DREVER_DECK_MANIFEST_DATA_KEY,
  recmaDreverDeckManifest,
  recmaDreverDeckSeal,
  rehypeDreverDeckManifest,
  remarkDreverDevSelection,
  remarkDreverDeckManifest,
  remarkDreverSlideGrammar,
} from "@drever/compiler/internal";
import {
  COMPILE_PLAN_VERSION,
  type CompilePlan,
  type DeckManifest,
  type DiagnosticResult,
} from "@drever/schema";
import mdx, { type Options as MdxOptions } from "@mdx-js/rollup";
import react from "@vitejs/plugin-react";
import type { Plugin as UnifiedPlugin } from "unified";
import type { Plugin, PluginOption } from "vite";
import { loadBuildModules, type ImportModule } from "./load-build-modules.ts";
import { createRuntimeModulePlugin, DREVER_MDX_COMPONENTS_MODULE_ID } from "./runtime-module.ts";

export type CreateDreverVitePluginsOptions = Readonly<{
  root?: string;
  cacheDir?: string;
  importModule?: ImportModule;
  include?: MdxOptions["include"];
  exclude?: MdxOptions["exclude"];
  includeSourceLocations?: boolean;
  onDeckManifest?: (manifest: DeckManifest, path: string) => void;
}>;

const captureDeckManifest = (
  onDeckManifest: NonNullable<CreateDreverVitePluginsOptions["onDeckManifest"]>,
): UnifiedPlugin =>
  function dreverCaptureDeckManifest() {
    return (_tree, file) => {
      const manifest = file.data[DREVER_DECK_MANIFEST_DATA_KEY];
      if (manifest !== undefined) {
        onDeckManifest(manifest as DeckManifest, file.path);
      }
    };
  };

const planDiagnostic = (
  code: string,
  message: string,
  hint: string,
  details: Readonly<Record<string, number | string>>,
): DiagnosticResult<readonly PluginOption[]> => ({
  ok: false,
  diagnostics: [
    Object.freeze({
      code,
      severity: "error",
      stage: "config",
      message,
      hint,
      details: Object.freeze({ ...details }),
    }),
  ],
});

export const createDreverVitePlugins = async (
  plan: CompilePlan,
  options: CreateDreverVitePluginsOptions = {},
): Promise<DiagnosticResult<readonly PluginOption[]>> => {
  if (plan.version !== COMPILE_PLAN_VERSION) {
    return planDiagnostic(
      "DREVER_COMPILE_PLAN_VERSION",
      `CompilePlan version ${String(plan.version)} is incompatible with this adapter.`,
      "Regenerate the plan with a matching @drever/compiler version.",
      { actual: plan.version, expected: COMPILE_PLAN_VERSION },
    );
  }
  if (plan.target !== "canonical") {
    return planDiagnostic(
      "DREVER_VITE_TARGET_INVALID",
      `The Vite adapter cannot execute a ${plan.target} CompilePlan.`,
      "Create a canonical CompilePlan for Node and Vite builds.",
      { target: plan.target },
    );
  }

  const loaded = await loadBuildModules(plan, {
    ...(options.root === undefined ? {} : { root: options.root }),
    ...(options.cacheDir === undefined ? {} : { cacheDir: options.cacheDir }),
    ...(options.importModule === undefined ? {} : { importModule: options.importModule }),
  });
  if (!loaded.ok) {
    return loaded;
  }

  const createCanonicalMdxPlugin = (apply: "build" | "serve", devSelection: boolean): Plugin => {
    const mdxPlugin = mdx({
      providerImportSource: DREVER_MDX_COMPONENTS_MODULE_ID,
      jsxImportSource: "react",
      remarkPlugins: [
        remarkDreverSlideGrammar,
        ...loaded.value.remark,
        ...(devSelection ? [remarkDreverDevSelection] : []),
        remarkDreverDeckManifest,
        ...(options.onDeckManifest === undefined
          ? []
          : [captureDeckManifest(options.onDeckManifest)]),
      ],
      rehypePlugins: [...loaded.value.rehype, rehypeDreverDeckManifest],
      recmaPlugins: [recmaDreverDeckSeal, ...loaded.value.recma, recmaDreverDeckManifest],
      ...(options.include === undefined ? {} : { include: options.include }),
      ...(options.exclude === undefined ? {} : { exclude: options.exclude }),
    }) as unknown as Plugin;
    const descriptors = Object.getOwnPropertyDescriptors(mdxPlugin);
    descriptors.apply = {
      configurable: true,
      enumerable: true,
      value: apply,
      writable: true,
    };
    descriptors.enforce = {
      configurable: true,
      enumerable: true,
      value: "pre",
      writable: true,
    };
    return Object.create(Object.getPrototypeOf(mdxPlugin) as object | null, descriptors) as Plugin;
  };
  const buildMdxPlugin = createCanonicalMdxPlugin("build", options.includeSourceLocations === true);
  const devMdxPlugin = createCanonicalMdxPlugin("serve", true);
  const reactPlugins = react({ include: /\.(?:md|mdx|[jt]sx?)$/u });

  return {
    ok: true,
    value: Object.freeze([
      createRuntimeModulePlugin(plan),
      buildMdxPlugin,
      devMdxPlugin,
      ...loaded.value.vite,
      ...reactPlugins,
    ]),
    diagnostics: [],
  };
};

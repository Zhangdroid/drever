import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  defineRecmaPlugin,
  defineRehypePlugin,
  defineRemarkPlugin,
  defineVitePlugin,
  type BuildPluginContext,
} from "@drever/plugin";
import type { JsonObject, PlannedBuildPlugin } from "@drever/schema";
import { unified, type Plugin as UnifiedPlugin } from "unified";
import type { Plugin as VitePlugin } from "vite";
import { describe, expect, it } from "vite-plus/test";
import {
  loadBuildModules,
  loadRemarkModules,
  type ImportModule,
  type ModuleNamespace,
} from "./load-build-modules.ts";
import { createTestPlan } from "./test/plan.ts";

const entry = (
  capability: "recma" | "rehype" | "remark" | "vite",
  specifier: string,
  options?: PlannedBuildPlugin["module"]["options"],
  phase: PlannedBuildPlugin["phase"] = "normal",
): PlannedBuildPlugin => ({
  owner: { kind: "plugin", id: "feature" },
  phase,
  module: {
    specifier,
    exportName: capability === "rehype" ? "named" : "default",
    ...(options === undefined ? {} : { options }),
  },
});

const importer =
  (modules: Readonly<Record<string, ModuleNamespace>>): ImportModule =>
  async (specifier) => {
    const namespace = modules[specifier];
    if (!namespace) {
      throw new Error(`Missing test module: ${specifier}`);
    }
    return namespace;
  };

type TestProcessor = ReturnType<typeof unified>;

const useUnifiedPlugin = (processor: TestProcessor, plugin: unknown): TestProcessor =>
  (processor.use as unknown as (value: unknown) => TestProcessor)(plugin);

const runUnified = (processor: TestProcessor): Promise<unknown> =>
  (processor.run as unknown as (tree: unknown) => Promise<unknown>)({
    type: "root",
    children: [],
  });

describe("loadBuildModules", () => {
  it("loads only remark factories for manifest-only compilation", async () => {
    const capabilities: string[] = [];
    const plan = createTestPlan({
      plugins: [{ id: "feature", origin: "user" }],
      build: {
        remark: [entry("remark", "remark")],
        rehype: [entry("rehype", "rehype")],
        recma: [entry("recma", "recma")],
        vite: [entry("vite", "vite")],
      },
    });
    const result = await loadRemarkModules(plan, {
      importModule: importer({
        remark: {
          default: defineRemarkPlugin((context) => {
            capabilities.push(context.capability);
            return () => undefined;
          }),
        },
      }),
    });

    expect(result.ok).toBe(true);
    expect(capabilities).toEqual(["remark"]);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(Object.isFrozen(result.value)).toBe(true);
    }
  });

  it("loads capability descriptors in plan order with isolated frozen context", async () => {
    const contexts: BuildPluginContext<never>[] = [];
    const unifiedPlugin = () => undefined;
    const capture = <Capability extends "recma" | "rehype" | "remark" | "vite">(
      context: BuildPluginContext<Capability>,
    ): void => {
      contexts.push(context as BuildPluginContext<never>);
    };
    const modules = {
      remark: {
        default: defineRemarkPlugin((context) => {
          capture(context);
          return unifiedPlugin;
        }),
      },
      rehype: {
        named: defineRehypePlugin((context) => {
          capture(context);
          return unifiedPlugin;
        }),
      },
      recma: {
        default: defineRecmaPlugin((context) => {
          capture(context);
          return unifiedPlugin;
        }),
      },
      vite: {
        default: defineVitePlugin((context) => {
          capture(context);
          return { name: "feature:vite" };
        }),
      },
    } satisfies Readonly<Record<string, ModuleNamespace>>;
    const config: JsonObject = { mode: { color: "dark" } };
    const plan = createTestPlan({
      plugins: [{ id: "feature", origin: "user", config }],
      build: {
        remark: [entry("remark", "remark", { order: 1 })],
        rehype: [entry("rehype", "rehype", { order: 2 })],
        recma: [entry("recma", "recma")],
        vite: [entry("vite", "vite", undefined, "pre")],
      },
    });

    const projectRoot = resolve("fixtures/deck-project");
    const result = await loadBuildModules(plan, {
      importModule: importer(modules),
      root: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(contexts.map(({ capability }) => capability)).toEqual([
      "remark",
      "rehype",
      "recma",
      "vite",
    ]);
    expect(contexts.map(({ phase }) => phase)).toEqual(["normal", "normal", "normal", "pre"]);
    expect(contexts.map(({ projectRoot: root }) => root)).toEqual([
      projectRoot,
      projectRoot,
      projectRoot,
      projectRoot,
    ]);
    expect(contexts[0]?.pluginConfig).toBe(contexts[3]?.pluginConfig);
    expect(contexts[0]?.pluginConfig).toEqual(config);
    expect(Object.isFrozen(contexts[0]?.pluginConfig)).toBe(true);
    expect(Object.isFrozen(contexts[0]?.pluginConfig.mode)).toBe(true);
    expect(Object.isFrozen(contexts[0]?.hookOptions)).toBe(true);
    expect(result.value.remark).toHaveLength(1);
    expect(result.value.rehype).toHaveLength(1);
    expect(result.value.recma).toHaveLength(1);
    expect(result.value.remark[0]).not.toBe(unifiedPlugin);
    expect(result.value.rehype[0]).not.toBe(unifiedPlugin);
    expect(result.value.recma[0]).not.toBe(unifiedPlugin);
    expect(result.value.vite).toMatchObject([{ name: "feature:vite", enforce: "pre" }]);
  });

  it("uses one frozen empty config when a plugin has no project config", async () => {
    const configs: JsonObject[] = [];
    const module = defineRemarkPlugin((context) => {
      configs.push(context.pluginConfig);
      return () => undefined;
    });
    const plan = createTestPlan({
      plugins: [{ id: "feature", origin: "user" }],
      build: { remark: [entry("remark", "first"), entry("remark", "second")] },
    });

    const result = await loadBuildModules(plan, {
      importModule: importer({ first: { default: module }, second: { default: module } }),
    });

    expect(result.ok).toBe(true);
    expect(configs).toHaveLength(2);
    expect(configs[0]).toBe(configs[1]);
    expect(configs[0]).toEqual({});
    expect(Object.isFrozen(configs[0])).toBe(true);
  });

  it.each([
    {
      name: "import failure",
      expected: "DREVER_BUILD_MODULE_IMPORT_FAILED",
      modules: {},
    },
    {
      name: "missing export",
      expected: "DREVER_BUILD_MODULE_EXPORT_MISSING",
      modules: { broken: {} },
    },
    {
      name: "invalid descriptor",
      expected: "DREVER_BUILD_MODULE_INVALID",
      modules: { broken: { default: () => undefined } },
    },
    {
      name: "capability mismatch",
      expected: "DREVER_BUILD_CAPABILITY_MISMATCH",
      modules: { broken: { default: defineRehypePlugin(() => () => undefined) } },
    },
    {
      name: "factory failure",
      expected: "DREVER_BUILD_MODULE_EXECUTION_FAILED",
      modules: {
        broken: {
          default: defineRemarkPlugin(() => {
            throw new Error("factory boom");
          }),
        },
      },
    },
  ])("returns structured diagnostics for $name", async ({ expected, modules }) => {
    const plan = createTestPlan({
      plugins: [{ id: "feature", origin: "user" }],
      build: { remark: [entry("remark", "broken")] },
    });

    const result = await loadBuildModules(plan, { importModule: importer(modules) });

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: expected,
          plugin: "feature",
          details: { capability: "remark", specifier: "broken" },
        },
      ],
    });
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it("rejects native Vite enforce that conflicts with the planned phase", async () => {
    const plan = createTestPlan({
      plugins: [{ id: "feature", origin: "user" }],
      build: { vite: [entry("vite", "vite", undefined, "normal")] },
    });
    const result = await loadBuildModules(plan, {
      importModule: importer({
        vite: { default: defineVitePlugin(() => ({ name: "conflict", enforce: "pre" })) },
      }),
    });

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: "DREVER_VITE_PLUGIN_PHASE_CONFLICT" }],
    });
  });

  it("atomically shares one content-addressed proxy across concurrent loaders", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-build-loader-"));
    const packageDirectory = join(root, "node_modules", "fixture-plugin");
    try {
      await mkdir(packageDirectory, { recursive: true });
      await writeFile(
        join(packageDirectory, "package.json"),
        JSON.stringify({ name: "fixture-plugin", type: "module", exports: "./index.mjs" }),
      );
      await writeFile(
        join(packageDirectory, "index.mjs"),
        `export default {
          kind: "drever-build-plugin",
          apiVersion: 1,
          capability: "remark",
          create() { return function fixturePlugin() {}; }
        };`,
      );
      const plan = createTestPlan({
        plugins: [{ id: "feature", origin: "user" }],
        build: { remark: [entry("remark", "fixture-plugin")] },
      });

      const results = await Promise.all(
        Array.from({ length: 16 }, () => loadBuildModules(plan, { root })),
      );

      expect(results.every((result) => result.ok)).toBe(true);
      const cacheDirectory = join(root, ".drever", "cache", "build-modules");
      const cacheEntries = await readdir(cacheDirectory);
      const files = cacheEntries.filter((file) => file.endsWith(".mjs"));
      expect(files).toHaveLength(1);
      expect(cacheEntries.filter((file) => file.endsWith(".tmp"))).toHaveLength(0);
      expect(await readFile(join(cacheDirectory, files[0] as string), "utf8")).toContain(
        'import * as buildModule from "fixture-plugin";',
      );
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("rejects residual relative build module references before invoking an injected importer", async () => {
    let imported = false;
    const plan = createTestPlan({
      plugins: [{ id: "feature", origin: "user" }],
      build: { remark: [entry("remark", "../remark.mjs")] },
    });

    const result = await loadBuildModules(plan, {
      importModule: async () => {
        imported = true;
        return {};
      },
    });

    expect(imported).toBe(false);
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: "DREVER_BUILD_MODULE_SPECIFIER_RELATIVE" }],
    });
  });

  it("rejects a build cache outside the project root", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-build-root-"));
    try {
      const plan = createTestPlan({
        plugins: [{ id: "feature", origin: "user" }],
        build: { remark: [entry("remark", "fixture-plugin")] },
      });

      const result = await loadBuildModules(plan, { root, cacheDir: ".." });

      expect(result).toMatchObject({
        ok: false,
        diagnostics: [{ code: "DREVER_BUILD_MODULE_CACHE_OUTSIDE_ROOT" }],
      });
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("wraps repeated unified plugin identities so every planned contribution executes", async () => {
    let attachCount = 0;
    let transformCount = 0;
    const shared: UnifiedPlugin = () => {
      attachCount += 1;
      return () => {
        transformCount += 1;
      };
    };
    const module = defineRemarkPlugin(() => shared);
    const plan = createTestPlan({
      plugins: [{ id: "feature", origin: "user" }],
      build: { remark: [entry("remark", "first"), entry("remark", "second")] },
    });
    const result = await loadBuildModules(plan, {
      importModule: importer({ first: { default: module }, second: { default: module } }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.remark[0]).not.toBe(result.value.remark[1]);
    const processor = unified();
    for (const plugin of result.value.remark) {
      useUnifiedPlugin(processor, plugin);
    }
    await runUnified(processor);
    expect({ attachCount, transformCount }).toEqual({ attachCount: 2, transformCount: 2 });
  });

  it("recursively gives preset functions and tuples unique attacher identities", async () => {
    const calls: string[] = [];
    const shared: UnifiedPlugin<[label?: string]> = (label = "plain") => {
      calls.push(label);
    };
    const module = defineRemarkPlugin(() => ({
      plugins: [shared, [shared, "tuple"], { plugins: [[shared, "nested"]] }],
    }));
    const plan = createTestPlan({
      plugins: [{ id: "feature", origin: "user" }],
      build: { remark: [entry("remark", "preset")] },
    });
    const result = await loadBuildModules(plan, {
      importModule: importer({ preset: { default: module } }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    useUnifiedPlugin(unified(), result.value.remark[0]).freeze();
    expect(calls).toEqual(["plain", "tuple", "nested"]);
  });

  it("adds owner context to asynchronous unified transformer failures", async () => {
    const module = defineRemarkPlugin(() => () => async () => {
      throw new Error("transform boom");
    });
    const plan = createTestPlan({
      plugins: [{ id: "feature", origin: "user" }],
      build: { remark: [entry("remark", "failing", undefined, "post")] },
    });
    const result = await loadBuildModules(plan, {
      importModule: importer({ failing: { default: module } }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const processor = useUnifiedPlugin(unified(), result.value.remark[0]);
    const error = await runUnified(processor).catch((reason: unknown) => reason);
    expect(error).toMatchObject({
      code: "DREVER_BUILD_PLUGIN_EXECUTION_FAILED",
      capability: "remark",
      phase: "post",
      plugin: "feature",
      specifier: "failing",
    });
    expect(error).toHaveProperty("cause", expect.objectContaining({ message: "transform boom" }));
  });

  it("adds owner context when a synchronous unified transformer returns an Error", async () => {
    const module = defineRemarkPlugin(() => () => () => new Error("returned failure"));
    const plan = createTestPlan({
      plugins: [{ id: "feature", origin: "user" }],
      build: { remark: [entry("remark", "returned-error")] },
    });
    const result = await loadBuildModules(plan, {
      importModule: importer({ "returned-error": { default: module } }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const processor = useUnifiedPlugin(unified(), result.value.remark[0]);
    const error = await runUnified(processor).catch((reason: unknown) => reason);
    expect(error).toMatchObject({
      code: "DREVER_BUILD_PLUGIN_EXECUTION_FAILED",
      capability: "remark",
      plugin: "feature",
      specifier: "returned-error",
    });
    expect(error).toHaveProperty("cause", expect.objectContaining({ message: "returned failure" }));
  });

  it("flattens nested Vite options and rejects globally duplicate or empty names", async () => {
    const nested = defineVitePlugin(() => [
      false,
      Promise.resolve([{ name: "nested:first" }, [{ name: "nested:second" }]]),
    ]);
    const nestedPlan = createTestPlan({
      plugins: [{ id: "feature", origin: "user" }],
      build: { vite: [entry("vite", "nested")] },
    });
    const nestedResult = await loadBuildModules(nestedPlan, {
      importModule: importer({ nested: { default: nested } }),
    });

    expect(nestedResult.ok).toBe(true);
    if (nestedResult.ok) {
      expect(nestedResult.value.vite.map(({ name }) => name)).toEqual([
        "nested:first",
        "nested:second",
      ]);
    }

    const duplicate = defineVitePlugin(() => ({ name: "duplicate" }));
    const duplicatePlan = createTestPlan({
      plugins: [{ id: "feature", origin: "user" }],
      build: { vite: [entry("vite", "first"), entry("vite", "second")] },
    });
    const duplicateResult = await loadBuildModules(duplicatePlan, {
      importModule: importer({
        first: { default: duplicate },
        second: { default: duplicate },
      }),
    });
    expect(duplicateResult).toMatchObject({
      ok: false,
      diagnostics: [{ code: "DREVER_VITE_PLUGIN_NAME_DUPLICATE" }],
    });

    const empty = defineVitePlugin(() => ({ name: "  " }));
    const emptyResult = await loadBuildModules(nestedPlan, {
      importModule: importer({ nested: { default: empty } }),
    });
    expect(emptyResult).toMatchObject({
      ok: false,
      diagnostics: [{ code: "DREVER_VITE_PLUGIN_NAME_INVALID" }],
    });
  });

  it("applies Vite phase without losing the plugin prototype or property descriptors", async () => {
    const prototype = { marker: "prototype" };
    const transform = (): undefined => undefined;
    const plugin = Object.create(prototype) as Record<string, unknown>;
    Object.defineProperties(plugin, {
      name: { configurable: false, enumerable: false, value: "descriptor", writable: false },
      transform: { configurable: false, enumerable: false, value: transform, writable: false },
    });
    const module = defineVitePlugin(() => plugin as unknown as VitePlugin);
    const plan = createTestPlan({
      plugins: [{ id: "feature", origin: "user" }],
      build: { vite: [entry("vite", "descriptor", undefined, "pre")] },
    });
    const result = await loadBuildModules(plan, {
      importModule: importer({ descriptor: { default: module } }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const loaded = result.value.vite[0];
    expect(loaded).not.toBe(plugin);
    expect(Object.getPrototypeOf(loaded)).toBe(prototype);
    expect(loaded).toMatchObject({ enforce: "pre", marker: "prototype" });
    expect(Object.getOwnPropertyDescriptor(loaded, "name")).toMatchObject({
      configurable: false,
      enumerable: false,
      value: "descriptor",
      writable: false,
    });
    expect(Object.getOwnPropertyDescriptor(loaded, "transform")).toMatchObject({
      configurable: false,
      enumerable: false,
      value: transform,
      writable: false,
    });
  });

  it("turns an unreadable Vite enforce getter into a structured diagnostic", async () => {
    const plugin = {
      name: "unreadable-enforce",
      get enforce(): "pre" {
        throw new Error("getter boom");
      },
    };
    const module = defineVitePlugin(() => plugin);
    const plan = createTestPlan({
      plugins: [{ id: "feature", origin: "user" }],
      build: { vite: [entry("vite", "unreadable")] },
    });

    const result = await loadBuildModules(plan, {
      importModule: importer({ unreadable: { default: module } }),
    });

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "DREVER_BUILD_MODULE_RESULT_INVALID",
          details: { cause: "getter boom" },
        },
      ],
    });
  });
});

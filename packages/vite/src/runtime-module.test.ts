import type { CompilePlan, JsonObject } from "@drever/schema";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import {
  createExportRuntimeModuleSource,
  createMDXComponentsModuleSource,
  createRuntimeModulePlugin,
  createRuntimeModuleSource,
  createStylesModuleSource,
  DREVER_EXPORT_RUNTIME_MODULE_ID,
  DREVER_MDX_COMPONENTS_MODULE_ID,
  DREVER_RUNTIME_MODULE_ID,
  DREVER_STYLES_MODULE_ID,
} from "./runtime-module.ts";
import { createTestPlan } from "./test/plan.ts";

type RuntimeState = {
  acquisition?: Promise<unknown>;
  events: string[];
  onLateDispose?: () => void;
  onPendingStart?: () => void;
  reportError?: (error: unknown) => void;
  signal?: AbortSignal;
};

type LifecycleRuntimeModule = Readonly<{
  runSetup(runtime: RuntimeState): Promise<() => Promise<void>>;
  runExportSetup(runtime: RuntimeState): Promise<() => Promise<void>>;
}>;

const servers: ViteDevServer[] = [];

const deferred = <Value>() => {
  let resolve: ((value: Value) => void) | undefined;
  let reject: ((error: unknown) => void) | undefined;
  const promise = new Promise<Value>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return {
    promise,
    reject: (error: unknown) => reject?.(error),
    resolve: (value: Value) => resolve?.(value),
  };
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

const loadLifecycleRuntime = async (
  runtimePlan: CompilePlan,
  modules: ReadonlyMap<string, string>,
  moduleId = DREVER_RUNTIME_MODULE_ID,
): Promise<LifecycleRuntimeModule> => {
  const hookModules: Plugin = {
    name: "drever:test-runtime-hooks",
    resolveId(id) {
      if (modules.has(id)) {
        return `\0${id}`;
      }
    },
    load(id) {
      return modules.get(id.slice(1));
    },
  };
  const server = await createServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    plugins: [createRuntimeModulePlugin(runtimePlan), hookModules],
    resolve: {
      alias: {
        "@drever/core": fileURLToPath(new URL("../../core/src/index.ts", import.meta.url)),
      },
    },
    server: { middlewareMode: true },
  });
  servers.push(server);
  return server.ssrLoadModule(moduleId) as Promise<LifecycleRuntimeModule>;
};

const unsafeConfig = JSON.parse(
  '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}',
) as JsonObject;

const basePlan = createTestPlan({
  plugins: [
    {
      id: "charts",
      version: "2.0.0",
      origin: "user",
      config: unsafeConfig,
    },
    { id: "player", origin: "default" },
    {
      id: "exporter",
      origin: "user",
      config: { format: "pdf", browserSafe: true },
    },
    { id: "unused", origin: "default", config: { secret: "do-not-bundle" } },
  ],
  runtime: {
    elements: [
      {
        name: "h1",
        owner: { kind: "theme", id: "theme" },
        module: { specifier: "theme-elements", exportName: "Heading" },
      },
    ],
    layouts: [
      {
        name: "Cover",
        owner: { kind: "theme", id: "theme" },
        module: { specifier: "theme-layouts", exportName: "Cover" },
        description: "Cover layout.",
        slots: [],
      },
    ],
    components: [
      {
        name: "Chart",
        owner: { kind: "plugin", id: "charts" },
        module: { specifier: "chart-component" },
        manifest: { description: "Chart component." },
      },
    ],
    styles: [
      {
        owner: { kind: "theme", id: "theme" },
        style: { specifier: "theme.css", layer: "theme" },
      },
      {
        owner: { kind: "plugin", id: "charts" },
        style: { specifier: "chart.css", layer: "component" },
      },
    ],
    setup: [
      {
        owner: { kind: "plugin", id: "charts" },
        module: { specifier: "chart-setup", exportName: "setup" },
      },
      {
        owner: { kind: "plugin", id: "player" },
        module: { specifier: "player-setup" },
      },
    ],
    exportSetup: [
      {
        owner: { kind: "plugin", id: "exporter" },
        module: { specifier: "chart-export", exportName: "prepareExport" },
      },
    ],
  },
});

const plan: CompilePlan = {
  ...basePlan,
  theme: {
    ...basePlan.theme,
    motion: {
      id: "editorial",
      module: { specifier: "theme-motion", exportName: "motion" },
      intents: ["reveal", "continuity"],
      guidance: ["Prefer continuity between related slides."],
    },
  },
};

describe("runtime virtual modules", () => {
  it("keeps the MDX provider limited to the static component registry", () => {
    const source = createMDXComponentsModuleSource(plan);

    expect(source).toContain('import * as __drever_module_0 from "theme-elements";');
    expect(source).toContain('__dreverSelect(__drever_module_0, "Heading", "theme-elements")');
    expect(source).toContain('elements: {"h1":__drever_value_0}');
    expect(source).toContain('layouts: {"Cover":__drever_value_1}');
    expect(source).toContain('components: {"Chart":__drever_value_2}');
    expect(source).toContain("export const useMDXComponents = () => components;");
    expect(source).not.toContain(DREVER_RUNTIME_MODULE_ID);
    expect(source).not.toContain(DREVER_STYLES_MODULE_ID);
    expect(source).not.toContain("chart-setup");
    expect(source).not.toContain("theme-motion");
  });

  it("keeps viewer runtime limited to theme motion and setup hooks", () => {
    const source = createRuntimeModuleSource(plan);

    expect(source).toContain('from "theme-motion"');
    expect(source).toContain("export const motion = Object.freeze({ ...__dreverParseJSON(");
    expect(source).toContain("implementation: __drever_value_0");
    expect(source).toContain('from "chart-setup"');
    expect(source).toContain('from "player-setup"');
    expect(source).toContain("export const theme = __dreverParseJSON(");
    expect(source).toContain("export const runSetup = async (runtime)");
    expect(source).toContain("plugin: registration.plugin");
    expect(source).not.toContain("pluginConfig:");
    expect(source).toContain('\\"config\\":{');
    expect(source).toContain("runtime,");
    expect(source).toContain('typeof hook !== "function"');
    expect(source).not.toContain('from "chart-export"');
    expect(source).not.toContain("runExportSetup");
    expect(source).not.toContain('\\"format\\":\\"pdf\\"');
    expect(source).not.toContain("do-not-bundle");
  });

  it("keeps export runtime limited to export setup hooks and their owner config", () => {
    const source = createExportRuntimeModuleSource(plan);

    expect(source).toContain('from "chart-export"');
    expect(source).toContain("export const runExportSetup = async (runtime)");
    expect(source).toContain('\\"format\\":\\"pdf\\"');
    expect(source).not.toContain('from "theme-motion"');
    expect(source).not.toContain('from "chart-setup"');
    expect(source).not.toContain('from "player-setup"');
    expect(source).not.toContain("export const theme");
    expect(source).not.toContain("export const motion");
    expect(source).not.toContain("runSetup");
    expect(source).not.toContain('\\"__proto__\\"');
    expect(source).not.toContain("do-not-bundle");
  });

  it("awaits setup hooks sequentially in compile-plan order", () => {
    const source = createRuntimeModuleSource(plan);
    const chart = source.indexOf(
      'owner: "charts", capability: "setup", specifier: "chart-setup", hook: __drever_value_1',
    );
    const player = source.indexOf(
      'owner: "player", capability: "setup", specifier: "player-setup", hook: __drever_value_2',
    );

    expect(chart).toBeGreaterThan(-1);
    expect(player).toBeGreaterThan(chart);
    expect(source).toContain("const acquisition = Promise.resolve().then(() => {");
    expect(source).toContain("return contribution.hook(");
    expect(source).toContain("return await Promise.race([");
    expect(source).not.toContain("Promise.all");
  });

  it("parses and deeply freezes theme tokens and plugin config as JSON data", () => {
    const source = createRuntimeModuleSource(plan);

    expect(source).toContain("__dreverDeepFreeze(JSON.parse(source))");
    expect(source).toContain('\\"__proto__\\":{\\"polluted\\":true}');
    expect(source).not.toContain('pluginConfig:{"__proto__"');
    expect(Object.prototype).not.toHaveProperty("polluted");
  });

  it("uses explicit cascade layers in plan order", () => {
    expect(createStylesModuleSource(plan))
      .toBe(`@layer drever.client, drever.theme, drever.layout, drever.component, drever.utility;
@import "theme.css" layer(drever.theme);
@import "chart.css" layer(drever.component);
`);
  });

  it("resolves exactly the four private virtual module ids", () => {
    const plugin = createRuntimeModulePlugin(plan);
    const resolve = plugin.resolveId as (id: string) => string | undefined;
    const load = plugin.load as (id: string) => string | undefined;

    expect(resolve(DREVER_MDX_COMPONENTS_MODULE_ID)).toBe(`\0${DREVER_MDX_COMPONENTS_MODULE_ID}`);
    expect(resolve(DREVER_RUNTIME_MODULE_ID)).toBe(`\0${DREVER_RUNTIME_MODULE_ID}`);
    expect(resolve(DREVER_EXPORT_RUNTIME_MODULE_ID)).toBe(`\0${DREVER_EXPORT_RUNTIME_MODULE_ID}`);
    expect(resolve(DREVER_STYLES_MODULE_ID)).toBe(`\0${DREVER_STYLES_MODULE_ID}`);
    expect(resolve("virtual:other")).toBeUndefined();
    expect(load(`\0${DREVER_MDX_COMPONENTS_MODULE_ID}`)).toBe(
      createMDXComponentsModuleSource(plan),
    );
    expect(load(`\0${DREVER_RUNTIME_MODULE_ID}`)).toBe(createRuntimeModuleSource(plan));
    expect(load(`\0${DREVER_EXPORT_RUNTIME_MODULE_ID}`)).toBe(
      createExportRuntimeModuleSource(plan),
    );
    expect(load(`\0${DREVER_STYLES_MODULE_ID}`)).toBe(createStylesModuleSource(plan));
  });
});

describe("generated lifecycle runner", () => {
  it("rejects an aborted lifetime even when no setup hooks are planned", async () => {
    const runtimeModule = await loadLifecycleRuntime(createTestPlan(), new Map());
    const controller = new AbortController();
    const reason = new DOMException("viewer closed", "AbortError");
    controller.abort(reason);

    await expect(runtimeModule.runSetup({ events: [], signal: controller.signal })).rejects.toBe(
      reason,
    );
  });

  it("runs setup sequentially and disposes once in reverse order", async () => {
    const runtimePlan = createTestPlan({
      plugins: [
        { id: "first", origin: "user", config: { label: "A" } },
        { id: "second", origin: "user", config: { label: "B" } },
      ],
      runtime: {
        setup: [
          {
            owner: { kind: "plugin", id: "first" },
            module: { specifier: "virtual:test/setup-first" },
          },
          {
            owner: { kind: "plugin", id: "second" },
            module: { specifier: "virtual:test/setup-second" },
          },
        ],
      },
    });
    const runtimeModule = await loadLifecycleRuntime(
      runtimePlan,
      new Map([
        [
          "virtual:test/setup-first",
          `export default async ({ plugin, runtime }) => {
  runtime.events.push("setup:" + plugin.config.label);
  return async () => runtime.events.push("dispose:" + plugin.config.label);
};`,
        ],
        [
          "virtual:test/setup-second",
          `export default async ({ plugin, runtime }) => {
  runtime.events.push("setup:" + plugin.config.label);
  return async () => runtime.events.push("dispose:" + plugin.config.label);
};`,
        ],
      ]),
    );
    const runtime: RuntimeState = { events: [] };

    const dispose = await runtimeModule.runSetup(runtime);
    expect(runtime.events).toEqual(["setup:A", "setup:B"]);

    await Promise.all([dispose(), dispose()]);
    expect(runtime.events).toEqual(["setup:A", "setup:B", "dispose:B", "dispose:A"]);
  });

  it("does not start setup when its lifetime is already aborted", async () => {
    const runtimePlan = createTestPlan({
      plugins: [{ id: "never", origin: "user" }],
      runtime: {
        setup: [
          {
            owner: { kind: "plugin", id: "never" },
            module: { specifier: "virtual:test/never-started" },
          },
        ],
      },
    });
    const runtimeModule = await loadLifecycleRuntime(
      runtimePlan,
      new Map([
        [
          "virtual:test/never-started",
          `export default ({ runtime }) => runtime.events.push("setup:never");`,
        ],
      ]),
    );
    const controller = new AbortController();
    const reason = new DOMException("viewer closed", "AbortError");
    controller.abort(reason);
    const runtime: RuntimeState = { events: [], signal: controller.signal };

    await expect(runtimeModule.runSetup(runtime)).rejects.toBe(reason);
    expect(runtime.events).toEqual([]);
  });

  it("does not start a queued hook when aborted in the same turn", async () => {
    const runtimePlan = createTestPlan({
      plugins: [{ id: "queued", origin: "user" }],
      runtime: {
        setup: [
          {
            owner: { kind: "plugin", id: "queued" },
            module: { specifier: "virtual:test/queued" },
          },
        ],
      },
    });
    const runtimeModule = await loadLifecycleRuntime(
      runtimePlan,
      new Map([
        [
          "virtual:test/queued",
          `export default ({ runtime }) => runtime.events.push("setup:queued");`,
        ],
      ]),
    );
    const controller = new AbortController();
    const reason = new DOMException("viewer closed", "AbortError");
    const runtime: RuntimeState = { events: [], signal: controller.signal };

    const setup = runtimeModule.runSetup(runtime);
    controller.abort(reason);

    await expect(setup).rejects.toBe(reason);
    expect(runtime.events).toEqual([]);
  });

  it("rolls back immediately, skips later hooks, and releases a late acquisition", async () => {
    const runtimePlan = createTestPlan({
      plugins: [
        { id: "acquired", origin: "user" },
        { id: "pending", origin: "user" },
        { id: "never", origin: "user" },
      ],
      runtime: {
        setup: [
          {
            owner: { kind: "plugin", id: "acquired" },
            module: { specifier: "virtual:test/cancel-acquired" },
          },
          {
            owner: { kind: "plugin", id: "pending" },
            module: { specifier: "virtual:test/cancel-pending" },
          },
          {
            owner: { kind: "plugin", id: "never" },
            module: { specifier: "virtual:test/cancel-never" },
          },
        ],
      },
    });
    const runtimeModule = await loadLifecycleRuntime(
      runtimePlan,
      new Map([
        [
          "virtual:test/cancel-acquired",
          `export default ({ runtime }) => {
  runtime.events.push("setup:acquired");
  return () => runtime.events.push("rollback:acquired");
};`,
        ],
        [
          "virtual:test/cancel-pending",
          `export default ({ runtime }) => {
  runtime.events.push("setup:pending");
  runtime.onPendingStart();
  return runtime.acquisition;
};`,
        ],
        [
          "virtual:test/cancel-never",
          `export default ({ runtime }) => runtime.events.push("setup:never");`,
        ],
      ]),
    );
    const controller = new AbortController();
    const reason = new DOMException("viewer closed", "AbortError");
    const acquisition = deferred<unknown>();
    const pendingStarted = deferred<void>();
    const lateDisposed = deferred<void>();
    const runtime: RuntimeState = {
      acquisition: acquisition.promise,
      events: [],
      onLateDispose: () => lateDisposed.resolve(),
      onPendingStart: () => pendingStarted.resolve(),
      signal: controller.signal,
    };

    const setup = runtimeModule.runSetup(runtime);
    await pendingStarted.promise;
    controller.abort(reason);

    await expect(setup).rejects.toBe(reason);
    expect(runtime.events).toEqual(["setup:acquired", "setup:pending", "rollback:acquired"]);

    acquisition.resolve(() => {
      runtime.events.push("dispose:pending");
      runtime.onLateDispose?.();
    });
    await lateDisposed.promise;
    expect(runtime.events).toEqual([
      "setup:acquired",
      "setup:pending",
      "rollback:acquired",
      "dispose:pending",
    ]);
  });

  it("aggregates cancellation rollback failures and reports late disposal failures", async () => {
    const runtimePlan = createTestPlan({
      plugins: [
        { id: "first", origin: "user" },
        { id: "second", origin: "user" },
        { id: "pending", origin: "user" },
      ],
      runtime: {
        setup: [
          {
            owner: { kind: "plugin", id: "first" },
            module: { specifier: "virtual:test/cancel-failing-first" },
          },
          {
            owner: { kind: "plugin", id: "second" },
            module: { specifier: "virtual:test/cancel-failing-second" },
          },
          {
            owner: { kind: "plugin", id: "pending" },
            module: { specifier: "virtual:test/cancel-failing-pending" },
          },
        ],
      },
    });
    const runtimeModule = await loadLifecycleRuntime(
      runtimePlan,
      new Map([
        [
          "virtual:test/cancel-failing-first",
          `export default () => () => { throw new Error("first rollback failed"); };`,
        ],
        [
          "virtual:test/cancel-failing-second",
          `export default () => () => { throw new Error("second rollback failed"); };`,
        ],
        [
          "virtual:test/cancel-failing-pending",
          `export default ({ runtime }) => {
  runtime.onPendingStart();
  return runtime.acquisition;
};`,
        ],
      ]),
    );
    const controller = new AbortController();
    const reason = new DOMException("viewer closed", "AbortError");
    const acquisition = deferred<unknown>();
    const pendingStarted = deferred<void>();
    const lateReported = deferred<void>();
    const reports: unknown[] = [];
    const runtime: RuntimeState = {
      acquisition: acquisition.promise,
      events: [],
      onPendingStart: () => pendingStarted.resolve(),
      reportError(error) {
        reports.push(error);
        if ((error as { specifier?: string }).specifier === "virtual:test/cancel-failing-pending") {
          lateReported.resolve();
        }
      },
      signal: controller.signal,
    };

    const setup = runtimeModule.runSetup(runtime);
    await pendingStarted.promise;
    controller.abort(reason);
    await expect(setup).rejects.toBe(reason);

    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      code: "DREVER_RUNTIME_DISPOSE_FAILED",
      owner: "second",
      specifier: "virtual:test/cancel-failing-second",
    });
    expect(reports[0]).toHaveProperty("suppressedErrors.0.owner", "first");

    acquisition.resolve(() => {
      throw new Error("late disposal failed");
    });
    await lateReported.promise;
    expect(reports).toHaveLength(2);
    expect(reports[1]).toMatchObject({
      code: "DREVER_RUNTIME_DISPOSE_FAILED",
      owner: "pending",
      specifier: "virtual:test/cancel-failing-pending",
    });
    expect((reports[1] as { cause: Error }).cause.message).toBe("late disposal failed");
  });

  it("rolls back acquired resources before reporting a hook failure", async () => {
    const runtimePlan = createTestPlan({
      plugins: [
        { id: "acquired", origin: "user" },
        { id: "failing", origin: "user" },
      ],
      runtime: {
        setup: [
          {
            owner: { kind: "plugin", id: "acquired" },
            module: { specifier: "virtual:test/acquired" },
          },
          {
            owner: { kind: "plugin", id: "failing" },
            module: { specifier: "virtual:test/failing" },
          },
        ],
      },
    });
    const runtimeModule = await loadLifecycleRuntime(
      runtimePlan,
      new Map([
        [
          "virtual:test/acquired",
          `export default ({ runtime }) => {
  runtime.events.push("setup:acquired");
  return () => runtime.events.push("rollback:acquired");
};`,
        ],
        [
          "virtual:test/failing",
          `export default ({ runtime }) => {
  runtime.events.push("setup:failing");
  throw new Error("setup exploded");
};`,
        ],
      ]),
    );
    const runtime: RuntimeState = { events: [] };

    let failure: unknown;
    try {
      await runtimeModule.runSetup(runtime);
    } catch (error) {
      failure = error;
    }

    expect(runtime.events).toEqual(["setup:acquired", "setup:failing", "rollback:acquired"]);
    expect(failure).toMatchObject({
      name: "DreverRuntimeLifecycleError",
      code: "DREVER_RUNTIME_HOOK_FAILED",
      owner: "failing",
      capability: "setup",
      specifier: "virtual:test/failing",
      stage: "runtime",
      rollbackErrors: [],
    });
    expect((failure as { cause: Error }).cause.message).toBe("setup exploded");
  });

  it("continues reverse disposal and attaches later failures to the first error", async () => {
    const runtimePlan = createTestPlan({
      plugins: [
        { id: "first", origin: "user" },
        { id: "second", origin: "user" },
      ],
      runtime: {
        setup: [
          {
            owner: { kind: "plugin", id: "first" },
            module: { specifier: "virtual:test/dispose-first" },
          },
          {
            owner: { kind: "plugin", id: "second" },
            module: { specifier: "virtual:test/dispose-second" },
          },
        ],
      },
    });
    const runtimeModule = await loadLifecycleRuntime(
      runtimePlan,
      new Map([
        [
          "virtual:test/dispose-first",
          `export default ({ runtime }) => () => {
  runtime.events.push("dispose:first");
  throw new Error("first dispose failed");
};`,
        ],
        [
          "virtual:test/dispose-second",
          `export default ({ runtime }) => () => {
  runtime.events.push("dispose:second");
  throw new Error("second dispose failed");
};`,
        ],
      ]),
    );
    const runtime: RuntimeState = { events: [] };
    const dispose = await runtimeModule.runSetup(runtime);

    let failure: unknown;
    try {
      await dispose();
    } catch (error) {
      failure = error;
    }

    expect(runtime.events).toEqual(["dispose:second", "dispose:first"]);
    expect(failure).toMatchObject({
      code: "DREVER_RUNTIME_DISPOSE_FAILED",
      owner: "second",
      capability: "setup",
      specifier: "virtual:test/dispose-second",
      stage: "runtime",
    });
    expect(failure).toHaveProperty("suppressedErrors.0.owner", "first");
  });

  it("labels export hook failures with the export stage", async () => {
    const runtimePlan = createTestPlan({
      plugins: [{ id: "exporter", origin: "user", config: { format: "pdf" } }],
      runtime: {
        exportSetup: [
          {
            owner: { kind: "plugin", id: "exporter" },
            module: { specifier: "virtual:test/export-failing" },
          },
        ],
      },
    });
    const runtimeModule = await loadLifecycleRuntime(
      runtimePlan,
      new Map([
        [
          "virtual:test/export-failing",
          `export default ({ plugin }) => {
  throw new Error("cannot export " + plugin.config.format);
};`,
        ],
      ]),
      DREVER_EXPORT_RUNTIME_MODULE_ID,
    );

    let failure: unknown;
    try {
      await runtimeModule.runExportSetup({ events: [] });
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject({
      code: "DREVER_RUNTIME_HOOK_FAILED",
      owner: "exporter",
      capability: "exportSetup",
      specifier: "virtual:test/export-failing",
      stage: "export",
    });
    expect((failure as { cause: Error }).cause.message).toBe("cannot export pdf");
  });
});

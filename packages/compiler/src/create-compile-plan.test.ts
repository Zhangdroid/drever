import type {
  DiagnosticResult,
  DreverPlugin,
  PluginRegistration,
  ThemeDefinition,
} from "@drever/schema";
import { describe, expect, it } from "vite-plus/test";
import { createCompilePlan } from "./create-compile-plan.ts";
import { definePlugin, defineTheme } from "./define-extension.ts";

const createTheme = (
  overrides: Partial<
    Omit<ThemeDefinition, "apiVersion" | "id" | "kind" | "manifest" | "tokens">
  > = {},
): ThemeDefinition =>
  defineTheme({
    kind: "theme",
    apiVersion: 1,
    id: "@drever/theme-test",
    baseURL: "file:///themes/test/index.ts",
    tokens: { color: { canvas: "#fff", text: "#111" } },
    manifest: { title: "Test", summary: "A deterministic test theme." },
    ...overrides,
  });

const createPlugin = (
  id: string,
  overrides: Partial<Omit<DreverPlugin, "apiVersion" | "id" | "kind" | "manifest">> = {},
  configManifest?: NonNullable<DreverPlugin["manifest"]["config"]>,
): DreverPlugin =>
  definePlugin({
    kind: "plugin",
    apiVersion: 1,
    id,
    manifest: {
      title: id,
      summary: `Test plugin ${id}.`,
      ...(configManifest === undefined ? {} : { config: configManifest }),
    },
    ...overrides,
  });

const usePlugin = (
  plugin: DreverPlugin,
  origin: PluginRegistration["origin"] = "user",
  enabled?: boolean,
  config?: PluginRegistration["config"],
): PluginRegistration => ({
  plugin,
  origin,
  ...(enabled === undefined ? {} : { enabled }),
  ...(config === undefined ? {} : { config }),
});

const diagnosticCodes = <Value>(result: DiagnosticResult<Value>): string[] =>
  result.diagnostics.map((diagnostic) => diagnostic.code);

describe("createCompilePlan", () => {
  it("creates a portable plan with normalized modules and explicit owners", () => {
    const theme = createTheme({
      canvas: { width: 1600, height: 900 },
      styles: [{ specifier: "./theme.css", layer: "theme" }],
      elements: { h1: { specifier: "./elements.tsx", exportName: "Heading1" } },
      layouts: [
        {
          name: "Cover",
          module: { specifier: "./layouts.tsx", exportName: "Cover" },
          description: "A title-focused opening slide.",
          slots: [{ name: "title", purpose: "The main idea.", accepts: ["text"], required: true }],
        },
      ],
      motion: {
        id: "editorial",
        intents: ["focus", "compare"],
      },
    });
    const charts = createPlugin(
      "@acme/drever-charts",
      {
        version: "1.0.0",
        baseURL: "file:///plugins/charts/index.ts",
        build: {
          remark: [{ specifier: "./remark.ts", options: { syntax: "chart" } }],
          rehype: [{ specifier: "@acme/chart-rehype" }],
        },
        runtime: {
          components: [
            {
              name: "Chart",
              module: { specifier: "./chart.tsx", exportName: "Chart" },
              manifest: { description: "Render an accessible chart." },
            },
          ],
          styles: [{ specifier: "./chart.css", layer: "component" }],
          setup: [{ specifier: "./setup.ts" }],
          exportSetup: [{ specifier: "./export.ts" }],
        },
      },
      {
        description: "Chart behavior for this deck.",
        properties: {
          animation: {
            type: "string",
            description: "The chart entrance animation.",
            values: ["reveal", "none"],
            default: "reveal",
          },
        },
      },
    );

    const result = createCompilePlan({
      theme,
      plugins: [usePlugin(charts, "user", undefined, { animation: "reveal" })],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value).toMatchObject({
      version: 1,
      target: "canonical",
      theme: {
        id: "@drever/theme-test",
        canvas: { width: 1600, height: 900 },
        motion: { id: "editorial", intents: ["focus", "compare"] },
      },
      plugins: [
        {
          id: "@acme/drever-charts",
          version: "1.0.0",
          origin: "user",
          config: { animation: "reveal" },
        },
      ],
      build: {
        remark: [
          {
            owner: { kind: "plugin", id: "@acme/drever-charts" },
            module: {
              specifier: "file:///plugins/charts/remark.ts",
              options: { syntax: "chart" },
            },
          },
        ],
      },
      runtime: {
        elements: [
          {
            name: "h1",
            owner: { kind: "theme", id: "@drever/theme-test" },
            module: {
              specifier: "file:///themes/test/elements.tsx",
              exportName: "Heading1",
            },
          },
        ],
        layouts: [{ name: "Cover", owner: { kind: "theme", id: "@drever/theme-test" } }],
        components: [
          {
            name: "Chart",
            owner: { kind: "plugin", id: "@acme/drever-charts" },
            module: { specifier: "file:///plugins/charts/chart.tsx", exportName: "Chart" },
          },
        ],
        styles: [
          { owner: { kind: "theme" }, style: { layer: "theme" } },
          { owner: { kind: "plugin" }, style: { layer: "component" } },
        ],
      },
    });
    expect(JSON.parse(JSON.stringify(result.value))).toEqual(result.value);
  });

  it("orders build hooks deterministically without changing runtime registration order", () => {
    const normalB = createPlugin("b", {
      build: { remark: [{ specifier: "b" }] },
      runtime: { setup: [{ specifier: "runtime-b" }] },
    });
    const normalA = createPlugin("a", {
      order: { before: ["b"] },
      build: { remark: [{ specifier: "a" }] },
      runtime: { setup: [{ specifier: "runtime-a" }] },
    });
    const pre = createPlugin("pre", {
      build: { enforce: "pre", remark: [{ specifier: "pre" }] },
      runtime: { setup: [{ specifier: "runtime-pre" }] },
    });
    const post = createPlugin("post", {
      order: { after: ["b"] },
      build: { enforce: "post", remark: [{ specifier: "post" }] },
      runtime: { setup: [{ specifier: "runtime-post" }] },
    });
    const plugins = [normalB, normalA, pre, post].map((plugin) => usePlugin(plugin));

    const first = createCompilePlan({ theme: createTheme(), plugins });
    const second = createCompilePlan({ theme: createTheme(), plugins });

    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    expect(first.value.plugins.map((plugin) => plugin.id)).toEqual(["b", "a", "pre", "post"]);
    expect(first.value.build.remark.map((entry) => entry.owner.id)).toEqual([
      "pre",
      "a",
      "b",
      "post",
    ]);
    expect(first.value.runtime.setup.map((entry) => entry.owner.id)).toEqual([
      "b",
      "a",
      "pre",
      "post",
    ]);
  });

  it("normalizes required, default, and user origins while preserving order inside each group", () => {
    const registrations = [
      usePlugin(createPlugin("user-a", { runtime: { setup: [{ specifier: "user-a" }] } })),
      usePlugin(
        createPlugin("default", { runtime: { setup: [{ specifier: "default" }] } }),
        "default",
      ),
      usePlugin(
        createPlugin("required", { runtime: { setup: [{ specifier: "required" }] } }),
        "required",
      ),
      usePlugin(createPlugin("user-b", { runtime: { setup: [{ specifier: "user-b" }] } })),
    ];

    const result = createCompilePlan({ theme: createTheme(), plugins: registrations });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.plugins.map((plugin) => plugin.id)).toEqual([
      "required",
      "default",
      "user-a",
      "user-b",
    ]);
    expect(result.value.runtime.setup.map((entry) => entry.owner.id)).toEqual([
      "required",
      "default",
      "user-a",
      "user-b",
    ]);
  });

  it("rejects duplicate plugins and disabled required plugins", () => {
    const required = createPlugin("drever:required");
    const duplicate = createPlugin("duplicate");
    const result = createCompilePlan({
      theme: createTheme(),
      plugins: [usePlugin(required, "required", false), usePlugin(duplicate), usePlugin(duplicate)],
    });

    expect(result.ok).toBe(false);
    expect(diagnosticCodes(result)).toEqual([
      "DREVER_PLUGIN_REQUIRED_DISABLED",
      "DREVER_PLUGIN_DUPLICATE",
    ]);
    expect(() => JSON.stringify(result.diagnostics)).not.toThrow();
  });

  it("rejects missing ordering targets, missing requirements, and phase contradictions", () => {
    const result = createCompilePlan({
      theme: createTheme(),
      plugins: [
        usePlugin(createPlugin("unknown", { order: { before: ["not-active"] } })),
        usePlugin(createPlugin("requires", { order: { requires: ["also-not-active"] } })),
        usePlugin(
          createPlugin("pre", {
            order: { after: ["normal"] },
            build: { enforce: "pre" },
          }),
        ),
        usePlugin(createPlugin("normal")),
      ],
    });

    expect(result.ok).toBe(false);
    expect(diagnosticCodes(result)).toEqual([
      "DREVER_PLUGIN_ORDER_TARGET_UNKNOWN",
      "DREVER_PLUGIN_REQUIRED_MISSING",
      "DREVER_PLUGIN_ORDER_PHASE_CONFLICT",
    ]);
  });

  it("reports a stable build-order cycle", () => {
    const result = createCompilePlan({
      theme: createTheme(),
      plugins: [
        usePlugin(createPlugin("a", { order: { before: ["b"] } })),
        usePlugin(createPlugin("b", { order: { before: ["c"] } })),
        usePlugin(createPlugin("c", { order: { before: ["a"] } })),
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toMatchObject([
      {
        code: "DREVER_PLUGIN_ORDER_CYCLE",
        stage: "config",
        plugin: "a",
        details: { cycle: ["a", "b", "c", "a"] },
      },
    ]);
  });

  it("rejects protected and conflicting MDX component names", () => {
    const theme = createTheme({
      layouts: [
        {
          name: "Chart",
          module: { specifier: "./chart-layout.tsx" },
          description: "Chart layout.",
          slots: [],
        },
      ],
    });
    const plugin = createPlugin("components", {
      runtime: {
        components: [
          {
            name: "Chart",
            module: { specifier: "chart" },
            manifest: { description: "Chart feature." },
          },
          {
            name: "Step",
            module: { specifier: "step" },
            manifest: { description: "Invalid Step replacement." },
          },
        ],
      },
    });

    const result = createCompilePlan({ theme, plugins: [usePlugin(plugin)] });

    expect(result.ok).toBe(false);
    expect(diagnosticCodes(result)).toEqual([
      "DREVER_COMPONENT_CONFLICT",
      "DREVER_COMPONENT_PROTECTED",
    ]);
    expect(result.diagnostics[0]?.details).toEqual({
      name: "Chart",
      owners: ["theme:@drever/theme-test", "plugin:components"],
    });
  });

  it("never silently removes a plugin that browser-lite cannot execute", () => {
    const theme = createTheme({ compilerTargets: ["canonical", "browser-lite"] });
    const nodeOnly = createPlugin("node-only");
    const viteInBrowser = createPlugin("vite-in-browser", {
      compilerTargets: ["canonical", "browser-lite"],
      build: { vite: [{ specifier: "vite-plugin" }] },
    });

    const unsupported = createCompilePlan({
      target: "browser-lite",
      theme,
      plugins: [usePlugin(nodeOnly)],
    });
    const invalidCapability = createCompilePlan({
      target: "browser-lite",
      theme,
      plugins: [usePlugin(viteInBrowser)],
    });

    expect(unsupported.ok).toBe(false);
    expect(diagnosticCodes(unsupported)).toEqual(["DREVER_EXTENSION_TARGET_UNSUPPORTED"]);
    expect(invalidCapability.ok).toBe(false);
    expect(diagnosticCodes(invalidCapability)).toEqual(["DREVER_PLUGIN_CAPABILITY_UNSUPPORTED"]);
  });

  it("omits disabled default plugins without evaluating their capabilities", () => {
    const disabled = createPlugin("default-node-only", {
      build: { vite: [{ specifier: "vite-plugin" }] },
    });
    const result = createCompilePlan({
      target: "browser-lite",
      theme: createTheme({ compilerTargets: ["canonical", "browser-lite"] }),
      plugins: [usePlugin(disabled, "default", false)],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.plugins).toEqual([]);
    }
  });

  it("rejects non-JSON plugin configuration before constructing a plan", () => {
    const plugin = createPlugin(
      "not-portable",
      {},
      {
        description: "Configuration portability test.",
        properties: {
          callback: {
            type: "json",
            description: "A deliberately invalid JSON value.",
          },
        },
      },
    );
    const result = createCompilePlan({
      theme: createTheme(),
      plugins: [
        usePlugin(plugin, "user", undefined, {
          callback: (() => undefined) as never,
        }),
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toMatchObject([
      {
        code: "DREVER_PLUGIN_CONFIG_NOT_SERIALIZABLE",
        stage: "config",
        plugin: "not-portable",
        details: {
          path: "$.config.callback",
          reason: "function values are not JSON-safe",
        },
      },
    ]);
  });

  it("requires baseURL for relative modules", () => {
    const plugin = createPlugin("relative", {
      build: { remark: [{ specifier: "./remark.ts" }] },
    });
    const result = createCompilePlan({ theme: createTheme(), plugins: [usePlugin(plugin)] });

    expect(result.ok).toBe(false);
    expect(diagnosticCodes(result)).toEqual(["DREVER_MODULE_BASE_URL_REQUIRED"]);
  });

  it("validates canvas and AI-facing layout contracts", () => {
    const theme = createTheme({
      canvas: { width: 0, height: 900 },
      layouts: [
        {
          name: "Broken",
          module: { specifier: "./broken.tsx" },
          description: "",
          slots: [
            { name: "Content", purpose: "Invalid name.", accepts: [] },
            { name: "Content", purpose: "Duplicate name.", accepts: ["text"], maxItems: 0 },
          ],
          variants: ["one", "one"],
        },
      ],
    });
    const result = createCompilePlan({ theme });

    expect(result.ok).toBe(false);
    expect(diagnosticCodes(result)).toEqual([
      "DREVER_THEME_CANVAS_INVALID",
      "DREVER_LAYOUT_MANIFEST_INVALID",
      "DREVER_LAYOUT_SLOT_INVALID",
      "DREVER_LAYOUT_SLOT_CONSTRAINT_INVALID",
      "DREVER_LAYOUT_SLOT_INVALID",
      "DREVER_LAYOUT_SLOT_CONSTRAINT_INVALID",
      "DREVER_LAYOUT_VARIANT_INVALID",
    ]);
  });

  it("reports incompatible extension API versions", () => {
    const incompatible = {
      ...createPlugin("future"),
      apiVersion: 2,
      futureCapability: true,
    } as unknown as DreverPlugin;
    const result = createCompilePlan({ theme: createTheme(), plugins: [usePlugin(incompatible)] });

    expect(result.ok).toBe(false);
    expect(diagnosticCodes(result)).toEqual(["DREVER_EXTENSION_API_VERSION"]);
  });

  it("turns throwing configuration access into a stable diagnostic", () => {
    const input = Object.defineProperty({}, "theme", {
      enumerable: true,
      get: () => {
        throw new Error("getter boom");
      },
    }) as Parameters<typeof createCompilePlan>[0];

    let result: ReturnType<typeof createCompilePlan> | undefined;
    expect(() => {
      result = createCompilePlan(input);
    }).not.toThrow();
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "DREVER_CONFIG_ACCESS_FAILED",
          details: { path: "$" },
        },
      ],
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("rejects accessors before later reads can change validated input", () => {
    const theme = createTheme();
    let reads = 0;
    const input = Object.defineProperty({}, "theme", {
      enumerable: true,
      get: () => {
        reads += 1;
        if (reads > 2) {
          throw new Error("late getter boom");
        }
        return theme;
      },
    }) as Parameters<typeof createCompilePlan>[0];

    let result: ReturnType<typeof createCompilePlan> | undefined;
    expect(() => {
      result = createCompilePlan(input);
    }).not.toThrow();
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "DREVER_EXTENSION_NOT_SERIALIZABLE",
          details: { path: "$", reason: "accessor properties are not JSON-safe" },
        },
      ],
    });
    expect(reads).toBeLessThanOrEqual(2);
  });

  it("decodes malformed JavaScript input into path-aware diagnostics without throwing", () => {
    const malformed = {
      ...createPlugin("malformed"),
      build: { remark: { specifier: "remark-plugin" } },
    } as unknown as DreverPlugin;

    expect(() =>
      createCompilePlan({ theme: createTheme(), plugins: [usePlugin(malformed)] }),
    ).not.toThrow();

    const result = createCompilePlan({
      theme: createTheme(),
      plugins: [usePlugin(malformed)],
    });
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "DREVER_CONFIG_SHAPE_INVALID",
          stage: "config",
          details: {
            actualType: "object",
            expected: "array",
            path: "$.plugins[0].plugin.build.remark",
          },
        },
      ],
    });
  });

  it("rejects invalid registration values and unknown configuration properties", () => {
    const registration = {
      plugin: { ...createPlugin("bad-registration"), buid: {} },
      origin: "typo",
      enabled: "false",
    } as unknown as PluginRegistration;
    const result = createCompilePlan({ theme: createTheme(), plugins: [registration] });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toMatchObject([
      {
        code: "DREVER_CONFIG_SHAPE_INVALID",
        details: { path: "$.plugins[0].plugin.buid" },
      },
      {
        code: "DREVER_CONFIG_SHAPE_INVALID",
        details: { path: "$.plugins[0].origin" },
      },
      {
        code: "DREVER_CONFIG_SHAPE_INVALID",
        details: { path: "$.plugins[0].enabled" },
      },
    ]);
  });

  it.each(["reveal", "ambient"])(
    "rejects the removed %s motion intent at the config boundary",
    (intent) => {
      const theme = {
        ...createTheme(),
        motion: { id: "legacy-motion", intents: [intent] },
      } as unknown as ThemeDefinition;
      const result = createCompilePlan({ theme });

      expect(result).toMatchObject({
        ok: false,
        diagnostics: [
          {
            code: "DREVER_CONFIG_SHAPE_INVALID",
            details: { path: "$.theme.motion.intents[0]" },
          },
        ],
      });
    },
  );

  it("rejects unknown keys even when they match Object prototype names", () => {
    const input = {
      theme: createTheme(),
      constructor: "not a config field",
    } as unknown as Parameters<typeof createCompilePlan>[0];
    const result = createCompilePlan(input);

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "DREVER_CONFIG_SHAPE_INVALID",
          details: { path: "$.constructor" },
        },
      ],
    });
  });

  it("returns a deeply frozen snapshot independent from extension inputs", () => {
    const tokens = { color: { canvas: "#fff", text: "#111" } };
    const options = { syntax: "chart" };
    const config = { animation: "reveal" };
    const theme = defineTheme({
      kind: "theme",
      apiVersion: 1,
      id: "snapshot-theme",
      tokens,
      manifest: { title: "Snapshot", summary: "Snapshot test theme." },
    });
    const plugin = createPlugin(
      "snapshot-plugin",
      {
        build: { remark: [{ specifier: "remark-plugin", options }] },
      },
      {
        description: "Snapshot configuration.",
        properties: {
          animation: { type: "string", description: "Animation mode." },
        },
      },
    );

    const result = createCompilePlan({
      theme,
      plugins: [usePlugin(plugin, "user", undefined, config)],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    tokens.color.text = "#fff";
    options.syntax = "diagram";
    config.animation = "none";

    expect(result.value.theme.tokens).toEqual({
      color: { canvas: "#fff", text: "#111" },
    });
    expect(result.value.build.remark[0]?.module.options).toEqual({ syntax: "chart" });
    expect(result.value.plugins[0]?.config).toEqual({ animation: "reveal" });
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.theme.tokens)).toBe(true);
    expect(Object.isFrozen(result.value.build.remark[0]?.module.options)).toBe(true);
  });

  it("returns deeply frozen diagnostics independent from invalid inputs", () => {
    const canvas: { cycle?: unknown; height: number; width: number } = {
      width: 0,
      height: 900,
    };
    const result = createCompilePlan({ theme: createTheme({ canvas }) });
    expect(result.ok).toBe(false);

    canvas.width = 1600;
    canvas.cycle = canvas;

    expect(result.diagnostics[0]?.details?.canvas).toEqual({ width: 0, height: 900 });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.diagnostics)).toBe(true);
    expect(Object.isFrozen(result.diagnostics[0]?.details?.canvas)).toBe(true);
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it("keeps diagnostics canonical when numeric input is not JSON-safe", () => {
    const result = createCompilePlan({
      theme: {
        ...createTheme(),
        apiVersion: Number.NaN,
      } as unknown as ThemeDefinition,
    });

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "DREVER_EXTENSION_NOT_SERIALIZABLE",
          details: { path: "$.apiVersion", reason: "numbers must be finite" },
        },
      ],
    });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("rejects negative zero instead of producing a lossy JSON round trip", () => {
    const theme = createTheme();
    const result = createCompilePlan({
      theme: {
        ...theme,
        tokens: { ...theme.tokens, offset: -0 },
      },
    });

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "DREVER_EXTENSION_NOT_SERIALIZABLE",
          details: {
            path: "$.tokens.offset",
            reason: "negative zero is not canonical JSON",
          },
        },
      ],
    });
  });
});

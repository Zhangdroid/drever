import type { Diagnostic, DreverPlugin, PluginRegistration } from "@drever/schema";
import { describe, expect, it } from "vite-plus/test";
import { resolveBuildContributions, resolvePluginContributions } from "./resolve-contributions.ts";
import { resolvePluginRegistrationConfig } from "./plugin-config.ts";

type PluginOverrides = Partial<Omit<DreverPlugin, "apiVersion" | "id" | "kind" | "manifest">> &
  Readonly<{ manifest?: Partial<DreverPlugin["manifest"]> }>;

const createPlugin = (overrides: PluginOverrides = {}): DreverPlugin => {
  const { manifest, ...definition } = overrides;
  return {
    kind: "plugin",
    apiVersion: 1,
    id: "@acme/drever-charts",
    ...definition,
    manifest: {
      title: "Charts",
      summary: "Accessible charts for Drever.",
      ...manifest,
    },
  };
};

const register = (
  plugin: DreverPlugin,
  config?: PluginRegistration["config"],
): PluginRegistration => ({
  plugin,
  origin: "user",
  ...(config === undefined ? {} : { config }),
});

describe("plugin registration config", () => {
  it("merges manifest defaults with project config into the planned plugin", () => {
    const plugin = createPlugin({
      manifest: {
        title: "Charts",
        summary: "Accessible charts for Drever.",
        config: {
          description: "Project-wide chart rendering choices.",
          properties: {
            animation: {
              type: "string",
              description: "The default chart entrance.",
              values: ["none", "reveal"],
              default: "reveal",
            },
            palette: {
              type: "json",
              description: "A project palette.",
              default: { accent: "violet" },
            },
            precision: {
              type: "number",
              description: "Default decimal precision.",
              required: true,
            },
          },
          additionalProperties: true,
        },
      },
    });
    const registration = register(plugin, { precision: 2, renderer: "svg" });
    const diagnostics: Diagnostic[] = [];

    const config = resolvePluginRegistrationConfig(registration, diagnostics);
    const contributions = resolvePluginContributions([registration], new Map(), diagnostics);

    expect(diagnostics).toEqual([]);
    expect(config).toEqual({
      animation: "reveal",
      palette: { accent: "violet" },
      precision: 2,
      renderer: "svg",
    });
    expect(contributions.plugins).toEqual([{ id: "@acme/drever-charts", origin: "user", config }]);
  });

  it("reports missing, invalid, and unknown project options together", () => {
    const plugin = createPlugin({
      manifest: {
        title: "Charts",
        summary: "Accessible charts for Drever.",
        config: {
          description: "Project-wide chart rendering choices.",
          properties: {
            licenseKey: {
              type: "string",
              description: "The project license key.",
              required: true,
            },
            renderer: {
              type: "string",
              description: "The rendering backend.",
              values: ["canvas", "svg"],
            },
          },
        },
      },
    });
    const diagnostics: Diagnostic[] = [];

    const config = resolvePluginRegistrationConfig(
      register(plugin, { renderer: "webgl", typo: true }),
      diagnostics,
    );

    expect(config).toBeUndefined();
    expect(diagnostics.map(({ code }) => code)).toEqual([
      "DREVER_PLUGIN_CONFIG_REQUIRED",
      "DREVER_PLUGIN_CONFIG_VALUE_INVALID",
      "DREVER_PLUGIN_CONFIG_UNKNOWN_PROPERTY",
    ]);
  });

  it("validates the AI-readable config manifest before using defaults", () => {
    const plugin = createPlugin({
      manifest: {
        title: "Charts",
        summary: "Accessible charts for Drever.",
        config: {
          description: "",
          properties: {
            renderer: {
              type: "string",
              description: "",
              values: ["svg", "svg"],
              default: "canvas",
            },
          },
        },
      },
    });
    const diagnostics: Diagnostic[] = [];

    const config = resolvePluginRegistrationConfig(register(plugin), diagnostics);

    expect(config).toBeUndefined();
    expect(diagnostics).toHaveLength(4);
    expect(new Set(diagnostics.map(({ code }) => code))).toEqual(
      new Set(["DREVER_PLUGIN_CONFIG_SCHEMA_INVALID"]),
    );
  });

  it("rejects config for a plugin without a config manifest", () => {
    const diagnostics: Diagnostic[] = [];

    const config = resolvePluginRegistrationConfig(
      register(createPlugin(), { animation: "reveal" }),
      diagnostics,
    );

    expect(config).toBeUndefined();
    expect(diagnostics).toMatchObject([{ code: "DREVER_PLUGIN_CONFIG_UNDECLARED" }]);
  });

  it("reports non-JSON registration config before plan serialization", () => {
    const plugin = createPlugin({
      manifest: {
        title: "Charts",
        summary: "Accessible charts for Drever.",
        config: {
          description: "Project-wide chart rendering choices.",
          properties: {
            precision: {
              type: "number",
              description: "Default decimal precision.",
            },
          },
        },
      },
    });
    const diagnostics: Diagnostic[] = [];

    const config = resolvePluginRegistrationConfig(
      register(plugin, { precision: Number.NaN }),
      diagnostics,
    );

    expect(config).toBeUndefined();
    expect(diagnostics).toMatchObject([
      {
        code: "DREVER_PLUGIN_CONFIG_NOT_SERIALIZABLE",
        details: { path: "$.config.precision", reason: "numbers must be finite" },
      },
    ]);
  });

  it("keeps options on build hooks while runtime references stay option-free", () => {
    const registration = register(
      createPlugin({
        baseURL: "file:///plugins/charts/index.ts",
        build: {
          remark: [{ specifier: "./remark.ts", options: { syntax: "chart" } }],
        },
        runtime: {
          setup: [{ specifier: "./setup.ts" }],
        },
      }),
    );
    const diagnostics: Diagnostic[] = [];

    const build = resolveBuildContributions([registration], diagnostics);
    const runtime = resolvePluginContributions([registration], new Map(), diagnostics);

    expect(diagnostics).toEqual([]);
    expect(build.remark[0]?.module).toEqual({
      specifier: "file:///plugins/charts/remark.ts",
      options: { syntax: "chart" },
    });
    expect(runtime.setup[0]?.module).toEqual({
      specifier: "file:///plugins/charts/setup.ts",
    });
  });

  it("preserves JSON keys that have special meaning on object prototypes", () => {
    const plugin = createPlugin({
      manifest: {
        config: {
          description: "Open configuration for integration testing.",
          properties: {},
          additionalProperties: true,
        },
      },
    });
    const config = JSON.parse('{"__proto__":{"polluted":true}}') as PluginRegistration["config"];
    const diagnostics: Diagnostic[] = [];

    const resolved = resolvePluginRegistrationConfig(register(plugin, config), diagnostics);

    expect(diagnostics).toEqual([]);
    expect(Object.hasOwn(resolved ?? {}, "__proto__")).toBe(true);
    expect(resolved?.["__proto__"]).toEqual({ polluted: true });
    expect(Object.getPrototypeOf(resolved)).toBe(Object.prototype);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
});

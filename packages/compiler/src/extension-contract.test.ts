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
    id: "contract-theme",
    tokens: { color: { canvas: "#fff", text: "#111" } },
    manifest: { title: "Contract", summary: "Contract test theme." },
    ...overrides,
  });

const createPlugin = (
  id: string,
  overrides: Partial<Omit<DreverPlugin, "apiVersion" | "id" | "kind" | "manifest">> = {},
): DreverPlugin =>
  definePlugin({
    kind: "plugin",
    apiVersion: 1,
    id,
    manifest: { title: id, summary: `Contract test plugin ${id}.` },
    ...overrides,
  });

const usePlugin = (plugin: DreverPlugin): PluginRegistration => ({
  plugin,
  origin: "user",
});

const diagnosticCodes = <Value>(result: DiagnosticResult<Value>): string[] =>
  result.diagnostics.map((diagnostic) => diagnostic.code);

describe("extension contracts", () => {
  it("accepts absolute extension base URLs", () => {
    const result = createCompilePlan({
      theme: createTheme({ baseURL: "file:///themes/contract.ts" }),
      plugins: [
        usePlugin(createPlugin("valid-base", { baseURL: "https://example.com/plugin/index.js" })),
      ],
    });

    expect(result.diagnostics).toEqual([]);
    expect(result).toMatchObject({ ok: true });
  });

  it("rejects every explicit baseURL that is not an absolute URL", () => {
    const result = createCompilePlan({
      theme: createTheme({ baseURL: "themes/contract.ts" }),
      plugins: [usePlugin(createPlugin("invalid-base", { baseURL: "plugins/invalid.ts" }))],
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toMatchObject([
      {
        code: "DREVER_EXTENSION_BASE_URL_INVALID",
        stage: "config",
        details: { baseURL: "themes/contract.ts", extension: "contract-theme" },
      },
      {
        code: "DREVER_EXTENSION_BASE_URL_INVALID",
        stage: "config",
        plugin: "invalid-base",
        details: { baseURL: "plugins/invalid.ts", extension: "invalid-base" },
      },
    ]);
  });

  it("validates AI-facing component prop descriptions, values, and defaults", () => {
    const plugin = createPlugin("component-contract", {
      runtime: {
        components: [
          {
            name: "Metric",
            module: { specifier: "metric-component" },
            manifest: {
              description: "Render a highlighted metric.",
              props: {
                label: { type: "string", description: " " },
                count: {
                  type: "number",
                  description: "The displayed count.",
                  values: [1, "one", 1],
                  default: 2,
                },
                enabled: {
                  type: "boolean",
                  description: "Whether the metric is visible.",
                  default: "yes",
                },
              },
            },
          },
        ],
      },
    });

    const result = createCompilePlan({ theme: createTheme(), plugins: [usePlugin(plugin)] });

    expect(result.ok).toBe(false);
    expect(diagnosticCodes(result)).toEqual([
      "DREVER_COMPONENT_PROP_MANIFEST_INVALID",
      "DREVER_COMPONENT_PROP_MANIFEST_INVALID",
      "DREVER_COMPONENT_PROP_MANIFEST_INVALID",
      "DREVER_COMPONENT_PROP_MANIFEST_INVALID",
      "DREVER_COMPONENT_PROP_MANIFEST_INVALID",
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.details?.issue)).toEqual([
      "description-empty",
      "values-duplicate",
      "value-type-mismatch",
      "default-not-allowed",
      "default-type-mismatch",
    ]);
    expect(result.diagnostics).toMatchObject([
      { details: { component: "Metric", prop: "label" } },
      { details: { component: "Metric", prop: "count" } },
      { details: { component: "Metric", index: 1, prop: "count", type: "number" } },
      { details: { component: "Metric", prop: "count" } },
      { details: { component: "Metric", prop: "enabled" } },
    ]);
  });

  it("requires meaningful layout slots and motion guidance", () => {
    const result = createCompilePlan({
      theme: createTheme({
        layouts: [
          {
            name: "Feature",
            module: { specifier: "feature-layout" },
            description: "A focused feature layout.",
            slots: [
              {
                name: "content",
                purpose: " ",
                accepts: ["text", "text"],
              },
            ],
          },
        ],
        motion: {
          id: " ",
          module: { specifier: "motion-profile" },
          intents: ["continuity"],
          guidance: ["Preserve spatial context.", " "],
        },
      }),
    });

    expect(result.ok).toBe(false);
    expect(diagnosticCodes(result)).toEqual([
      "DREVER_THEME_MOTION_INVALID",
      "DREVER_THEME_MOTION_INVALID",
      "DREVER_LAYOUT_SLOT_MANIFEST_INVALID",
      "DREVER_LAYOUT_SLOT_CONSTRAINT_INVALID",
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.details?.issue)).toEqual([
      "id-invalid",
      "guidance-empty",
      "purpose-empty",
      "accepts-duplicate",
    ]);
  });
});

describe("plugin ordering contracts", () => {
  it("rejects self references in before, after, and requires", () => {
    const self = createPlugin("self", {
      order: { before: ["self"], after: ["self"], requires: ["self"] },
    });
    const result = createCompilePlan({ theme: createTheme(), plugins: [usePlugin(self)] });

    expect(result.ok).toBe(false);
    expect(diagnosticCodes(result)).toEqual([
      "DREVER_PLUGIN_ORDER_SELF_REFERENCE",
      "DREVER_PLUGIN_ORDER_SELF_REFERENCE",
      "DREVER_PLUGIN_ORDER_SELF_REFERENCE",
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.details?.relation)).toEqual([
      "requires",
      "before",
      "after",
    ]);
  });

  it("rejects duplicate targets inside every ordering list", () => {
    const duplicate = createPlugin("duplicate", {
      order: {
        before: ["target", "target"],
        after: ["target", "target"],
        requires: ["target", "target"],
      },
    });
    const result = createCompilePlan({
      theme: createTheme(),
      plugins: [usePlugin(duplicate), usePlugin(createPlugin("target"))],
    });

    expect(result.ok).toBe(false);
    expect(diagnosticCodes(result)).toEqual([
      "DREVER_PLUGIN_ORDER_DUPLICATE",
      "DREVER_PLUGIN_ORDER_DUPLICATE",
      "DREVER_PLUGIN_ORDER_DUPLICATE",
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.details?.relation)).toEqual([
      "requires",
      "before",
      "after",
    ]);
  });
});

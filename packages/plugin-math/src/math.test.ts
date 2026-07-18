import { createCompilePlan, defineTheme } from "@drever/compiler";
import type { BuildPluginContext } from "@drever/plugin";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vite-plus/test";
import { math, mathPlugin } from "./index.ts";
import rehypeModule from "./rehype.ts";
import remarkModule from "./remark.ts";

const theme = defineTheme({
  kind: "theme",
  apiVersion: 1,
  id: "test-theme",
  tokens: {},
  manifest: { title: "Test", summary: "Test theme." },
});

const context = <Capability extends "rehype" | "remark">(
  capability: Capability,
  pluginConfig: BuildPluginContext<Capability>["pluginConfig"],
): BuildPluginContext<Capability> =>
  Object.freeze({
    capability,
    phase: "normal",
    plugin: Object.freeze({ id: mathPlugin.id, version: mathPlugin.version }),
    pluginConfig,
    projectRoot: "/deck",
    hookOptions: undefined,
  });

describe("@drever/plugin-math", () => {
  it("publishes typed opt-in configuration with safe defaults", () => {
    expect(math({ strict: "error" })).toMatchObject({
      plugin: mathPlugin,
      config: { strict: "error" },
    });
    const result = createCompilePlan({
      theme,
      plugins: [{ plugin: mathPlugin, origin: "user" }],
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        plugins: [
          {
            id: "@drever/plugin-math",
            origin: "user",
            config: {
              singleDollarTextMath: true,
              strict: "warn",
              throwOnError: true,
            },
          },
        ],
      },
    });
  });

  it("reports invalid strictness through the shared diagnostic contract", () => {
    const result = createCompilePlan({
      theme,
      plugins: [
        {
          plugin: mathPlugin,
          origin: "user",
          config: { strict: "unsafe" },
        },
      ],
    });
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "DREVER_PLUGIN_CONFIG_VALUE_INVALID",
          plugin: "@drever/plugin-math",
          details: { property: "strict" },
        },
      ],
    });
  });

  it("parses inline and display math with the official remark plugin", async () => {
    const contribution = await remarkModule.create(
      context("remark", { singleDollarTextMath: true }),
    );
    const processor = unified().use(remarkParse);
    const [plugin, options] = contribution as unknown as readonly [unknown, unknown];
    (processor.use as (plugin: unknown, options: unknown) => typeof processor)(plugin, options);
    const output = await processor.run(processor.parse("Energy: $E=mc^2$\n\n$$\nx^2\n$$"));
    expect(JSON.stringify(output)).toContain('"type":"inlineMath"');
    expect(JSON.stringify(output)).toContain('"type":"math"');
  });

  it("renders accessible KaTeX HAST without trusting TeX HTML commands", async () => {
    const contribution = await rehypeModule.create(
      context("rehype", { strict: "warn", throwOnError: true }),
    );
    const processor = unified();
    const [plugin, options] = contribution as unknown as readonly [unknown, unknown];
    (processor.use as (plugin: unknown, options: unknown) => typeof processor)(plugin, options);
    const tree = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "code",
          properties: { className: ["language-math", "math-inline"] },
          children: [{ type: "text", value: "E=mc^2" }],
        },
      ],
    };
    const output = await processor.run(tree as never);
    const serialized = JSON.stringify(output);
    expect(serialized).toContain("katex");
    expect(serialized).toContain("MathML");
    expect(serialized).not.toContain("script");
  });
});

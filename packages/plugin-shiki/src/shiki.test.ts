import { createCompilePlan, defineTheme } from "@drever/compiler";
import type { BuildPluginContext } from "@drever/plugin";
import { unified } from "unified";
import { describe, expect, it } from "vite-plus/test";
import { shiki, shikiPlugin } from "./index.ts";
import rehypeModule from "./rehype.ts";

const theme = defineTheme({
  kind: "theme",
  apiVersion: 1,
  id: "test-theme",
  tokens: {},
  manifest: { title: "Test", summary: "Test theme." },
});

const context = (pluginConfig: BuildPluginContext<"rehype">["pluginConfig"]) =>
  Object.freeze({
    capability: "rehype" as const,
    phase: "normal" as const,
    plugin: Object.freeze({ id: shikiPlugin.id, version: shikiPlugin.version }),
    pluginConfig,
    projectRoot: "/deck",
    hookOptions: undefined,
  });

describe("@drever/plugin-shiki", () => {
  it("publishes typed configuration and compiler-validated defaults", () => {
    expect(shiki({ darkTheme: "nord" })).toMatchObject({
      plugin: shikiPlugin,
      config: { darkTheme: "nord" },
    });

    const result = createCompilePlan({
      theme,
      plugins: [{ plugin: shikiPlugin, origin: "default" }],
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        plugins: [
          {
            id: "@drever/plugin-shiki",
            origin: "default",
            config: { darkTheme: "github-dark", lightTheme: "github-light" },
          },
        ],
      },
    });
  });

  it("turns invalid options into stable configuration diagnostics", () => {
    const result = createCompilePlan({
      theme,
      plugins: [
        {
          plugin: shikiPlugin,
          origin: "user",
          config: { darkTheme: 42 },
        },
      ],
    });
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "DREVER_PLUGIN_CONFIG_VALUE_INVALID",
          plugin: "@drever/plugin-shiki",
          details: { property: "darkTheme" },
        },
      ],
    });
  });

  it("uses the official rehype integration to generate dual-theme markup", async () => {
    const contribution = await rehypeModule.create(
      context({ darkTheme: "github-dark", lightTheme: "github-light" }),
    );
    const processor = unified();
    const [plugin, options] = contribution as unknown as readonly [unknown, unknown];
    (processor.use as (plugin: unknown, options: unknown) => typeof processor)(plugin, options);
    const tree = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "pre",
          properties: {},
          children: [
            {
              type: "element",
              tagName: "code",
              properties: { className: ["language-js"] },
              children: [{ type: "text", value: "const answer = 42;" }],
            },
          ],
        },
      ],
    };

    const output = await processor.run(tree as never);
    const serialized = JSON.stringify(output);
    expect(serialized).toContain("shiki-themes");
    expect(serialized).toContain("--shiki-dark");
    expect(serialized).toContain("light-dark(");
  }, 30_000);
});

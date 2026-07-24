import { createCompilePlan, defineTheme } from "@drever/compiler";
import type { BuildPluginContext } from "@drever/plugin";
import type { JsonObject } from "@drever/schema";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vite-plus/test";
import { gfm, gfmPlugin } from "./index.ts";
import rejectFootnotesModule from "./reject-footnotes.ts";
import remarkModule from "./remark.ts";

const theme = defineTheme({
  kind: "theme",
  apiVersion: 1,
  id: "test-theme",
  tokens: {},
  manifest: { title: "Test", summary: "Test theme." },
});

const context = (pluginConfig: BuildPluginContext<"remark">["pluginConfig"]) =>
  Object.freeze({
    capability: "remark" as const,
    phase: "normal" as const,
    plugin: Object.freeze({ id: gfmPlugin.id, version: gfmPlugin.version }),
    pluginConfig,
    projectRoot: "/deck",
    hookOptions: undefined,
  });

type AstNode = Readonly<{
  checked?: boolean | null;
  children?: readonly AstNode[];
  type: string;
  url?: string;
}>;

const parse = async (source: string, pluginConfig: JsonObject = {}) => {
  const contribution = await remarkModule.create(context(pluginConfig));
  const processor = unified().use(remarkParse);
  const [plugin, options] = contribution as unknown as readonly [unknown, unknown];
  (processor.use as (plugin: unknown, options: unknown) => typeof processor)(plugin, options);
  return processor.run(processor.parse(source)) as Promise<AstNode>;
};

const parseWithGuard = async (source: string) => {
  const gfmContribution = await remarkModule.create(context({}));
  const guardContribution = await rejectFootnotesModule.create(context({}));
  const processor = unified().use(remarkParse);
  const [plugin, options] = gfmContribution as unknown as readonly [unknown, unknown];
  (processor.use as (plugin: unknown, options: unknown) => typeof processor)(plugin, options);
  (processor.use as (plugin: unknown) => typeof processor)(guardContribution);
  return processor.run(processor.parse(source));
};

const nodesOfType = (node: AstNode, type: string): AstNode[] => [
  ...(node.type === type ? [node] : []),
  ...(node.children?.flatMap((child) => nodesOfType(child, type)) ?? []),
];

describe("@drever/plugin-gfm", () => {
  it("publishes typed opt-in configuration with the parser default", () => {
    expect(gfm({ singleTilde: false })).toMatchObject({
      plugin: gfmPlugin,
      config: { singleTilde: false },
    });

    const result = createCompilePlan({
      theme,
      plugins: [{ plugin: gfmPlugin, origin: "user" }],
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        plugins: [
          {
            id: "@drever/plugin-gfm",
            origin: "user",
            config: { singleTilde: true },
          },
        ],
        runtime: {
          styles: [
            {
              owner: { id: "@drever/plugin-gfm", kind: "plugin" },
              style: { layer: "component" },
            },
          ],
        },
      },
    });
  });

  it("reports invalid configuration through the shared diagnostic contract", () => {
    const result = createCompilePlan({
      theme,
      plugins: [
        {
          plugin: gfmPlugin,
          origin: "user",
          config: { singleTilde: "sometimes" },
        },
      ],
    });
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "DREVER_PLUGIN_CONFIG_VALUE_INVALID",
          plugin: "@drever/plugin-gfm",
          details: { property: "singleTilde" },
        },
      ],
    });
  });

  it("parses tables, task lists, autolinks, and strikethrough into real GFM nodes", async () => {
    const tree = await parse(
      [
        "| Item | Ready |",
        "| --- | --- |",
        "| Demo | yes |",
        "",
        "- [x] Ship it",
        "- [ ] Review it",
        "",
        "Visit https://drever.dev and ~~remove this~~.",
      ].join("\n"),
    );

    expect(nodesOfType(tree, "table")).toHaveLength(1);
    expect(nodesOfType(tree, "listItem").map(({ checked }) => checked)).toEqual([true, false]);
    expect(nodesOfType(tree, "link")).toContainEqual(
      expect.objectContaining({ url: "https://drever.dev" }),
    );
    expect(nodesOfType(tree, "delete")).toHaveLength(1);
  });

  it("honors the single-tilde parsing option without disabling double-tilde syntax", async () => {
    const enabled = await parse("~single~ and ~~double~~");
    const disabled = await parse("~single~ and ~~double~~", { singleTilde: false });

    expect(nodesOfType(enabled, "delete")).toHaveLength(2);
    expect(nodesOfType(disabled, "delete")).toHaveLength(1);
  });

  it("rejects footnotes before document-level output can escape Slide boundaries", async () => {
    await expect(parseWithGuard("Claim[^proof]\n\n[^proof]: Evidence.")).rejects.toMatchObject({
      column: 6,
      line: 1,
      message: expect.stringContaining("@drever/plugin-gfm does not support footnotes yet"),
      ruleId: "gfm-footnotes-unsupported",
      source: "drever",
    });
  });
});

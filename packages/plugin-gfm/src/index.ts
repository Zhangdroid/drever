import { definePlugin } from "@drever/compiler";
import type { JsonObject } from "@drever/schema";

const PACKAGE_ROOT = new URL("../", import.meta.url).href;
const BUILD_MODULE_EXTENSION = import.meta.url.endsWith(".ts") ? "ts" : "mjs";
const BUILD_MODULE_DIRECTORY = BUILD_MODULE_EXTENSION === "ts" ? "src" : "dist";
const buildModule = (name: string): string =>
  `./${BUILD_MODULE_DIRECTORY}/${name}.${BUILD_MODULE_EXTENSION}`;

export type GfmOptions = Readonly<{
  singleTilde?: boolean;
}>;

export const gfmPlugin = definePlugin({
  kind: "plugin",
  apiVersion: 1,
  id: "@drever/plugin-gfm",
  version: "0.0.0",
  baseURL: PACKAGE_ROOT,
  compilerTargets: ["canonical"],
  build: {
    remark: [{ specifier: buildModule("remark") }, { specifier: buildModule("reject-footnotes") }],
  },
  runtime: {
    styles: [{ specifier: "./styles.css", layer: "component" }],
  },
  manifest: {
    title: "Drever GFM",
    summary:
      "Adds autolink literals, strikethrough, tables, and task lists to Markdown. Footnotes are not supported.",
    config: {
      description: "Configure GitHub Flavored Markdown parsing.",
      properties: {
        singleTilde: {
          type: "boolean",
          description: "Treat text wrapped in one tilde as strikethrough.",
          default: true,
        },
      },
    },
  },
});

export const gfm = (
  options: GfmOptions = {},
): Readonly<{ plugin: typeof gfmPlugin; config: JsonObject }> =>
  Object.freeze({
    plugin: gfmPlugin,
    config: Object.freeze(
      options.singleTilde === undefined ? {} : { singleTilde: options.singleTilde },
    ),
  });

export default gfmPlugin;

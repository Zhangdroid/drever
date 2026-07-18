import { definePlugin } from "@drever/compiler";
import type { JsonObject } from "@drever/schema";

const PACKAGE_ROOT = new URL("../", import.meta.url).href;
const BUILD_MODULE_EXTENSION = import.meta.url.endsWith(".ts") ? "ts" : "mjs";
const BUILD_MODULE_DIRECTORY = BUILD_MODULE_EXTENSION === "ts" ? "src" : "dist";
const buildModule = (name: string): string =>
  `./${BUILD_MODULE_DIRECTORY}/${name}.${BUILD_MODULE_EXTENSION}`;

export type ShikiOptions = Readonly<{
  darkTheme?: string;
  lightTheme?: string;
}>;

export const shikiPlugin = definePlugin({
  kind: "plugin",
  apiVersion: 1,
  id: "@drever/plugin-shiki",
  version: "0.0.0",
  baseURL: PACKAGE_ROOT,
  compilerTargets: ["canonical"],
  build: {
    rehype: [{ specifier: buildModule("rehype") }],
  },
  manifest: {
    title: "Drever Shiki",
    summary: "Highlights fenced code at build time with light and dark Shiki themes.",
    config: {
      description: "Select the bundled Shiki themes used for generated code markup.",
      properties: {
        darkTheme: {
          type: "string",
          description: "Bundled Shiki theme used by the dark color scheme.",
          default: "github-dark",
        },
        lightTheme: {
          type: "string",
          description: "Bundled Shiki theme used by the light color scheme.",
          default: "github-light",
        },
      },
    },
  },
});

export const shiki = (
  options: ShikiOptions = {},
): Readonly<{ plugin: typeof shikiPlugin; config: JsonObject }> =>
  Object.freeze({
    plugin: shikiPlugin,
    config: Object.freeze({
      ...(options.darkTheme === undefined ? {} : { darkTheme: options.darkTheme }),
      ...(options.lightTheme === undefined ? {} : { lightTheme: options.lightTheme }),
    }),
  });

export default shikiPlugin;

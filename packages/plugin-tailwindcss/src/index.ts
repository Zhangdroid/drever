import { definePlugin } from "@drever/compiler";
import type { JsonObject } from "@drever/schema";

const PACKAGE_ROOT = new URL("../", import.meta.url).href;
const BUILD_MODULE_EXTENSION = import.meta.url.endsWith(".ts") ? "ts" : "mjs";
const BUILD_MODULE_DIRECTORY = BUILD_MODULE_EXTENSION === "ts" ? "src" : "dist";
const buildModule = (name: string): string =>
  `./${BUILD_MODULE_DIRECTORY}/${name}.${BUILD_MODULE_EXTENSION}`;

export const DREVER_TAILWIND_STYLES_ID = "virtual:drever/tailwindcss.css";

export type TailwindCssOptions = Readonly<{
  optimize?: boolean;
}>;

export const tailwindCssPlugin = definePlugin({
  kind: "plugin",
  apiVersion: 1,
  id: "@drever/plugin-tailwindcss",
  version: "0.0.0",
  baseURL: PACKAGE_ROOT,
  compilerTargets: ["canonical"],
  build: {
    enforce: "pre",
    vite: [{ specifier: buildModule("vite") }],
  },
  runtime: {
    styles: [{ specifier: DREVER_TAILWIND_STYLES_ID, layer: "utility" }],
  },
  manifest: {
    title: "Drever Tailwind CSS",
    summary:
      "Generates Tailwind CSS v4 utilities from the deck project with the official Vite plugin.",
    config: {
      description: "Control Tailwind's production CSS optimization.",
      properties: {
        optimize: {
          type: "boolean",
          description: "Override Tailwind's environment-sensitive CSS optimization setting.",
        },
      },
    },
  },
});

export const tailwindCss = (
  options: TailwindCssOptions = {},
): Readonly<{ plugin: typeof tailwindCssPlugin; config: JsonObject }> =>
  Object.freeze({
    plugin: tailwindCssPlugin,
    config: Object.freeze(options.optimize === undefined ? {} : { optimize: options.optimize }),
  });

export default tailwindCssPlugin;

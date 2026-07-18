import { definePlugin } from "@drever/compiler";
import type { JsonObject } from "@drever/schema";

const PACKAGE_ROOT = new URL("../", import.meta.url).href;
const BUILD_MODULE_EXTENSION = import.meta.url.endsWith(".ts") ? "ts" : "mjs";
const BUILD_MODULE_DIRECTORY = BUILD_MODULE_EXTENSION === "ts" ? "src" : "dist";
const buildModule = (name: string): string =>
  `./${BUILD_MODULE_DIRECTORY}/${name}.${BUILD_MODULE_EXTENSION}`;

export type MathOptions = Readonly<{
  singleDollarTextMath?: boolean;
  strict?: "error" | "ignore" | "warn";
  throwOnError?: boolean;
}>;

export const mathPlugin = definePlugin({
  kind: "plugin",
  apiVersion: 1,
  id: "@drever/plugin-math",
  version: "0.0.0",
  baseURL: PACKAGE_ROOT,
  compilerTargets: ["canonical"],
  build: {
    remark: [{ specifier: buildModule("remark") }],
    rehype: [{ specifier: buildModule("rehype") }],
  },
  runtime: {
    styles: [{ specifier: "./styles.css", layer: "component" }],
  },
  manifest: {
    title: "Drever Math",
    summary: "Parses TeX math in Markdown and renders accessible KaTeX markup at build time.",
    config: {
      description: "Configure Markdown math parsing and safe KaTeX error behavior.",
      properties: {
        singleDollarTextMath: {
          type: "boolean",
          description: "Allow single-dollar delimiters for inline math.",
          default: true,
        },
        strict: {
          type: "string",
          description: "How KaTeX handles LaTeX compatibility warnings.",
          values: ["error", "ignore", "warn"],
          default: "warn",
        },
        throwOnError: {
          type: "boolean",
          description: "Fail compilation when KaTeX encounters invalid input.",
          default: true,
        },
      },
    },
  },
});

export const math = (
  options: MathOptions = {},
): Readonly<{ plugin: typeof mathPlugin; config: JsonObject }> =>
  Object.freeze({
    plugin: mathPlugin,
    config: Object.freeze({
      ...(options.singleDollarTextMath === undefined
        ? {}
        : { singleDollarTextMath: options.singleDollarTextMath }),
      ...(options.strict === undefined ? {} : { strict: options.strict }),
      ...(options.throwOnError === undefined ? {} : { throwOnError: options.throwOnError }),
    }),
  });

export default mathPlugin;

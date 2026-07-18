import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineVitePlugin } from "@drever/plugin";
import type { Plugin } from "vite";
import { DREVER_TAILWIND_STYLES_ID } from "./index.ts";

const TAILWIND_THEME = fileURLToPath(import.meta.resolve("tailwindcss/theme.css"));
const TAILWIND_UTILITIES = fileURLToPath(import.meta.resolve("tailwindcss/utilities.css"));
const DREVER_STYLES_ID = "virtual:drever/styles.css";
const RESOLVED_DREVER_STYLES_ID = `\0${DREVER_STYLES_ID}`;
const TAILWIND_LAYER = "drever.utility";
const PROJECT_SOURCE = "../..";

const cssPath = (path: string): string => path.replaceAll("\\", "/");

export const createTailwindSource = (scanRoot = PROJECT_SOURCE): string => {
  return [
    `@import ${JSON.stringify(cssPath(TAILWIND_THEME))};`,
    `@import ${JSON.stringify(cssPath(TAILWIND_UTILITIES))} source(${JSON.stringify(cssPath(scanRoot))});`,
    "",
  ].join("\n");
};

const tailwindRuntimeImport = `@import ${JSON.stringify(DREVER_TAILWIND_STYLES_ID)} layer(${TAILWIND_LAYER});`;

export const replaceTailwindRuntimeImport = (source: string, sourceId: string): string =>
  source.replace(
    tailwindRuntimeImport,
    `@import ${JSON.stringify(cssPath(sourceId))} layer(${TAILWIND_LAYER});`,
  );

export const createTailwindSourceId = (projectRoot: string): string =>
  join(projectRoot, ".drever", "cache", "tailwindcss.css");

export const materializeTailwindSource = async (projectRoot: string): Promise<string> => {
  const sourceId = createTailwindSourceId(projectRoot);
  await mkdir(dirname(sourceId), { recursive: true });
  await writeFile(sourceId, createTailwindSource(), "utf8");
  return sourceId;
};

export const createTailwindSourcePlugin = (projectRoot: string): Plugin => {
  const sourceId = createTailwindSourceId(projectRoot);
  return {
    name: "drever:tailwindcss-source",
    enforce: "pre",
    resolveId(id) {
      if (id === DREVER_TAILWIND_STYLES_ID) {
        return sourceId;
      }
    },
    load(id) {
      if (id === sourceId) {
        return createTailwindSource();
      }
    },
    transform(source, id) {
      if (id === RESOLVED_DREVER_STYLES_ID) {
        return replaceTailwindRuntimeImport(source, sourceId);
      }
    },
  };
};

export default defineVitePlugin(async ({ pluginConfig, projectRoot }) => {
  const optimize = pluginConfig.optimize;
  await materializeTailwindSource(projectRoot);
  return [
    createTailwindSourcePlugin(projectRoot),
    ...tailwindcss(typeof optimize === "boolean" ? { optimize } : {}),
  ];
});

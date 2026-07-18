import { createCompilePlan, defineTheme } from "@drever/compiler";
import type { BuildPluginContext } from "@drever/plugin";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, type Plugin, type PluginOption } from "vite";
import { describe, expect, it } from "vite-plus/test";
import { DREVER_TAILWIND_STYLES_ID, tailwindCss, tailwindCssPlugin } from "./index.ts";
import viteModule, {
  createTailwindSource,
  createTailwindSourceId,
  replaceTailwindRuntimeImport,
} from "./vite.ts";

const DREVER_STYLES_ID = "virtual:drever/styles.css";
const RESOLVED_DREVER_STYLES_ID = `\0${DREVER_STYLES_ID}`;

const theme = defineTheme({
  kind: "theme",
  apiVersion: 1,
  id: "test-theme",
  tokens: {},
  manifest: { title: "Test", summary: "Test theme." },
});

const context = (
  projectRoot: string,
  pluginConfig: BuildPluginContext<"vite">["pluginConfig"] = {},
) =>
  Object.freeze({
    capability: "vite" as const,
    phase: "pre" as const,
    plugin: Object.freeze({ id: tailwindCssPlugin.id, version: tailwindCssPlugin.version }),
    pluginConfig,
    projectRoot,
    hookOptions: undefined,
  });

describe("@drever/plugin-tailwindcss", () => {
  it("publishes typed configuration and stable invalid-option diagnostics", () => {
    expect(tailwindCss({ optimize: false })).toMatchObject({
      plugin: tailwindCssPlugin,
      config: { optimize: false },
    });
    const result = createCompilePlan({
      theme,
      plugins: [
        {
          plugin: tailwindCssPlugin,
          origin: "default",
          config: { optimize: "yes" as never },
        },
      ],
    });
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "DREVER_PLUGIN_CONFIG_VALUE_INVALID",
          plugin: "@drever/plugin-tailwindcss",
          details: { property: "optimize" },
        },
      ],
    });
  });

  it("generates utilities from the deck project without importing Preflight", () => {
    const source = createTailwindSource();
    expect(source).toContain('source("../..")');
    expect(source).toContain("tailwindcss/theme.css");
    expect(source).toContain("tailwindcss/utilities.css");
    expect(source).not.toContain("tailwindcss/index.css");
    expect(source).not.toContain("tailwindcss/preflight.css");
    expect(source).not.toContain("process.cwd");
  });

  it("inlines its source into Drever's layered stylesheet before Tailwind compiles it", () => {
    const source = replaceTailwindRuntimeImport(
      `@layer drever.theme, drever.utility;\n@import ${JSON.stringify(DREVER_TAILWIND_STYLES_ID)} layer(drever.utility);\n`,
      createTailwindSourceId("/deck"),
    );

    expect(source).not.toContain(DREVER_TAILWIND_STYLES_ID);
    expect(source).toContain("layer(drever.utility)");
    expect(source).toContain('/deck/.drever/cache/tailwindcss.css"');
  });

  it("uses the official Vite plugin to generate utilities from MDX outside Vite's root", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "drever-tailwind-project-"));
    const appRoot = await mkdtemp(join(tmpdir(), "drever-tailwind-app-"));
    try {
      await writeFile(
        join(projectRoot, "slides.mdx"),
        '<div className="text-red-500 font-bold">Detected in the deck project</div>\n',
      );
      await writeFile(join(appRoot, "entry.js"), `import ${JSON.stringify(DREVER_STYLES_ID)};\n`);
      const plugins = await viteModule.create(context(projectRoot, { optimize: false }));
      const runtimeStylesPlugin: Plugin = {
        name: "test:drever-runtime-styles",
        enforce: "pre",
        resolveId(id) {
          if (id === DREVER_STYLES_ID) {
            return RESOLVED_DREVER_STYLES_ID;
          }
        },
        load(id) {
          if (id === RESOLVED_DREVER_STYLES_ID) {
            return `@layer drever.theme, drever.utility;\n@import ${JSON.stringify(DREVER_TAILWIND_STYLES_ID)} layer(drever.utility);\n`;
          }
        },
      };
      await build({
        configFile: false,
        logLevel: "silent",
        plugins: [runtimeStylesPlugin, ...(plugins as PluginOption[])],
        root: appRoot,
        build: {
          outDir: "dist",
          rollupOptions: { input: join(appRoot, "entry.js") },
        },
      });

      const assets = join(appRoot, "dist", "assets");
      const cssFile = (await readdir(assets)).find((file) => file.endsWith(".css"));
      expect(cssFile).toBeDefined();
      expect(await readFile(join(assets, cssFile as string), "utf8")).toContain(".text-red-500");
    } finally {
      await Promise.all([
        rm(projectRoot, { force: true, recursive: true }),
        rm(appRoot, { force: true, recursive: true }),
      ]);
    }
  });
});

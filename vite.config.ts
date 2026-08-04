import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const source = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  fmt: {
    ignorePatterns: [
      "plugins/drever/.claude-plugin/**",
      "plugins/drever/.codex-plugin/**",
      "website/public/release-smoke/**",
    ],
  },
  lint: {
    ignorePatterns: ["website/public/release-smoke/**"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
    },
  },
  run: {
    cache: true,
  },
  test: {
    alias: {
      "@drever/brand": source("./packages/brand/src/index.ts"),
      "@drever/client/storyboard": source("./packages/client/src/storyboard-entry.ts"),
      "@drever/client": source("./packages/client/src/index.ts"),
      "@drever/compiler/internal": source("./packages/compiler/src/internal.ts"),
      "@drever/compiler": source("./packages/compiler/src/index.ts"),
      "@drever/core": source("./packages/core/src/index.ts"),
      "@drever/designs/basic": source("./packages/designs/src/basic/index.ts"),
      "@drever/plugin": source("./packages/plugin/src/index.ts"),
      "@drever/plugin-gfm": source("./packages/plugin-gfm/src/index.ts"),
      "@drever/plugin-shiki": source("./packages/plugin-shiki/src/index.ts"),
      "@drever/plugin-tailwindcss": source("./packages/plugin-tailwindcss/src/index.ts"),
      "@drever/schema": source("./packages/schema/src/index.ts"),
      "@drever/vite": source("./packages/vite/src/index.ts"),
    },
  },
});

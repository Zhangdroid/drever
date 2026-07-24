import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const source = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  pack: {
    deps: { onlyBundle: [] },
    dts: true,
    entry: { bin: "src/bin.ts", create: "src/create.ts", index: "src/index.ts" },
    exports: false,
    tsconfig: "tsconfig.build.json",
  },
  test: {
    alias: {
      "@drever/client": source("../client/src/index.ts"),
      "@drever/compiler/internal": source("../compiler/src/internal.ts"),
      "@drever/compiler": source("../compiler/src/index.ts"),
      "@drever/core": source("../core/src/index.ts"),
      "@drever/designs/default": source("../designs/src/default/index.ts"),
      "@drever/plugin": source("../plugin/src/index.ts"),
      "@drever/plugin-shiki": source("../plugin-shiki/src/index.ts"),
      "@drever/plugin-tailwindcss": source("../plugin-tailwindcss/src/index.ts"),
      "@drever/schema": source("../schema/src/index.ts"),
      "@drever/vite": source("../vite/src/index.ts"),
    },
    include: ["src/**/*.test.ts"],
  },
});

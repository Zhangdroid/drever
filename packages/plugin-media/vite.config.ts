import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    deps: { onlyBundle: [] },
    dts: true,
    entry: { index: "src/index.ts", youtube: "src/youtube.tsx" },
    exports: false,
    tsconfig: "tsconfig.build.json",
  },
  test: {
    alias: {
      "@drever/compiler": fileURLToPath(new URL("../compiler/src/index.ts", import.meta.url)),
      "@drever/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
      "@drever/schema": fileURLToPath(new URL("../schema/src/index.ts", import.meta.url)),
    },
    include: ["src/**/*.test.{ts,tsx}"],
  },
});

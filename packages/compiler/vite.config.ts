import { defineConfig } from "vite-plus";
import { fileURLToPath } from "node:url";

export default defineConfig({
  pack: {
    deps: { onlyBundle: [] },
    dts: true,
    entry: { index: "src/index.ts", internal: "src/internal.ts" },
    exports: false,
    tsconfig: "tsconfig.build.json",
  },
  test: {
    alias: {
      "@drever/schema": fileURLToPath(new URL("../schema/src/index.ts", import.meta.url)),
    },
    include: ["src/**/*.test.ts"],
  },
});

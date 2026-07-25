import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    deps: { onlyBundle: [] },
    dts: true,
    entry: {
      "animated-number": "src/animated-number.tsx",
      "data-chart": "src/data-chart.tsx",
      index: "src/index.ts",
    },
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

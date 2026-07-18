import { defineConfig } from "vite-plus";
import { fileURLToPath } from "node:url";

export default defineConfig({
  pack: {
    deps: { onlyBundle: [] },
    dts: true,
    exports: false,
    tsconfig: "tsconfig.build.json",
  },
  test: {
    alias: {
      "@drever/compiler/internal": fileURLToPath(
        new URL("../compiler/src/internal.ts", import.meta.url),
      ),
      "@drever/compiler": fileURLToPath(new URL("../compiler/src/index.ts", import.meta.url)),
      "@drever/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
      "@drever/plugin": fileURLToPath(new URL("../plugin/src/index.ts", import.meta.url)),
      "@drever/schema": fileURLToPath(new URL("../schema/src/index.ts", import.meta.url)),
    },
    include: ["src/**/*.test.ts"],
  },
});

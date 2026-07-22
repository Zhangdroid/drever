import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    deps: { onlyBundle: [] },
    dts: false,
    entry: { bin: "src/bin.ts" },
    exports: false,
    tsconfig: "tsconfig.build.json",
  },
});

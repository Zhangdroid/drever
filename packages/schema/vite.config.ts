import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    deps: { onlyBundle: [] },
    dts: true,
    exports: false,
  },
});

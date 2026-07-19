import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    deps: { onlyBundle: [] },
    dts: true,
    exports: false,
    tsconfig: "tsconfig.build.json",
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});

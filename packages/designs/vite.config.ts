import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    deps: { onlyBundle: [] },
    dts: true,
    entry: {
      index: "src/index.ts",
      atlas: "src/atlas/index.ts",
      "atlas-layouts": "src/atlas/layouts.tsx",
      cinema: "src/cinema/index.ts",
      "cinema-layouts": "src/cinema/layouts.tsx",
      construct: "src/construct/index.ts",
      "construct-layouts": "src/construct/layouts.tsx",
      default: "src/default/index.ts",
      "default-layouts": "src/default/layouts.tsx",
      editorial: "src/editorial/index.ts",
      "editorial-layouts": "src/editorial/layouts.tsx",
      fieldnote: "src/fieldnote/index.ts",
      "fieldnote-layouts": "src/fieldnote/layouts.tsx",
      ledger: "src/ledger/index.ts",
      "ledger-layouts": "src/ledger/layouts.tsx",
      studio: "src/studio/index.ts",
      "studio-layouts": "src/studio/layouts.tsx",
    },
    exports: false,
    tsconfig: "tsconfig.build.json",
  },
  test: {
    alias: {
      "@drever/compiler": fileURLToPath(new URL("../compiler/src/index.ts", import.meta.url)),
      "@drever/schema": fileURLToPath(new URL("../schema/src/index.ts", import.meta.url)),
    },
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});

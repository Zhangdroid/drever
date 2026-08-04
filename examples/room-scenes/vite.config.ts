import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    alias: {
      "@drever/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      "@drever/schema": fileURLToPath(
        new URL("../../packages/schema/src/index.ts", import.meta.url),
      ),
    },
    include: ["components/**/*.test.{ts,tsx}"],
  },
});

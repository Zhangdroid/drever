import chartsPlugin from "@drever/plugin-charts";
import { math } from "@drever/plugin-math";
import mediaPlugin from "@drever/plugin-media";
import studioTheme from "@drever/designs/studio";
import { defineConfig } from "drever";

export default defineConfig({
  plugins: [chartsPlugin, math({ strict: "warn", throwOnError: true }), mediaPlugin],
  rehearsal: {
    targetDurationMinutes: 12,
  },
  theme: studioTheme,
  server: {
    host: "127.0.0.1",
    port: 4324,
    strictPort: true,
  },
});

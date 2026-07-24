import { math } from "@drever/plugin-math";
import studioTheme from "@drever/designs/studio";
import { defineConfig } from "drever";

export default defineConfig({
  plugins: [math({ strict: "warn", throwOnError: true })],
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

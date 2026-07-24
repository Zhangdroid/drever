import cinemaTheme from "@drever/designs/cinema";
import { defineConfig } from "drever";

export default defineConfig({
  rehearsal: {
    targetDurationMinutes: 6,
  },
  stage: {
    background: "./stage-background.tsx",
  },
  theme: cinemaTheme,
  server: {
    host: "127.0.0.1",
    port: 4325,
    strictPort: true,
  },
});

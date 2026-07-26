import cinemaTheme from "@drever/designs/cinema";
import { defineConfig } from "drever";

export default defineConfig({
  canvas: {
    height: 720,
    width: 1280,
  },
  rehearsal: {
    targetDurationMinutes: 4,
  },
  stage: {
    background: "./stage-background.tsx",
  },
  theme: cinemaTheme,
  server: {
    host: "127.0.0.1",
    port: 4329,
    strictPort: true,
  },
});

import cinemaTheme from "@drever/designs/cinema";
import { defineConfig } from "drever";

export default defineConfig({
  canvas: {
    height: 720,
    width: 1280,
  },
  deck: {
    description:
      "See how live 3D can carry structure, focused motion, and atmosphere without taking over the story.",
    lang: "en",
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

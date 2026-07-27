import cinemaTheme from "@drever/designs/cinema";
import { defineConfig } from "drever";

export default defineConfig({
  deck: {
    description: "Ambient and interactive presentation scenes that respond to the room.",
    lang: "en",
  },
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

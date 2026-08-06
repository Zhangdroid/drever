import basicTheme from "@drever/designs/basic";
import { defineConfig } from "drever";

export default defineConfig({
  deck: {
    description: "A private, stable fixture for Drever browser contracts.",
    lang: "en",
    title: "Drever core E2E fixture",
  },
  rehearsal: {
    targetDurationMinutes: 5,
  },
  server: {
    host: "127.0.0.1",
    port: 4317,
    strictPort: true,
  },
  stage: {
    background: "./stage-background.tsx",
    foreground: "./stage-foreground.tsx",
  },
  theme: basicTheme,
});

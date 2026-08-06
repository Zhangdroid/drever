import basicTheme from "@drever/designs/basic";
import { defineConfig } from "drever";

export default defineConfig({
  deck: {
    description: "A small, runnable introduction to readable and interactive Drever slides.",
    lang: "en",
    title: "Slides can stay useful.",
  },
  rehearsal: {
    targetDurationMinutes: 5,
  },
  server: {
    host: "127.0.0.1",
    port: 4317,
    strictPort: true,
  },
  theme: basicTheme,
});

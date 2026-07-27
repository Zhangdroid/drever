import editorialTheme from "@drever/designs/editorial";
import { defineConfig } from "drever";

export default defineConfig({
  deck: {
    description: "Practical motion patterns that explain how a presentation changes.",
    lang: "en",
  },
  canvas: {
    height: 720,
    width: 1280,
  },
  rehearsal: {
    targetDurationMinutes: 8,
  },
  theme: editorialTheme,
  server: {
    host: "127.0.0.1",
    port: 4328,
    strictPort: true,
  },
});

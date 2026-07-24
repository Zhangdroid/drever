import editorialTheme from "@drever/designs/editorial";
import { defineConfig } from "drever";

export default defineConfig({
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

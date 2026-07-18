import editorialTheme from "@drever/theme-editorial";
import { defineConfig } from "drever";

export default defineConfig({
  rehearsal: {
    targetDurationMinutes: 20,
  },
  theme: editorialTheme,
  server: {
    host: "127.0.0.1",
    port: 4320,
    strictPort: true,
  },
});

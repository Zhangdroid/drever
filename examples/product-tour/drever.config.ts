import editorialTheme from "@drever/designs/editorial";
import { defineConfig } from "drever";

export default defineConfig({
  deck: {
    description: "See how Drever turns one clear brief into a live, connected presentation.",
    lang: "en",
  },
  rehearsal: {
    targetDurationMinutes: 20,
  },
  stage: {
    background: "./stage-background.tsx",
    foreground: "./stage-foreground.tsx",
  },
  theme: editorialTheme,
  server: {
    host: "127.0.0.1",
    port: 4320,
    strictPort: true,
  },
});

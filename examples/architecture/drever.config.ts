import { defineConfig } from "drever";
import architectureTheme from "./design/theme.ts";

export default defineConfig({
  stage: {
    background: "./stage-background.tsx",
    foreground: "./stage-foreground.tsx",
  },
  theme: architectureTheme,
  server: {
    host: "127.0.0.1",
    port: 4321,
    strictPort: true,
  },
});

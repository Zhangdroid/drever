import studioTheme from "@drever/designs/studio";
import { defineConfig } from "drever";

export default defineConfig({
  theme: studioTheme,
  server: {
    host: "127.0.0.1",
    port: 4321,
    strictPort: true,
  },
});

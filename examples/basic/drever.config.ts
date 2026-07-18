import { defineConfig } from "drever";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 4317,
    strictPort: true,
  },
});

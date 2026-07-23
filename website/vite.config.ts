import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
// oxlint-disable-next-line vite-plus/prefer-vite-plus-imports -- TanStack Start uses Vite's config contract.
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tanstackStart({
      prerender: {
        enabled: true,
        failOnError: true,
      },
      router: {
        quoteStyle: "double",
        semicolons: true,
      },
    }),
    react(),
  ],
  server: {
    port: 4318,
  },
});

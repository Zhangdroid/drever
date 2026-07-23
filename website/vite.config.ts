import { reactRouter } from "@react-router/dev/vite";
// oxlint-disable-next-line vite-plus/prefer-vite-plus-imports -- React Router requires Vite's config contract.
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [reactRouter()],
  server: {
    port: 4318,
  },
});

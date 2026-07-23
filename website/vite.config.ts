import mdx from "@mdx-js/rollup";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
// oxlint-disable-next-line vite-plus/prefer-vite-plus-imports -- TanStack Start uses Vite's config contract.
import { defineConfig } from "vite";
import { publicPresentationMounts, siteRoutes } from "./site-manifest";

export default defineConfig({
  plugins: [
    { enforce: "pre", ...mdx() },
    tanstackStart({
      pages: [
        ...siteRoutes.map((path) => ({ path })),
        ...publicPresentationMounts.map(({ slug }) => ({
          path: `/demos/${slug}/`,
          prerender: { enabled: false },
        })),
      ],
      prerender: {
        autoStaticPathsDiscovery: false,
        concurrency: 2,
        crawlLinks: false,
        enabled: true,
        failOnError: true,
      },
      router: {
        quoteStyle: "double",
        semicolons: true,
      },
      sitemap: { enabled: false },
    }),
    react({ include: /\.(?:js|jsx|mdx|ts|tsx)$/ }),
  ],
  server: {
    host: "127.0.0.1",
    port: 4318,
  },
  preview: {
    host: "127.0.0.1",
  },
});

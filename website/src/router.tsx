import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

export const getRouter = () =>
  createRouter({
    defaultPreload: "intent",
    defaultViewTransition: {
      types: ({ fromLocation, pathChanged, toLocation }) => {
        if (!pathChanged) return false;

        const fromDocs = fromLocation?.pathname.startsWith("/docs") ?? false;
        const toDocs = toLocation.pathname.startsWith("/docs");
        return [fromDocs && toDocs ? "docs-page" : "site-page"];
      },
    },
    routeTree,
    scrollRestoration: true,
    scrollRestorationBehavior: "instant",
    trailingSlash: "always",
  });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

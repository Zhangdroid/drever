import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

export const getRouter = () =>
  createRouter({
    defaultPreload: "intent",
    defaultViewTransition: {
      types: ({ pathChanged }) => (pathChanged ? ["site-page"] : false),
    },
    routeTree,
    scrollRestoration: true,
  });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

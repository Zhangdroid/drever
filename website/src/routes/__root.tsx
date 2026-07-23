import faviconHref from "@drever/brand/assets/favicon.svg";
import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import siteStylesHref from "../site.css?url";

export const Route = createRootRoute({
  component: RootComponent,
  head: () => ({
    links: [
      { rel: "stylesheet", href: siteStylesHref },
      { rel: "icon", href: faviconHref, type: "image/svg+xml" },
    ],
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#f6f3e9" },
      { name: "color-scheme", content: "light" },
      { property: "og:site_name", content: "Drever" },
    ],
  }),
  shellComponent: RootDocument,
});

function RootComponent() {
  return <Outlet />;
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

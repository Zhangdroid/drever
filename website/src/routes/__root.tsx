import faviconHref from "@drever/brand/assets/favicon.svg";
import { HeadContent, Link, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { BrowserSupportGate, browserSupportCheckScript } from "../components/browser-support-gate";
import { SiteShell } from "../components/site-shell";
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
  notFoundComponent: NotFoundPage,
  shellComponent: RootDocument,
});

function RootComponent() {
  return (
    <SiteShell>
      <Outlet />
    </SiteShell>
  );
}

function NotFoundPage() {
  return (
    <main className="not-found" id="main" tabIndex={-1}>
      <span>404 / wrong room</span>
      <h1>This slide does not exist.</h1>
      <p>The story continues from the Drever home page.</p>
      <Link className="button button--primary" to="/">
        Return home
      </Link>
    </main>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html
      data-browser-missing="navigation document-view-transition element-view-transition broadcast-channel resize-observer"
      data-browser-support="checking"
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: browserSupportCheckScript }} />
      </head>
      <body>
        <BrowserSupportGate />
        <div className="site-application">{children}</div>
        <Scripts />
      </body>
    </html>
  );
}

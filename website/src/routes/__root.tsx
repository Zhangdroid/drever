import { HeadContent, Link, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import displayFontHref from "../../../packages/brand/fonts/BricolageGrotesque-Latin[opsz,wdth,wght].woff2?url";
import { BrowserSupportNotice } from "../components/browser-support-notice";
import { SiteShell } from "../components/site-shell";
import siteStylesHref from "../site.css?url";

export const Route = createRootRoute({
  component: RootComponent,
  head: () => ({
    links: [
      {
        rel: "preload",
        href: displayFontHref,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      { rel: "stylesheet", href: siteStylesHref },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "sitemap", href: "/sitemap.xml", type: "application/xml" },
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <BrowserSupportNotice />
        <div className="site-application">{children}</div>
        <Scripts />
      </body>
    </html>
  );
}

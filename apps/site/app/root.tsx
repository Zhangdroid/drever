import faviconHref from "@drever/brand/assets/favicon.svg";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, type LinksFunction } from "react-router";

import siteStylesHref from "./site.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: siteStylesHref },
  { rel: "icon", href: faviconHref, type: "image/svg+xml" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#F6F3E9" />
        <Meta />
        <Links />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  type ComponentType,
  type ReactNode,
} from "react";

import { documentationNavigation } from "../site-data";
import { ArrowUpRightIcon } from "./icons";
import { CodeBlock } from "./showcase";
import { SiteShell } from "./site-shell";

export function DocsShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigationRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      navigationRef.current
        ?.querySelector('[aria-current="page"]')
        ?.scrollIntoView({ block: "nearest", inline: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <SiteShell>
      <main className="docs" id="main">
        <aside className="docs-nav" ref={navigationRef}>
          <Link activeOptions={{ exact: true }} className="docs-nav__home" to="/docs">
            Documentation
          </Link>
          {documentationNavigation.map((section) => (
            <section key={section.label}>
              <h2>{section.label}</h2>
              <nav aria-label={`${section.label} documentation`}>
                {section.pages.map((page) => (
                  <Link
                    activeOptions={{ exact: true }}
                    activeProps={{ "aria-current": "page", className: "is-active" }}
                    key={page.href}
                    to={page.href}
                  >
                    {page.label}
                  </Link>
                ))}
              </nav>
            </section>
          ))}
          <a
            className="docs-nav__source"
            href="https://github.com/Zhangdroid/drever/tree/main/website/content/docs"
            rel="noreferrer"
            target="_blank"
          >
            Source on GitHub <ArrowUpRightIcon />
          </a>
        </aside>
        <div className="docs-content">
          <Outlet />
        </div>
      </main>
    </SiteShell>
  );
}

export function DocArticle({
  children,
  description,
  eyebrow,
  title,
}: {
  children: ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <article className="doc-article">
      <header className="doc-article__header">
        {eyebrow ? <span>{eyebrow}</span> : null}
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <div className="doc-prose">{children}</div>
    </article>
  );
}

export function DocCallout({
  children,
  title,
  tone = "note",
}: {
  children: ReactNode;
  title: string;
  tone?: "note" | "warning";
}) {
  return (
    <aside className="doc-callout" data-tone={tone}>
      <strong>{title}</strong>
      <div>{children}</div>
    </aside>
  );
}

export function DocNext({
  description,
  href,
  label,
}: {
  description: string;
  href:
    | "/docs/ai"
    | "/docs/authoring"
    | "/docs/configuration"
    | "/docs/delivery"
    | "/docs/getting-started"
    | "/docs/motion"
    | "/docs/plugins"
    | "/docs/presenting"
    | "/docs/themes";
  label: string;
}) {
  return (
    <Link className="doc-next" to={href}>
      <span>Next</span>
      <strong>{label}</strong>
      <p>{description}</p>
    </Link>
  );
}

function textContent(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") return String(child);
      if (!isValidElement(child)) return "";
      return textContent((child.props as { children?: ReactNode }).children);
    })
    .join("");
}

function MdxPre({ children }: { children?: ReactNode }) {
  const code = Children.toArray(children).find((child) => isValidElement(child));
  const className = isValidElement(code)
    ? ((code.props as { className?: string }).className ?? "")
    : "";
  const language = className.match(/language-([\w-]+)/u)?.[1];

  return <CodeBlock label={language ?? "Code"}>{textContent(children).trimEnd()}</CodeBlock>;
}

export function DocMdx({
  content: Content,
}: {
  content: ComponentType<{
    components?: Record<string, ComponentType<Record<string, unknown>>>;
  }>;
}) {
  return <Content components={{ pre: MdxPre as ComponentType<Record<string, unknown>> }} />;
}

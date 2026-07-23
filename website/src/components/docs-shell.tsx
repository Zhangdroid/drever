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
  const navigationRef = useRef<HTMLDivElement>(null);

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
        <aside className="docs-nav">
          <Link activeOptions={{ exact: true }} className="docs-nav__home" to="/docs">
            Documentation
          </Link>
          <div className="docs-nav__scroll" ref={navigationRef}>
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
          </div>
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
  compact = false,
  description,
  eyebrow,
  title,
  wide = false,
}: {
  children: ReactNode;
  compact?: boolean;
  description: string;
  eyebrow?: string;
  title: string;
  wide?: boolean;
}) {
  const className = [
    "doc-article",
    wide ? "doc-article--wide" : "",
    compact ? "doc-article--compact" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={className}>
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

export function ManualSetup() {
  return (
    <details className="manual-setup">
      <summary>
        <strong>Set up manually</strong>
        <span>For people who prefer to control every command.</span>
      </summary>
      <div>
        <h2 id="requirements">Requirements</h2>
        <p>Drever targets current tools on purpose:</p>
        <ul>
          <li>Node.js 24.18 or newer.</li>
          <li>A current Chromium-family browser.</li>
          <li>Playwright Chromium only when exporting PDF.</li>
        </ul>
        <p>
          There is no legacy router or animation fallback. Drever respects{" "}
          <code>prefers-reduced-motion</code> while keeping the same presentation-state model.
        </p>

        <h2 id="create-a-project">Create a project</h2>
        <CodeBlock label="Shell">{`npm create drever@latest my-slides
cd my-slides
npm run dev`}</CodeBlock>
        <p>
          The creator writes <code>brief.md</code>, <code>slides.mdx</code>, package scripts, and
          project-local skills for Codex and Claude Code.
        </p>

        <h2 id="inspect-and-deliver">Inspect and deliver</h2>
        <CodeBlock label="Shell">{`npm run check
npm run build
npx playwright install chromium
npm run export`}</CodeBlock>
        <p>
          Install Playwright Chromium only when a PDF is required. Read the{" "}
          <Link to="/docs/authoring">authoring guide</Link> for MDX and the{" "}
          <Link to="/docs/delivery">delivery guide</Link> for build and export behavior.
        </p>
      </div>
    </details>
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
    | "/docs/credits"
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
  return (
    <div className="doc-mdx">
      <Content components={{ pre: MdxPre as ComponentType<Record<string, unknown>> }} />
    </div>
  );
}

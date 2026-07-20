import { type MetaFunction } from "react-router";

import { AppearanceControl, SiteHeader } from "../components.tsx";

export const meta: MetaFunction = () => [
  { title: "Introduction — Drever Docs" },
  {
    name: "description",
    content: "Build your first deliverable, testable Drever presentation.",
  },
];

const docsSections = [
  {
    label: "Start",
    pages: ["Introduction", "Quick start", "Your first deck"],
  },
  {
    label: "Author",
    pages: ["Why MDX", "MDX grammar", "Steps & motion", "Layouts & themes"],
  },
  {
    label: "Deliver",
    pages: ["Present", "Document view", "Build & export"],
  },
  {
    label: "AI-first",
    pages: ["Agent kit", "Authoring context", "MCP"],
  },
] as const;

export default function DocsPage() {
  return (
    <div className="docs-shell">
      <SiteHeader docs />
      <div className="docs-mobile-nav">Docs / Introduction</div>
      <div className="docs-layout">
        <aside className="docs-sidebar" aria-label="Documentation navigation">
          <nav>
            {docsSections.map((section) => (
              <section key={section.label}>
                <h2>{section.label}</h2>
                {section.pages.map((page) => (
                  <a
                    className={page === "Introduction" ? "is-active" : undefined}
                    href={
                      page === "Introduction"
                        ? "#introduction"
                        : page === "Why MDX"
                          ? "#why-mdx"
                          : "#"
                    }
                    key={page}
                  >
                    {page}
                  </a>
                ))}
              </section>
            ))}
          </nav>
          <AppearanceControl compact />
        </aside>

        <main className="docs-content" id="main-content">
          <div className="docs-content__meta">
            <span>START / 01</span>
            <span>FOUNDATION</span>
          </div>
          <article className="docs-article" id="introduction">
            <h1>Build presentations like products.</h1>
            <p className="docs-lead">
              Drever turns MDX and React into interactive stories you can present, inspect, test,
              deploy, and export.
            </p>

            <div className="docs-callout">
              <span>THE CONTRACT</span>
              <p>AI expresses narrative intent. Drever constrains and validates the result.</p>
            </div>

            <h2 id="one-file">Start with one file</h2>
            <p>
              Create <code>slides.mdx</code>. Slides are separated by a deliberate horizontal
              boundary; steps reveal only what changes.
            </p>

            <div className="docs-code">
              <div className="docs-code__header">
                <span>slides.mdx</span>
                <button type="button">Copy</button>
              </div>
              <pre>
                <code>{`# A presentation is a sequence of states\n\nNot a pile of pages.\n\n---\n\n## Reveal only what matters\n\n<Step>First decision</Step>\n<Step>Second decision</Step>`}</code>
              </pre>
            </div>

            <h2 id="why-mdx">Why MDX</h2>
            <p>
              Drever is AI-first, but AI-first does not mean unconstrained. If every slide starts as
              arbitrary React or HTML, the model must reinvent structure, styling, state, and
              accessibility every time. MDX keeps the narrative concise while giving Drever a stable
              structure it can inspect before the deck runs.
            </p>

            <div className="docs-source-layers" role="list" aria-label="Drever authoring layers">
              <article className="docs-source-layer docs-source-layer--primary" role="listitem">
                <span>DEFAULT</span>
                <h3>MDX carries the story.</h3>
                <p>
                  Headings, lists, media, slides, steps, and notes stay readable, diffable, and
                  statically testable.
                </p>
              </article>
              <article className="docs-source-layer" role="listitem">
                <span>ESCAPE HATCH</span>
                <h3>React carries interaction.</h3>
                <p>
                  Import a focused component when a scene genuinely needs state, data, or custom
                  behavior.
                </p>
              </article>
              <article className="docs-source-layer" role="listitem">
                <span>DELIVERY</span>
                <h3>HTML carries the result.</h3>
                <p>
                  The built deck is still a portable browser application ready to deploy, archive,
                  or export.
                </p>
              </article>
            </div>

            <div className="docs-callout docs-callout--decision">
              <span>THE DECISION</span>
              <p>MDX-first, not MDX-only.</p>
            </div>
            <p>
              This division keeps ordinary slides simple and makes exceptional slides possible. It
              also lets Drever determine slide boundaries, reveal stops, speaker notes, and source
              diagnostics without executing arbitrary presentation code.
            </p>

            <h2 id="run-it">Run it</h2>
            <p>Development, validation, and delivery use the same public CLI.</p>
            <div className="docs-command">
              <code>drever dev</code>
              <span>→ localhost</span>
            </div>
            <div className="docs-command">
              <code>drever check</code>
              <span>→ source evidence</span>
            </div>
            <div className="docs-command">
              <code>drever build</code>
              <span>→ static artifact</span>
            </div>

            <div className="docs-next">
              <span>NEXT</span>
              <a href="#one-file">
                Quick start <span aria-hidden="true">→</span>
              </a>
            </div>
          </article>
        </main>

        <aside className="docs-toc" aria-label="On this page">
          <span>On this page</span>
          <a className="is-active" href="#introduction">
            Introduction
          </a>
          <a href="#one-file">Start with one file</a>
          <a href="#why-mdx">Why MDX</a>
          <a href="#run-it">Run it</a>
          <div className="docs-toc__agent">
            <span>FOR AGENTS</span>
            <a href="#">Copy Markdown</a>
            <a href="#">Open context</a>
          </div>
        </aside>
      </div>
    </div>
  );
}

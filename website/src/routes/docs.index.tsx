import { Link, createFileRoute } from "@tanstack/react-router";

import { ArrowIcon } from "../components/icons";
import { pageHead } from "../seo";

const description =
  "Learn how to create, direct, and deliver expressive Drever presentations with people and AI.";

export const Route = createFileRoute("/docs/")({
  component: DocsOverview,
  head: () => pageHead("Documentation", description, "/docs"),
});

function DocsOverview() {
  return (
    <article className="docs-overview">
      <header>
        <span>Documentation</span>
        <h1>From an idea to a presentation you can keep.</h1>
        <p>{description}</p>
      </header>

      <section className="docs-overview__start">
        <div>
          <span>Start here</span>
          <h2>Create a complete project in one command.</h2>
          <p>
            Begin with a brief and readable MDX. Drever installs the project, theme, checks, and
            local AI workflows together.
          </p>
          <Link className="button button--primary" to="/docs/getting-started">
            Getting started <ArrowIcon />
          </Link>
        </div>
        <pre>
          <code>{`npm create drever@latest my-slides
cd my-slides
npm run dev`}</code>
        </pre>
      </section>

      <section className="docs-overview__paths">
        <Link to="/docs/authoring">
          <span>01 · Create</span>
          <h2>Author readable slides</h2>
          <p>MDX, slide boundaries, Step state, Notes, and React components.</p>
          <ArrowIcon />
        </Link>
        <Link to="/docs/motion">
          <span>02 · Direct</span>
          <h2>Move with purpose</h2>
          <p>Five semantic intents, stable geometry, and theme-owned choreography.</p>
          <ArrowIcon />
        </Link>
        <Link to="/docs/presenting">
          <span>03 · Present</span>
          <h2>Run the room</h2>
          <p>Speaker context, exact URLs, focus tools, and a searchable document.</p>
          <ArrowIcon />
        </Link>
        <Link to="/docs/delivery">
          <span>04 · Deliver</span>
          <h2>Ship what you reviewed</h2>
          <p>Source preflight, static hosting, deterministic states, and PDF export.</p>
          <ArrowIcon />
        </Link>
      </section>

      <section className="docs-overview__ai">
        <span>Working with AI</span>
        <h2>The agent receives a contract, not a giant prompt.</h2>
        <p>
          Versioned project skills, exact source context, stable JSON diagnostics, and optional
          read-only MCP keep every change visible in normal files and Git.
        </p>
        <Link className="text-link" to="/docs/ai">
          Explore AI workflows <ArrowIcon />
        </Link>
      </section>
    </article>
  );
}

import { Link, createFileRoute } from "@tanstack/react-router";

import { AIHandoff } from "../components/ai-handoff";
import { DocsCapabilityGallery } from "../components/doc-showcase";
import { ArrowIcon } from "../components/icons";
import { pageHead } from "../seo";

const description =
  "Open real examples of motion, art direction, plugins, and presentation surfaces. Read the detailed contract when you need it.";

export const Route = createFileRoute("/docs/")({
  component: DocsOverview,
  head: () => pageHead("Documentation", description, "/docs"),
});

function DocsOverview() {
  return (
    <article className="docs-overview">
      <header>
        <span>Documentation</span>
        <h1>See it before you study it.</h1>
        <p>{description}</p>
      </header>

      <DocsCapabilityGallery />

      <section className="docs-overview__start">
        <div>
          <span>Start with AI</span>
          <h2>Tell your agent what the presentation must achieve.</h2>
          <p>
            One handoff gives Codex or Claude Code the setup instructions and a clear definition of
            done. The generated project supplies the version-matched contract.
          </p>
          <Link className="button button--primary" to="/docs/getting-started/">
            See the one-step workflow <ArrowIcon />
          </Link>
        </div>
        <AIHandoff placeholder="Help a group compare its options and agree on what to do next." />
      </section>

      <header className="docs-overview__reference">
        <span>Reference</span>
        <h2>Use the guide when you need the contract.</h2>
        <p>The detailed paths stay available for people and agents who need precise behavior.</p>
      </header>

      <section className="docs-overview__paths">
        <Link to="/docs/authoring/">
          <span>01 · Create</span>
          <h2>Author readable slides</h2>
          <p>MDX, slide boundaries, Step state, Notes, and React components.</p>
          <ArrowIcon />
        </Link>
        <Link to="/docs/motion/">
          <span>02 · Direct</span>
          <h2>Move with purpose</h2>
          <p>Five semantic intents, stable geometry, and theme-owned choreography.</p>
          <ArrowIcon />
        </Link>
        <Link to="/docs/presenting/">
          <span>03 · Present</span>
          <h2>Run the room</h2>
          <p>Speaker context, exact URLs, focus tools, and a searchable document.</p>
          <ArrowIcon />
        </Link>
        <Link to="/docs/delivery/">
          <span>04 · Deliver</span>
          <h2>Ship what you reviewed</h2>
          <p>Source preflight, static hosting, deterministic states, and PDF export.</p>
          <ArrowIcon />
        </Link>
      </section>

      <section className="docs-overview__ai" data-header-tone="dark">
        <span>Working with AI</span>
        <h2>One prompt starts the work. Project-local skills carry the contract.</h2>
        <p>
          Versioned project skills, exact source context, stable JSON diagnostics, and optional
          read-only MCP keep every change visible in normal files and Git.
        </p>
        <Link className="text-link" to="/docs/ai/">
          Explore AI workflows <ArrowIcon />
        </Link>
      </section>
    </article>
  );
}

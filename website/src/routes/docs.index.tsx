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
          <h2 className="docs-overview__start-heading">
            <span>Tell your agent</span>
            <span>what the presentation</span>
            <span>must achieve.</span>
          </h2>
          <p>
            One handoff creates the project, then opens a local room for topic-specific questions,
            visual Storyboard approval, and feedback on the live draft.
          </p>
          <Link className="button button--primary" to="/docs/getting-started/">
            See the one-step workflow <ArrowIcon />
          </Link>
        </div>
        <AIHandoff />
      </section>

      <header className="docs-overview__reference">
        <span>Guides</span>
        <h2>Follow the work from source to delivery.</h2>
        <p>Read only the part of the workflow you need now.</p>
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

      <header className="docs-overview__reference docs-overview__reference--tools">
        <span>Reference</span>
        <h2>Look up the exact contract.</h2>
        <p>Commands and configuration stay complete, precise, and easy to scan.</p>
      </header>

      <section className="docs-overview__paths docs-overview__paths--compact">
        <Link to="/docs/commands/">
          <span>Commands</span>
          <h2>Find every command</h2>
          <p>
            Exact syntax, options, defaults, caveats, and links to the guide that owns each task.
          </p>
          <ArrowIcon />
        </Link>
        <Link to="/docs/configuration/">
          <span>Configuration</span>
          <h2>Control the project</h2>
          <p>Entry, canvas, Theme, server, build, rehearsal, focus tools, Stage, and plugins.</p>
          <ArrowIcon />
        </Link>
      </section>

      <section className="docs-overview__ai" data-header-tone="dark">
        <span>Working with AI</span>
        <h2 className="docs-overview__ai-heading">
          <span>One prompt starts the work.</span>
          <span>Project-local skills carry the contract.</span>
        </h2>
        <p>
          A provider-neutral local creation room, versioned project skills, exact source context,
          and stable rendered diagnostics keep every change visible in normal files and Git.
        </p>
        <Link className="text-link" to="/docs/ai/">
          Explore AI workflows <ArrowIcon />
        </Link>
      </section>
    </article>
  );
}

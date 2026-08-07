import { Link, createFileRoute } from "@tanstack/react-router";

import { AIHandoff } from "../components/ai-handoff";
import { DocsCapabilityGallery } from "../components/doc-showcase";
import { ArrowIcon } from "../components/icons";
import { pageHead } from "../seo";

const description =
  "Start in Studio, approve the content Storyboard, direct the live draft, and review every exact state before delivery.";

export const Route = createFileRoute("/docs/")({
  component: DocsOverview,
  head: () => pageHead("Documentation", description, "/docs"),
});

function DocsOverview() {
  return (
    <article className="docs-overview">
      <header>
        <span>Documentation</span>
        <h1>Start with the work.</h1>
        <p>{description}</p>
      </header>

      <section className="docs-overview__start">
        <div>
          <span>One handoff</span>
          <h2 className="docs-overview__start-heading">
            <span>Give your agent the job.</span>
            <span>Direct the result in Studio.</span>
          </h2>
          <p>
            Start with one sentence. Studio keeps adaptive questions, content Storyboard approval,
            live agent activity, and slide- or deck-scoped feedback in one local room.
          </p>
          <Link className="button button--primary" to="/docs/getting-started/">
            Start with one sentence <ArrowIcon />
          </Link>
        </div>
        <AIHandoff />
      </section>

      <DocsCapabilityGallery />

      <header className="docs-overview__reference">
        <span>Guides</span>
        <h2>Follow the work from source to delivery.</h2>
        <p>Read only the part of the workflow you need now.</p>
      </header>

      <ol className="docs-overview__workflow" aria-label="Guide workflow">
        <li>
          <Link to="/docs/studio/">
            <span className="docs-overview__workflow-index" aria-hidden="true">
              01
            </span>
            <span className="docs-overview__workflow-heading">
              <small>Direct</small>
              <strong>Work beside your agent</strong>
            </span>
            <p>Adaptive questions, Storyboard approval, public activity, and live feedback.</p>
            <ArrowIcon />
          </Link>
        </li>
        <li>
          <Link to="/docs/authoring/">
            <span className="docs-overview__workflow-index" aria-hidden="true">
              02
            </span>
            <span className="docs-overview__workflow-heading">
              <small>Create</small>
              <strong>Author readable slides</strong>
            </span>
            <p>MDX, slide boundaries, Step state, Notes, and React components.</p>
            <ArrowIcon />
          </Link>
        </li>
        <li>
          <Link to="/docs/review/">
            <span className="docs-overview__workflow-index" aria-hidden="true">
              03
            </span>
            <span className="docs-overview__workflow-heading">
              <small>Review</small>
              <strong>Check every exact state</strong>
            </span>
            <p>Stable diagnostics, rendered evidence, and the limits that still need judgment.</p>
            <ArrowIcon />
          </Link>
        </li>
        <li>
          <Link to="/docs/delivery/">
            <span className="docs-overview__workflow-index" aria-hidden="true">
              04
            </span>
            <span className="docs-overview__workflow-heading">
              <small>Deliver</small>
              <strong>Ship what you reviewed</strong>
            </span>
            <p>Static hosting, deterministic routes, and exact PDF slide or Step states.</p>
            <ArrowIcon />
          </Link>
        </li>
      </ol>

      <header className="docs-overview__reference docs-overview__reference--tools">
        <span>Reference</span>
        <h2>Look up the exact contract.</h2>
        <p>Commands and configuration stay complete, precise, and easy to scan.</p>
      </header>

      <nav className="docs-overview__reference-list" aria-label="Documentation reference">
        <Link to="/docs/commands/">
          <span>
            <small>Commands</small>
            <strong>Find every command</strong>
          </span>
          <p>
            Exact syntax, options, defaults, caveats, and links to the guide that owns each task.
          </p>
          <ArrowIcon />
        </Link>
        <Link to="/docs/configuration/">
          <span>
            <small>Configuration</small>
            <strong>Control the project</strong>
          </span>
          <p>Entry, canvas, Theme, server, build, rehearsal, focus tools, Stage, and plugins.</p>
          <ArrowIcon />
        </Link>
      </nav>

      <section className="docs-overview__ai" data-header-tone="dark">
        <span>Bring the agent you already use</span>
        <h2 className="docs-overview__ai-heading">
          <span>Studio coordinates the work.</span>
          <span>Ordinary files remain the contract.</span>
        </h2>
        <p>
          Native Codex and Claude Code transports, an ACP adapter, and a portable journal bridge
          meet different agents at one bounded local interface. MDX, configuration, assets, and Git
          stay authoritative.
        </p>
        <Link className="text-link" to="/docs/ai/">
          Explore agent workflows <ArrowIcon />
        </Link>
      </section>
    </article>
  );
}

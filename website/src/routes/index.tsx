import { Link, createFileRoute } from "@tanstack/react-router";

import { ArrowIcon, ArrowUpRightIcon, PlayIcon } from "../components/icons";
import { SiteShell } from "../components/site-shell";
import { CopyCommand, HeroStage, ThemePreview } from "../components/showcase";
import { demos, themes } from "../site-data";

const title = "Drever — Slides that move with your ideas";
const description =
  "Create clear, expressive slides with your AI agent. Present live, share on the web, or deliver a PDF from one editable source.";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    links: [{ rel: "canonical", href: "https://drever.dev/" }],
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://drever.dev/" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
  }),
});

function HomePage() {
  return (
    <SiteShell>
      <main id="main">
        <section className="home-hero">
          <div className="home-hero__copy">
            <h1>
              Slides that <span>move</span>
              <br />
              with your ideas.
            </h1>
            <p>
              Start with a brief. Use the AI you already trust to shape a clear story. Present it
              live, share it on the web, or deliver a PDF—from one editable source.
            </p>
            <div className="home-hero__actions">
              <Link className="button button--primary" to="/docs/getting-started">
                Create your first slides <ArrowIcon />
              </Link>
              <a className="button button--quiet" href="/demos/product/">
                <PlayIcon /> Watch the product tour
              </a>
            </div>
            <CopyCommand command="npm create drever@latest my-slides" />
          </div>

          <div className="home-hero__visual">
            <HeroStage />
          </div>
        </section>

        <section className="home-contract" aria-label="Drever product contract">
          <div>
            <span>01</span>
            <strong>Readable to begin with.</strong>
            <p>
              Write the story in plain language. Add interaction only when it helps the audience.
            </p>
          </div>
          <div>
            <span>02</span>
            <strong>Alive in the room.</strong>
            <p>Reveal, respond, annotate, and return to any exact presentation state.</p>
          </div>
          <div>
            <span>03</span>
            <strong>Useful after the room.</strong>
            <p>
              The same story becomes a live presentation, searchable document, website, and PDF.
            </p>
          </div>
        </section>

        <section className="home-story">
          <header className="home-story__heading">
            <span>A presentation is a conversation</span>
            <h2>A good slide knows what the room needs next.</h2>
            <p>
              Each meaningful reveal has a real place in the story—not just a timer. Pause, revisit,
              or share the exact moment without losing your place.
            </p>
          </header>

          <div className="home-story__sequence">
            <article>
              <span>Ask</span>
              <div>
                <strong>What would help you decide?</strong>
                <p>Follow the concern the room chooses.</p>
              </div>
              <small>Interactive</small>
            </article>
            <article>
              <span>Reveal</span>
              <div>
                <strong>96% completed setup unaided.</strong>
                <p>Bring in evidence when it can change the decision.</p>
              </div>
              <small>Step / 02</small>
            </article>
            <article>
              <span>Return</span>
              <div>
                <strong>The exact moment has a URL.</strong>
                <p>Share it, revisit it, or open it in Document View.</p>
              </div>
              <small>/4/2</small>
            </article>
          </div>
        </section>

        <section className="home-source">
          <div className="home-source__copy">
            <span>One story, made once</span>
            <h2>Write clearly. Keep everything else connected.</h2>
            <p>
              Your content, interactions, speaker notes, theme, and motion live together. AI can
              work with the source because a person can read it too.
            </p>
            <Link className="text-link" to="/docs/authoring">
              Why Drever uses MDX <ArrowIcon />
            </Link>
          </div>

          <div className="home-source__artifact">
            <div className="home-source__code">
              <span>slides.mdx</span>
              <pre>
                <code>{`# Make the decision clear.

What does the room need next?

<Step>Reveal the evidence.</Step>

<Note>Pause before the result.</Note>`}</code>
              </pre>
            </div>
            <div className="home-source__surfaces">
              <div>
                <span>Audience</span>
                <strong>Live and interactive</strong>
              </div>
              <div>
                <span>Speaker</span>
                <strong>Notes and timing</strong>
              </div>
              <div>
                <span>Document</span>
                <strong>Readable and searchable</strong>
              </div>
              <div>
                <span>Delivery</span>
                <strong>Static site and PDF</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="home-demos">
          <header className="section-heading">
            <div>
              <span>Built with Drever</span>
              <h2>See the product, not a mockup.</h2>
            </div>
            <Link className="text-link" to="/demos">
              All demos <ArrowIcon />
            </Link>
          </header>

          <div className="demo-grid">
            {demos.slice(0, 3).map((demo, index) => (
              <a className="demo-card" data-demo={demo.id} href={demo.href} key={demo.id}>
                <div className="demo-card__visual">
                  <span>0{index + 1}</span>
                  <strong>{demo.label}</strong>
                  <i />
                </div>
                <div className="demo-card__copy">
                  <div>
                    <span>{demo.meta}</span>
                    <h3>{demo.label}</h3>
                    <p>{demo.description}</p>
                  </div>
                  <ArrowUpRightIcon />
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className="home-themes">
          <header className="section-heading">
            <div>
              <span>Visual voices</span>
              <h2>Choose a point of view, not a coat of paint.</h2>
            </div>
            <Link className="text-link" to="/themes">
              Explore themes <ArrowIcon />
            </Link>
          </header>

          <div className="theme-strip">
            {themes.map((theme) => (
              <Link className="theme-card" hash={theme.id} key={theme.id} to="/themes">
                <ThemePreview theme={theme.id} />
                <div>
                  <span>{theme.voice}</span>
                  <h3>{theme.label}</h3>
                  <p>{theme.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="home-ai">
          <div className="home-ai__copy">
            <span>AI-ready from the first file</span>
            <h2>Start with the outcome, not the commands.</h2>
            <p>
              Every new project includes working instructions for Codex and Claude Code. Ask for a
              presentation in plain language; Drever gives the agent the structure and checks to
              deliver it.
            </p>
            <Link className="button button--light" to="/docs/ai">
              Explore AI workflows <ArrowIcon />
            </Link>
          </div>
          <blockquote>
            <span>You</span>
            <p>
              Turn <code>brief.md</code> into a clear 10-minute presentation. Inspect every reveal,
              then deliver the website and PDF.
            </p>
          </blockquote>
        </section>
      </main>
    </SiteShell>
  );
}

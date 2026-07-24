import { Link, createFileRoute } from "@tanstack/react-router";

import { AIHandoff, CopyAIHandoff } from "../components/ai-handoff";
import { CopyButton } from "../components/copy-button";
import { ConnectedSourceDemo, RoomMomentDemo } from "../components/home-demos";
import { ArrowIcon, ArrowUpRightIcon, PlayIcon } from "../components/icons";
import { HeroStage, HomeShowcaseCover, ThemePreview } from "../components/showcase";
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
  const story = demos.find((demo) => demo.id === "product");
  const motion = demos.find((demo) => demo.id === "motion");
  const direction = themes.find((theme) => theme.id === "fieldnote");

  if (story === undefined || motion === undefined || direction === undefined) {
    throw new Error("The home showcase requires a story, motion study, and art direction.");
  }

  return (
    <main id="main" tabIndex={-1}>
      <section className="home-hero">
        <div className="home-hero__copy">
          <h1>
            Slides that <span>move</span>
            <br />
            with your ideas.
          </h1>
          <p>
            Tell your AI what the room should understand. Drever shapes the story, design, and
            motion—ready for the room, web, or PDF.
          </p>
          <div className="home-hero__actions">
            <CopyAIHandoff className="button button--primary" />
            <a className="button home-hero__demo" href="/demos/product/">
              <PlayIcon /> Try the live demo
            </a>
          </div>
          <div aria-label="More ways to get started" className="home-hero__secondary">
            <Link className="home-hero__manual" to="/docs/getting-started">
              How AI creation works <ArrowIcon />
            </Link>
            <div className="home-hero__manual-setup">
              <span>Manual setup</span>
              <CopyButton
                className="home-hero__command"
                copiedText="Command copied"
                idleText="npm create drever@latest"
                label="setup command"
                value="npm create drever@latest my-slides"
              />
            </div>
          </div>
        </div>

        <div className="home-hero__visual">
          <HeroStage />
        </div>
      </section>

      <section className="home-contract" aria-label="Drever product contract">
        <div>
          <span>01</span>
          <strong>Designed from the subject.</strong>
          <p>
            Topic, audience, and real visual references shape the type, color, motif, and motion.
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
          <p>The same story becomes a live presentation, searchable document, website, and PDF.</p>
        </div>
      </section>

      <section className="home-story" data-header-tone="dark">
        <header className="home-story__heading">
          <span>A presentation is a conversation</span>
          <h2>A good slide knows what the room needs next.</h2>
          <p>
            Each meaningful reveal has a real place in the story—not just a timer. Pause, revisit,
            or share the exact moment without losing your place.
          </p>
        </header>

        <RoomMomentDemo />
      </section>

      <section className="home-source">
        <div className="home-source__copy">
          <span>One story, made once</span>
          <h2>Write clearly. Keep everything else connected.</h2>
          <p>
            Your content, interactions, speaker notes, theme, and motion live together. AI can work
            with the source because a person can read it too.
          </p>
          <Link className="text-link" to="/docs/authoring">
            Why Drever uses MDX <ArrowIcon />
          </Link>
        </div>

        <ConnectedSourceDemo />
      </section>

      <section className="home-showcase">
        <header className="section-heading">
          <div>
            <span>Story · capability · art direction</span>
            <h2>See what Drever can make.</h2>
          </div>
          <Link className="text-link" to="/showcase">
            Explore the showcase <ArrowIcon />
          </Link>
        </header>

        <div className="demo-grid">
          {[story, motion].map((demo) => (
            <a className="demo-card" data-demo={demo.id} href={demo.href} key={demo.id}>
              <div className="demo-card__visual demo-card__visual--rich">
                <HomeShowcaseCover kind={demo.id === "product" ? "product" : "motion"} />
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

          <Link className="theme-card home-showcase__direction" hash={direction.id} to="/showcase">
            <ThemePreview theme={direction.id} />
            <div>
              <span>Art direction · {direction.voice}</span>
              <h3>{direction.label}</h3>
              <p>{direction.description}</p>
            </div>
          </Link>
        </div>
      </section>

      <section className="home-ai" data-header-tone="dark">
        <div className="home-ai__copy">
          <span>One brief · a complete handoff</span>
          <h2>Tell AI what the room should change.</h2>
          <p>
            The public prompt handles setup. Version-matched project skills shape the story, derive
            a visual language from the subject, and check the finished deck.
          </p>
          <Link className="button button--light" to="/docs/ai">
            Explore AI workflows <ArrowIcon />
          </Link>
        </div>
        <AIHandoff defaultBrief="A 10-minute React 19 update for frontend teams. Draw its visual language from current official React sources, then deliver a live deck and PDF." />
      </section>
    </main>
  );
}

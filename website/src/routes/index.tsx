import { useState, type AnimationEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";

import { AIHandoff, CopyAIHandoff } from "../components/ai-handoff";
import { CopyButton } from "../components/copy-button";
import { ConnectedSourceDemo, RoomMomentDemo } from "../components/home-demos";
import { ArrowIcon, ArrowUpRightIcon, PlayIcon } from "../components/icons";
import { HeroStage, HomeShowcaseCover } from "../components/showcase";
import { StudyCover } from "../components/showcase-covers";
import { demos } from "../site-data";
import { pageHead } from "../seo";

const description =
  "An open-source presentation framework for creating expressive, interactive slides with AI, then presenting live, publishing to the web, or exporting PDF.";

type HomeDemo = (typeof demos)[number];

function HomeDemoCard({ demo }: { demo: HomeDemo }) {
  const [motionCycleRunning, setMotionCycleRunning] = useState(false);

  const startMotionCycle = () => {
    if (demo.id !== "motion" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    setMotionCycleRunning(true);
  };

  const finishMotionCycle = (event: AnimationEvent<HTMLAnchorElement>) => {
    if (event.animationName === "home-motion-lifecycle") {
      setMotionCycleRunning(false);
    }
  };

  return (
    <a
      className="demo-card"
      data-demo={demo.id}
      data-motion-cycle={motionCycleRunning ? "running" : undefined}
      href={demo.href}
      onAnimationEnd={finishMotionCycle}
      onFocus={startMotionCycle}
      onPointerEnter={startMotionCycle}
    >
      <div className="demo-card__visual demo-card__visual--rich">
        {demo.id === "architecture" ? (
          <StudyCover study="architecture" />
        ) : (
          <HomeShowcaseCover kind={demo.id === "product" ? "product" : "motion"} />
        )}
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
  );
}

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => {
    const head = pageHead("Drever", description, "/");
    return {
      ...head,
      scripts: [
        {
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Drever",
            url: "https://drever.dev/",
          }),
          type: "application/ld+json",
        },
      ],
    };
  },
});

function HomePage() {
  const story = demos.find((demo) => demo.id === "product");
  const motion = demos.find((demo) => demo.id === "motion");
  const architecture = demos.find((demo) => demo.id === "architecture");

  if (story === undefined || motion === undefined || architecture === undefined) {
    throw new Error("The home showcase requires product, motion, and architecture demos.");
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
          <p className="home-hero__lede">
            Create expressive presentations with AI, refine every detail, and respond to the room
            live.
          </p>
          <div className="home-hero__actions">
            <div className="home-hero__prompt">
              <CopyAIHandoff className="button button--primary" describedBy="home-prompt-tooltip" />
              <span id="home-prompt-tooltip" role="tooltip">
                Paste into Codex or Claude Code—the agent handles setup and opens a local preview.
              </span>
            </div>
            <a className="button home-hero__demo" href="/showcase/product/">
              <PlayIcon /> Try the live demo
            </a>
          </div>
          <div aria-label="More ways to get started" className="home-hero__secondary">
            <Link className="home-hero__manual" to="/docs/getting-started/">
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
          <p className="home-hero__requirements">
            Requires Node.js 24.18+ and a current Safari or Chromium-family browser.
          </p>
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
          <h2 className="home-source__title">
            <span className="home-source__title-line">Write clearly.</span>
            <span className="home-source__title-line">Keep everything else</span>
            <span className="home-source__title-accent">connected.</span>
          </h2>
          <p>
            Your content, interactions, speaker notes, theme, and motion live together. AI can work
            with the source because a person can read it too.
          </p>
          <Link className="text-link" to="/docs/authoring/">
            Why Drever uses MDX <ArrowIcon />
          </Link>
        </div>

        <ConnectedSourceDemo />
      </section>

      <section className="home-showcase">
        <header className="section-heading">
          <div>
            <span>Story · motion · architecture</span>
            <h2>See what Drever can make.</h2>
          </div>
          <Link className="button button--primary" to="/showcase/">
            Explore all showcases <ArrowIcon />
          </Link>
        </header>

        <div className="demo-grid">
          {[story, motion, architecture].map((demo) => (
            <HomeDemoCard demo={demo} key={demo.id} />
          ))}
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
          <Link className="button button--light" to="/docs/ai/">
            Explore AI workflows <ArrowIcon />
          </Link>
        </div>
        <AIHandoff />
      </section>
    </main>
  );
}

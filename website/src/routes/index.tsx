import { useState, type AnimationEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";

import { AIHandoff, CopyAIHandoff } from "../components/ai-handoff";
import { CopyButton } from "../components/copy-button";
import { CreationJourney } from "../components/creation-journey";
import { creationStory } from "../components/creation-story-data";
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
            <span className="home-hero__line">Slides that</span>
            <span className="home-hero__line">
              <span className="home-hero__highlight">move</span>
            </span>
            <span className="home-hero__line">
              with your <span className="home-hero__mobile-line">ideas.</span>
            </span>
          </h1>
          <p className="home-hero__lede">
            Create expressive presentations with AI, refine every detail, and respond to the room
            live.
          </p>
          <div className="home-hero__actions">
            <div className="home-hero__prompt">
              <CopyAIHandoff className="button button--primary" describedBy="home-prompt-tooltip" />
              <span id="home-prompt-tooltip" role="tooltip">
                The agent handles setup, pauses for plan approval, then opens a local preview.
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

      <CreationJourney />

      <section className="home-showcase">
        <header className="section-heading">
          <div>
            <span>Finished stories · live in the browser</span>
            <h2>One workflow. Many visual directions.</h2>
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

      <section className="home-finale" data-header-tone="dark">
        <div className="home-finale__content">
          <div className="home-finale__copy">
            <span>Your presentation starts the same way</span>
            <h2>Begin with what the room should change.</h2>
            <p>
              Bring one outcome. Drever and your agent can turn it into a story, a visual language,
              a live room, and every useful surface after it.
            </p>
            <Link className="text-link text-link--light" to="/docs/getting-started/">
              Follow the creation workflow <ArrowIcon />
            </Link>
          </div>

          <AIHandoff
            heading="What should this presentation help the room decide?"
            placeholder={creationStory.brief}
          />
        </div>
      </section>
    </main>
  );
}

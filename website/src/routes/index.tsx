import { useState, type AnimationEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";

import { AIHandoff, CopyAIHandoff } from "../components/ai-handoff";
import { CopyButton } from "../components/copy-button";
import { CreationStoryMap, StoryDirectionDemo } from "../components/creation-story";
import { creationStory } from "../components/creation-story-data";
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

      <CreationStoryMap />

      <div className="home-creation-sequence">
        <section className="home-ai home-ai--brief" data-header-tone="dark">
          <div className="home-ai__copy">
            <span>01 · Begin with the change</span>
            <h2>A presentation starts with one clear outcome.</h2>
            <p>
              Tell your agent what the room should understand, decide, or do. It asks only for the
              missing context that would materially improve the result.
            </p>
            <Link className="button button--light" to="/docs/ai/">
              See how AI creation works <ArrowIcon />
            </Link>
          </div>
          <AIHandoff
            heading="What should this presentation help the room decide?"
            placeholder={creationStory.brief}
          />
        </section>

        <section className="home-shape">
          <div className="home-shape__copy">
            <span>02 · Give the idea a visual language</span>
            <h2>The subject decides how the story should feel.</h2>
            <p>
              Audience, evidence, and purpose become a visual premise, a recurring motif, and a few
              meaningful moments—not a random attractive theme.
            </p>
            <Link className="text-link" to="/docs/themes/">
              Explore art direction <ArrowIcon />
            </Link>
          </div>
          <StoryDirectionDemo />
        </section>

        <section className="home-story" data-header-tone="dark">
          <header className="home-story__heading">
            <span>03 · Let the room shape the story</span>
            <h2>A good slide knows what the room needs next.</h2>
            <p>
              The team asks for proof, so the next Step reveals proof. That moment can be paused,
              revisited, or shared without losing its place.
            </p>
          </header>

          <RoomMomentDemo />
        </section>

        <section className="home-source">
          <div className="home-source__copy">
            <span>04 · Keep the moment useful</span>
            <h2 className="home-source__title">
              <span className="home-source__title-line">One exact moment.</span>
              <span className="home-source__title-line">Every useful</span>
              <span className="home-source__title-accent">surface.</span>
            </h2>
            <p>
              The same evidence, speaker context, and exact route remain connected in the live deck,
              readable document, website, and PDF.
            </p>
            <Link className="text-link" to="/docs/authoring/">
              Why Drever uses MDX <ArrowIcon />
            </Link>
          </div>

          <ConnectedSourceDemo />
        </section>
      </div>

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
        <span>Your presentation starts the same way</span>
        <h2>Begin with what the room should change.</h2>
        <p>
          Bring one outcome. Drever and your agent can turn it into a story, a visual language, a
          live room, and every useful surface after it.
        </p>
        <div>
          <CopyAIHandoff className="button button--light" />
          <Link className="text-link text-link--light" to="/docs/getting-started/">
            Follow the creation workflow <ArrowIcon />
          </Link>
        </div>
      </section>
    </main>
  );
}

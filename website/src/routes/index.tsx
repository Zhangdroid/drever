import { useState, type AnimationEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";

import { AIHandoff, CopyAIHandoff } from "../components/ai-handoff";
import { CopyButton } from "../components/copy-button";
import { CreationJourney } from "../components/creation-journey";
import { creationStory } from "../components/creation-story-data";
import { ArrowIcon, ArrowUpRightIcon, PlayIcon } from "../components/icons";
import { HeroStage, HomeShowcaseCover } from "../components/showcase";
import { StudyCover } from "../components/showcase-covers";
import { demos, githubURL } from "../site-data";
import { pageHead } from "../seo";

const description =
  "A local presentation studio for approving the story, directing a live deck with your coding agent, and checking every rendered state before delivery.";

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
        {
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Drever",
            applicationCategory: "PresentationApplication",
            operatingSystem: "macOS, Windows, Linux",
            url: "https://drever.dev/",
            codeRepository: githubURL,
            license: "https://opensource.org/licenses/MIT",
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
      <section className="home-hero" data-header-tone="light">
        <div className="home-hero__copy">
          <span className="home-hero__eyebrow">A local presentation studio</span>
          <h1>
            <span className="home-hero__line">Your agent drafts.</span>
            <span className="home-hero__line">
              <span className="home-hero__highlight">You direct.</span>
            </span>
          </h1>
          <p className="home-hero__lede">
            Approve the story, shape the live draft, and ship a checked presentation from files you
            own.
          </p>
          <div className="home-hero__actions">
            <div className="home-hero__prompt">
              <CopyAIHandoff className="button button--primary" describedBy="home-prompt-tooltip" />
              <span id="home-prompt-tooltip" role="tooltip">
                Paste into your coding agent. It creates the project and opens Drever Studio when
                the host supports it; the same workflow continues in chat otherwise.
              </span>
            </div>
            <a className="button home-hero__demo" href="#studio-workflow">
              <PlayIcon /> See the workflow
            </a>
          </div>
          <div aria-label="More ways to get started" className="home-hero__secondary">
            <Link className="home-hero__manual" to="/docs/getting-started/">
              How Studio works <ArrowIcon />
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

      <CreationJourney />

      <section className="home-showcase" data-header-tone="light">
        <header className="section-heading">
          <div>
            <span>Proof, not promises · live in the browser</span>
            <h2>See what directed work becomes.</h2>
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
            <span>Bring the job. Keep the judgment.</span>
            <h2>What should people understand, decide, or do?</h2>
            <p>Start with one sentence. Every approval and revision remains yours.</p>
            <Link className="text-link text-link--light" to="/docs/getting-started/">
              Follow the creation workflow <ArrowIcon />
            </Link>
          </div>

          <AIHandoff
            heading="What should this presentation help people understand, decide, or do?"
            placeholder={creationStory.brief}
          />
        </div>
      </section>
    </main>
  );
}

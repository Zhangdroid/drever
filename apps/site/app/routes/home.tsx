import { useState } from "react";
import { Link, type MetaFunction } from "react-router";

import { AppearanceControl, BrandLockup, SiteHeader } from "../components.tsx";
import { HeroMotion } from "../hero-motion.tsx";

export const meta: MetaFunction = () => [
  { title: "Drever — Make slides that move with your story" },
  {
    name: "description",
    content:
      "An AI-first slide tool for clear stories, purposeful motion, beautifully designed themes, and a flexible plugin system.",
  },
  { property: "og:type", content: "website" },
  {
    property: "og:title",
    content: "Drever — Make slides that move with your story",
  },
  {
    property: "og:description",
    content: "From a rough idea to slides people can follow.",
  },
  { property: "og:image", content: "https://drever.dev/og.png" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:image", content: "https://drever.dev/og.png" },
];

const storyMoments = [
  {
    id: "thought",
    step: "01",
    tab: "The thought",
    title: "Our city is full of places to go.",
    guide:
      "Start with the audience, the intent, or one unfinished sentence. A rough thought is enough.",
    note: "No outline required.",
  },
  {
    id: "thread",
    step: "02",
    tab: "The turn",
    title: "Belonging begins when people choose to stay.",
    guide:
      "Drever helps find the throughline and suggests a sequence. You keep directing what the story means.",
    note: "The idea finds its shape.",
  },
  {
    id: "landing",
    step: "03",
    tab: "The landing",
    title: "Make room for the pause.",
    guide:
      "A designed theme and purposeful motion give the turning point a visual rhythm that works in the room.",
    note: "One thought worth remembering.",
  },
] as const;

type StoryMoment = (typeof storyMoments)[number];

function StorySlide({ moment }: { moment: StoryMoment }) {
  return (
    <article className={`story-slide story-slide--${moment.id}`}>
      <header className="story-slide__meta">
        <span>Places to pause</span>
        <span>{moment.step} / 03</span>
      </header>
      <div className="story-slide__body">
        <h3>{moment.title}</h3>
        <div className="story-slide__motif" aria-hidden="true">
          {Array.from({ length: 7 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      </div>
      <footer>{moment.note}</footer>
    </article>
  );
}

function StorySequence() {
  const [activeId, setActiveId] = useState<StoryMoment["id"]>("thought");
  const activeMoment = storyMoments.find((moment) => moment.id === activeId) ?? storyMoments[0];

  return (
    <div className="story-sequence">
      <div
        className="story-sequence__controls"
        data-active={activeId}
        role="tablist"
        aria-label="How one thought becomes a story"
      >
        {storyMoments.map((moment) => (
          <button
            aria-controls="story-sequence-panel"
            aria-selected={activeId === moment.id}
            className={activeId === moment.id ? "is-active" : undefined}
            key={moment.id}
            onClick={() => setActiveId(moment.id)}
            role="tab"
            type="button"
          >
            <span className="story-sequence__step">{moment.step}</span>
            <span className="story-sequence__control-copy">
              <strong>{moment.tab}</strong>
              <span>{moment.guide}</span>
            </span>
          </button>
        ))}
      </div>
      <div
        className="story-sequence__preview"
        id="story-sequence-panel"
        role="tabpanel"
        tabIndex={0}
      >
        <StorySlide key={activeMoment.id} moment={activeMoment} />
      </div>
    </div>
  );
}

const features = [
  {
    id: "ai",
    label: "AI-first",
    title: "Start with intent. Stay the author.",
    body: "Bring a sentence, scattered notes, or a half-formed idea. Drever helps move it forward without taking the voice away from you.",
    href: "/docs",
    link: "Explore AI-first",
    size: "large",
  },
  {
    id: "motion",
    label: "Purposeful motion",
    title: "Movement that guides attention.",
    body: "Transitions clarify a change, reveal a relationship, or give the room a beat to catch up.",
    href: "/docs",
    link: "See motion in action",
    size: "tall",
  },
  {
    id: "themes",
    label: "Designed themes",
    title: "A complete visual voice.",
    body: "Type, space, color, composition, and motion are designed together—not swapped from a template menu.",
    href: "/docs",
    link: "Browse themes",
    size: "wide",
  },
  {
    id: "plugins",
    label: "Plugin ecosystem",
    title: "New ways to tell the story.",
    body: "Extend what a slide can contain and how it can work, without rebuilding the experience around each new tool.",
    href: "/docs",
    link: "Explore plugins",
    size: "compact",
  },
] as const;

const themes = [
  {
    id: "plainspoken",
    name: "Plainspoken",
    title: "Make the point.",
    description: "Quiet structure and clear hierarchy for ideas that should feel effortless.",
    href: "/docs",
    link: "View Plainspoken",
    number: "01",
    size: "featured",
  },
  {
    id: "editorial",
    name: "Editorial",
    title: "Give the idea room.",
    description: "Warm pacing and expressive type for a more authored voice.",
    href: "/docs",
    link: "View Editorial",
    number: "02",
    size: "standard",
  },
  {
    id: "studio",
    name: "Studio",
    title: "Hold the room.",
    description: "Bold contrast and decisive rhythm when the message needs presence.",
    href: "/docs",
    link: "View Studio",
    number: "03",
    size: "standard",
  },
] as const;

export default function HomePage() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main id="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__body page-grid">
            <div className="hero__copy">
              <h1 id="hero-title">
                <span>Make slides</span>
                <span>that move with</span>
                <span className="hero__shift">your story.</span>
              </h1>
              <p>
                Turn rough ideas into <strong>clear, expressive slides</strong>
                —from first thought to the room. AI-first, guided by{" "}
                <strong className="hero__human">your voice.</strong>
              </p>
              <div className="hero__actions">
                <Link className="button button--primary" to="/docs">
                  Create slides <span aria-hidden="true">→</span>
                </Link>
                <a className="button button--text" href="#story">
                  See how it works
                </a>
              </div>
            </div>
            <HeroMotion />
          </div>
        </section>

        <section
          className="state-story page-section"
          id="story"
          aria-labelledby="state-story-title"
        >
          <div className="section-heading page-grid">
            <span className="section-heading__eyebrow">One idea, shaped with you</span>
            <div>
              <h2 id="state-story-title">See one thought become a story.</h2>
              <p>
                Start with a sentence. Drever helps find the turn, shape the sequence, and give it a
                visual rhythm—while the point stays yours.
              </p>
            </div>
          </div>
          <StorySequence />
        </section>

        <section className="features-section page-section" aria-labelledby="features-title">
          <div className="section-heading section-heading--inverse page-grid">
            <span className="section-heading__eyebrow">What makes Drever different</span>
            <div>
              <h2 id="features-title">Built for the whole act of telling.</h2>
              <p>
                The foundation is already taking shape. As Drever grows, new capabilities can join
                this system without flattening everything into the same kind of feature box.
              </p>
            </div>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <Link
                aria-label={`${feature.label}: ${feature.link}`}
                className={`feature-card feature-card--${feature.id} feature-card--${feature.size}`}
                key={feature.id}
                to={feature.href}
              >
                <span className="feature-card__label">{feature.label}</span>
                <div className="feature-card__mark" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, index) => (
                    <span key={index} />
                  ))}
                </div>
                <div className="feature-card__copy">
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                  <span className="feature-card__link">
                    {feature.link} <span aria-hidden="true">→</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section
          className="themes-section page-section"
          id="examples"
          aria-labelledby="themes-title"
        >
          <div className="section-heading page-grid">
            <span className="section-heading__eyebrow">Designed one by one</span>
            <div>
              <h2 id="themes-title">Every theme has a point of view.</h2>
              <p>
                A theme is more than a new color. Each one is designed as a complete system for
                type, space, composition, and motion.
              </p>
            </div>
          </div>
          <div className="theme-gallery" aria-label="Drever visual voices">
            {themes.map((theme) => (
              <Link
                aria-label={`${theme.name}: ${theme.link}`}
                className={`theme-card theme-card--${theme.id} theme-card--${theme.size}`}
                key={theme.id}
                to={theme.href}
              >
                <div className="theme-card__preview">
                  <header>
                    <span>Drever</span>
                    <span>{theme.number}</span>
                  </header>
                  <h3>{theme.title}</h3>
                  <div className="theme-card__composition" aria-hidden="true">
                    {Array.from({ length: 4 }, (_, index) => (
                      <span key={index} />
                    ))}
                  </div>
                </div>
                <footer>
                  <strong>{theme.name}</strong>
                  <p>{theme.description}</p>
                  <span className="theme-card__link">
                    {theme.link} <span aria-hidden="true">→</span>
                  </span>
                </footer>
              </Link>
            ))}
          </div>
        </section>

        <section className="closing-section page-grid" aria-labelledby="closing-title">
          <span className="section-heading__eyebrow">Your opening move</span>
          <div>
            <h2 id="closing-title">Your next slide can start with one thought.</h2>
            <p>Tell Drever what you want the room to understand. Build the story from there.</p>
            <Link className="button button--primary" to="/docs">
              Create slides <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="site-footer page-grid">
        <BrandLockup />
        <p>Slides designed to move with the story.</p>
        <AppearanceControl />
      </footer>
    </div>
  );
}

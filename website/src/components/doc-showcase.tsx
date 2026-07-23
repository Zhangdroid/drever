import { Link } from "@tanstack/react-router";

import type { ThemeId } from "../site-data";
import { ArrowIcon, ArrowUpRightIcon } from "./icons";
import { ThemePreview } from "./showcase";

function MotionVisual() {
  return (
    <div className="capability-visual capability-visual--motion" aria-hidden="true">
      <div className="capability-motion__frame">
        <i />
        <i />
        <i />
      </div>
      <span />
      <span />
    </div>
  );
}

function PluginVisual() {
  return (
    <div className="capability-visual capability-visual--plugins" aria-hidden="true">
      <div>
        <small>LaTeX</small>
        <strong>
          ∫<sub>0</sub>
          <sup>1</sup> x² dx
        </strong>
      </div>
      <div>
        <small>Shiki</small>
        <code>
          <i>const</i> story = <b>alive</b>
        </code>
      </div>
      <span>Tailwind CSS</span>
    </div>
  );
}

function ThemeVisual() {
  return (
    <div className="capability-visual capability-visual--themes" aria-hidden="true">
      <i />
      <i />
      <i />
    </div>
  );
}

function SurfaceVisual() {
  return (
    <div className="capability-visual capability-visual--surfaces" aria-hidden="true">
      <div>
        <i />
        <i />
      </div>
      <span />
      <span />
      <span />
    </div>
  );
}

const capabilities = [
  {
    body: "Focus, replace, compare, stagger, and continuity are chosen by meaning—not presets.",
    guide: "/docs/motion",
    label: "Motion",
    live: "/demos/motion/9/",
    liveLabel: "See the five intents",
    title: "Motion has five jobs.",
    visual: <MotionVisual />,
  },
  {
    body: "See real output from Shiki, Tailwind CSS, and build-time LaTeX.",
    guide: "/docs/plugins",
    label: "Plugins",
    live: "/demos/features/3/",
    liveLabel: "Open the feature tour",
    title: "Use the right medium.",
    visual: <PluginVisual />,
  },
  {
    body: "Study eight subject-led systems, then generate and persist the direction this story needs.",
    guide: "/docs/themes",
    label: "Art direction",
    live: "/themes",
    liveLabel: "Explore design studies",
    title: "Design begins with the subject.",
    visual: <ThemeVisual />,
  },
  {
    body: "Audience, Speaker, Document, website, and PDF begin with the same editable project.",
    guide: "/docs/presenting",
    label: "Present",
    live: "/demos/features/8/",
    liveLabel: "See every surface",
    title: "One story stays useful.",
    visual: <SurfaceVisual />,
  },
] as const;

export function DocsCapabilityGallery() {
  return (
    <section className="docs-capabilities" aria-labelledby="docs-capabilities-title">
      <header>
        <span>See it first</span>
        <h2 id="docs-capabilities-title">Explore the system.</h2>
        <p>Every card opens a real Drever deck or the exact guide behind it.</p>
      </header>
      <div className="docs-capabilities__grid">
        {capabilities.map((capability) => (
          <article key={capability.label}>
            {capability.visual}
            <div className="docs-capabilities__copy">
              <span>{capability.label}</span>
              <h3>{capability.title}</h3>
              <p>{capability.body}</p>
              <nav aria-label={`${capability.label} links`}>
                <a href={capability.live}>
                  {capability.liveLabel} <ArrowUpRightIcon />
                </a>
                <Link to={capability.guide}>
                  Read the guide <ArrowIcon />
                </Link>
              </nav>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const motionRecipes = [
  {
    description: "Keep context. Move attention.",
    href: "/demos/motion/10/",
    intent: "focus",
    label: "Focus",
  },
  {
    description: "Let one thought change in place.",
    href: "/demos/motion/11/",
    intent: "replace",
    label: "Replace",
  },
  {
    description: "Add evidence without erasing contrast.",
    href: "/demos/motion/12/",
    intent: "compare",
    label: "Compare",
  },
  {
    description: "Give one beat a readable order.",
    href: "/demos/motion/13/",
    intent: "stagger",
    label: "Stagger",
  },
  {
    description: "Carry the same object across a change.",
    href: "/demos/motion/2/",
    intent: "continuity",
    label: "Continuity",
  },
] as const;

export function MotionRecipeGallery() {
  return (
    <section className="doc-visual-intro" aria-labelledby="motion-recipes-title">
      <header>
        <span>Live motion recipes</span>
        <h2 id="motion-recipes-title">Choose the relationship before the effect.</h2>
        <p>Open a recipe, advance its states, then return for the authoring contract.</p>
      </header>
      <div className="motion-recipe-grid">
        {motionRecipes.map((recipe) => (
          <a data-intent={recipe.intent} href={recipe.href} key={recipe.intent}>
            <div className="motion-recipe__visual" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <span>{recipe.label}</span>
            <strong>{recipe.description}</strong>
            <ArrowUpRightIcon />
          </a>
        ))}
      </div>
      <a className="doc-visual-intro__more" href="/demos/motion/">
        View all 15 motion field notes <ArrowUpRightIcon />
      </a>
    </section>
  );
}

const plugins = [
  {
    badge: "Included",
    description: "Build-time highlighting with no client-side highlighter.",
    href: "/demos/features/4/",
    id: "shiki",
    label: "Shiki",
  },
  {
    badge: "Included",
    description: "Compose local artifacts without letting Preflight replace the theme.",
    href: "/demos/features/5/",
    id: "tailwind",
    label: "Tailwind CSS",
  },
  {
    badge: "Opt in",
    description: "Write readable LaTeX and ship accessible HTML and MathML.",
    href: "/demos/features/3/",
    id: "math",
    label: "LaTeX / KaTeX",
  },
  {
    badge: "Build your own",
    description: "Add Vite, MDX, runtime, and export capability through one owned contract.",
    href: "/demos/features/9/",
    id: "custom",
    label: "Typed extensions",
  },
] as const;

export function PluginGallery() {
  return (
    <section className="doc-visual-intro" aria-labelledby="plugin-gallery-title">
      <header>
        <span>See the output</span>
        <h2 id="plugin-gallery-title">Add capability only where the idea needs it.</h2>
        <p>The common path is ready by default. Specialized behavior stays explicit.</p>
      </header>
      <div className="plugin-gallery">
        {plugins.map((plugin) => (
          <a data-plugin={plugin.id} href={plugin.href} key={plugin.id}>
            <div className="plugin-gallery__visual" aria-hidden="true">
              <i />
              <i />
              <i />
              <strong>{plugin.id === "math" ? "∑" : plugin.id === "shiki" ? "{}" : "Aa"}</strong>
            </div>
            <span>{plugin.badge}</span>
            <h3>{plugin.label}</h3>
            <p>{plugin.description}</p>
            <small>
              Open live output <ArrowUpRightIcon />
            </small>
          </a>
        ))}
      </div>
    </section>
  );
}

const themeDemos = {
  default: {
    action: "Open demo",
    href: "/demos/basic/",
    statement: "Clear, spacious, ready for almost any story.",
  },
  editorial: {
    action: "Open demo",
    href: "/demos/product/",
    statement: "A point of view, set in type.",
  },
  studio: {
    action: "Open demo",
    href: "/demos/features/",
    statement: "Let the artifact take the stage.",
  },
  fieldnote: {
    action: "View study",
    href: "/themes#fieldnote",
    statement: "Think in ink, explain in plain language.",
  },
  atlas: {
    action: "View study",
    href: "/themes#atlas",
    statement: "Show where the story is going.",
  },
  ledger: {
    action: "View study",
    href: "/themes#ledger",
    statement: "Make the number answerable.",
  },
  cinema: {
    action: "View study",
    href: "/themes#cinema",
    statement: "Let one image carry the moment.",
  },
  construct: {
    action: "View study",
    href: "/themes#construct",
    statement: "Build the explanation from real parts.",
  },
} as const;

export function ThemeGallery() {
  return (
    <section className="doc-visual-intro" aria-labelledby="theme-gallery-title">
      <header>
        <span>Eight design studies</span>
        <h2 id="theme-gallery-title">Study the reasoning. Do not pick a skin.</h2>
        <p>
          Each study is a few-shot reference for turning subject matter into type, layout,
          components, and motion. Its package is also a reliable fallback.
        </p>
      </header>
      <div className="doc-theme-gallery">
        {Object.entries(themeDemos).map(([id, theme]) => (
          <a href={theme.href} key={id}>
            <ThemePreview theme={id as ThemeId} />
            <span>{id}</span>
            <strong>{theme.statement}</strong>
            <small>
              {theme.action} <ArrowUpRightIcon />
            </small>
          </a>
        ))}
      </div>
    </section>
  );
}

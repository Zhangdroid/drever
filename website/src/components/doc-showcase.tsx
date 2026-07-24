import { Link } from "@tanstack/react-router";

import { themes } from "../site-data";
import { ArrowIcon, ArrowUpRightIcon } from "./icons";
import { ArtDirectionCover } from "./showcase-covers";

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
        <small>Shiki + Charts</small>
        <code>
          <i>const</i> evidence = <b>[31, 58, 82]</b>
        </code>
      </div>
      <span>GFM · Tailwind · Media</span>
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
    body: "Objects enter, answer, recede, or hold still because the story gives them a new job.",
    guide: "/docs/motion",
    label: "Meaningful motion",
    live: "/demos/motion/2/",
    liveLabel: "Follow one object",
    title: "Motion carries the idea.",
    visual: <MotionVisual />,
  },
  {
    body: "See real GFM, code, math, chart, and media output with explicit browser costs.",
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
    live: "/showcase#art-directions",
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
    description: "Hint, arrive, demonstrate, then recede.",
    href: "/demos/motion/2/",
    intent: "continuity",
    label: "Object lifecycle",
  },
  {
    description: "Correct one thought in a fixed text slot.",
    href: "/demos/motion/6/",
    intent: "replace",
    label: "Semantic change",
  },
  {
    description: "Uncover information that was genuinely hidden.",
    href: "/demos/motion/7/",
    intent: "focus",
    label: "Genuine reveal",
  },
  {
    description: "Make reading order carry cause and effect.",
    href: "/demos/motion/9/",
    intent: "stagger",
    label: "Causality",
  },
  {
    description: "Use depth only when structure is the subject.",
    href: "/demos/motion/12/",
    intent: "compare",
    label: "Spatial state",
  },
] as const;

export function MotionRecipeGallery() {
  return (
    <section className="doc-visual-intro" aria-labelledby="motion-recipes-title">
      <a className="motion-recipe-deck" href="/demos/motion/">
        <span className="motion-recipe-deck__copy">
          <small>Complete live deck</small>
          <strong>Watch every motion story in context.</strong>
        </span>
        <span className="motion-recipe-deck__action">
          Open the motion deck <ArrowUpRightIcon />
        </span>
      </a>
      <header>
        <span>Live motion recipes</span>
        <h2 id="motion-recipes-title">Choose the relationship before the effect.</h2>
        <p>Open a recipe, advance its states, then return for the authoring contract.</p>
      </header>
      <p className="motion-recipe-grid__label">Or jump directly to one relationship.</p>
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
    </section>
  );
}

const plugins = [
  {
    badge: "Included",
    description: "Tables, task lists, autolinks, and strikethrough with no browser parser.",
    href: "/demos/features/9/",
    id: "gfm",
    label: "GitHub Flavored Markdown",
    mark: "✓",
    packageId: "@drever/plugin-gfm",
  },
  {
    badge: "Included",
    description: "Build-time highlighting with no client-side highlighter.",
    href: "/demos/features/4/",
    id: "shiki",
    label: "Shiki",
    mark: "{}",
    packageId: "@drever/plugin-shiki",
  },
  {
    badge: "Included",
    description: "Compose local artifacts without letting Preflight replace the theme.",
    href: "/demos/features/5/",
    id: "tailwind",
    label: "Tailwind CSS",
    mark: "Aa",
    packageId: "@drever/plugin-tailwindcss",
  },
  {
    badge: "Opt in",
    description: "Write readable LaTeX and ship accessible HTML and MathML.",
    href: "/demos/features/3/",
    id: "math",
    label: "LaTeX / KaTeX",
    mark: "∑",
    packageId: "@drever/plugin-math",
  },
  {
    badge: "Opt in",
    description: "Render accessible bar or line data as deterministic semantic SVG.",
    href: "/demos/features/10/",
    id: "charts",
    label: "Charts",
    mark: "↗",
    packageId: "@drever/plugin-charts",
  },
  {
    badge: "Opt in",
    description:
      "Play privacy-enhanced lazy media live and keep every other surface deterministic.",
    href: "/demos/features/11/",
    id: "media",
    label: "Media",
    mark: "▶",
    packageId: "@drever/plugin-media",
  },
  {
    badge: "Build your own",
    description: "Add Vite, MDX, runtime, and export capability through one owned contract.",
    href: "/demos/features/12/",
    id: "custom",
    label: "Typed extensions",
    mark: "＋",
    packageId: undefined,
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
          <a
            data-plugin={plugin.id}
            data-plugin-package={plugin.packageId}
            href={plugin.href}
            key={plugin.id}
          >
            <div className="plugin-gallery__visual" aria-hidden="true">
              <i />
              <i />
              <i />
              <strong>{plugin.mark}</strong>
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
        {themes.map((theme) => (
          <a className="theme-card" href={theme.liveHref} key={theme.id}>
            <ArtDirectionCover theme={theme.id} />
            <div>
              <span>
                {theme.label} <ArrowUpRightIcon />
              </span>
              <strong>{theme.statement}</strong>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

import { Link, createFileRoute } from "@tanstack/react-router";

import { ArrowIcon, ArrowUpRightIcon } from "../components/icons";
import { PageHero } from "../components/page-hero";
import { SiteShell } from "../components/site-shell";
import { ThemePreview } from "../components/showcase";
import { themes } from "../site-data";
import { pageHead } from "../seo";

const description =
  "Explore Drever's three official visual systems: Default, Editorial, and Studio, each with its own typography, layouts, and motion voice.";

const themeDetails = {
  default: {
    layouts: ["Cover", "TwoColumn"],
    liveHref: "/demos/basic/",
    liveLabel: "Open Default demo",
    statement: "Clear, spacious, ready for almost any story.",
  },
  editorial: {
    layouts: ["Masthead", "Feature"],
    liveHref: "/demos/product/",
    liveLabel: "Open customized demo",
    statement: "A point of view, set in type.",
  },
  studio: {
    layouts: ["Statement", "Workbench"],
    liveHref: "/demos/features/",
    liveLabel: "Open customized demo",
    statement: "Let the artifact take the stage.",
  },
} as const;

export const Route = createFileRoute("/themes")({
  component: ThemesPage,
  head: () => pageHead("Themes", description, "/themes"),
});

function ThemesPage() {
  return (
    <SiteShell>
      <main className="catalog-page" id="main">
        <PageHero
          description={description}
          eyebrow="Three visual voices"
          title="Design is part of the argument."
        >
          <div className="page-hero__aside">
            <strong>Content keeps its contract.</strong>
            <p>
              Change the theme without changing slide boundaries, Steps, notes, routes, or delivery
              surfaces.
            </p>
          </div>
        </PageHero>

        <section className="themes-catalog">
          {themes.map((theme, index) => {
            const details = themeDetails[theme.id];
            return (
              <article id={theme.id} className="theme-detail" key={theme.id}>
                <div className="theme-detail__preview">
                  <ThemePreview theme={theme.id} />
                </div>
                <div className="theme-detail__copy">
                  <span>
                    0{index + 1} · {theme.voice}
                  </span>
                  <h2>{theme.label}</h2>
                  <strong>{details.statement}</strong>
                  <p>{theme.description}</p>
                  <dl>
                    <div>
                      <dt>Package</dt>
                      <dd>
                        <code>{theme.packageName}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>Layouts</dt>
                      <dd>{details.layouts.join(" · ")}</dd>
                    </div>
                  </dl>
                  <div className="theme-detail__actions">
                    <a className="button button--primary" href={details.liveHref}>
                      {details.liveLabel} <ArrowUpRightIcon />
                    </a>
                    <Link className="button button--quiet" to="/docs/themes">
                      Theme guide <ArrowIcon />
                    </Link>
                  </div>
                  {theme.id === "default" ? null : (
                    <small>
                      The linked showcase extends the stock theme with project-specific typography
                      and components.
                    </small>
                  )}
                </div>
              </article>
            );
          })}
        </section>

        <section className="theme-principle">
          <span>Theme contract</span>
          <h2>Visual voice belongs to the theme. Narrative state belongs to Drever.</h2>
          <div>
            <p>
              Themes own semantic elements, layout recipes, canvas defaults, and how each motion
              intent feels.
            </p>
            <p>
              Drever owns compilation, navigation, accessibility state, exact URLs, and every
              delivery surface.
            </p>
          </div>
          <Link className="text-link" to="/docs/themes">
            Read the theme guide <ArrowIcon />
          </Link>
        </section>
      </main>
    </SiteShell>
  );
}

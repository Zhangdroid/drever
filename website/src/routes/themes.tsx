import { Link, createFileRoute } from "@tanstack/react-router";

import { ArrowIcon, ArrowUpRightIcon } from "../components/icons";
import { PageHero } from "../components/page-hero";
import { SiteShell } from "../components/site-shell";
import { ThemePreview } from "../components/showcase";
import { themes } from "../site-data";
import { pageHead } from "../seo";

const description =
  "Eight design studies show how subject, audience, evidence, and motion become a reproducible Drever Theme contract.";

const themeDetails = {
  default: {
    layouts: ["Cover", "TwoColumn"],
    liveHref: "/demos/basic/",
    statement: "Clear, spacious, ready for almost any story.",
  },
  editorial: {
    layouts: ["Masthead", "Feature"],
    liveHref: "/demos/product/",
    statement: "A point of view, set in type.",
  },
  studio: {
    layouts: ["Statement", "Workbench"],
    liveHref: "/demos/features/",
    statement: "Let the artifact take the stage.",
  },
  fieldnote: {
    layouts: ["Notebook", "Annotated"],
    liveHref: "/demos/design/fieldnote/",
    statement: "Think in ink, explain in plain language.",
  },
  atlas: {
    layouts: ["Route", "Survey"],
    liveHref: "/demos/design/atlas/",
    statement: "Show where the story is going.",
  },
  ledger: {
    layouts: ["Metric", "Evidence"],
    liveHref: "/demos/design/ledger/",
    statement: "Make the number answerable.",
  },
  cinema: {
    layouts: ["TitleCard", "Frame"],
    liveHref: "/demos/design/cinema/",
    statement: "Let one image carry the moment.",
  },
  construct: {
    layouts: ["Prompt", "Assembly"],
    liveHref: "/demos/design/construct/",
    statement: "Build the explanation from real parts.",
  },
} as const;

export const Route = createFileRoute("/themes")({
  component: ThemesPage,
  head: () => pageHead("Design studies", description, "/themes"),
});

function ThemesPage() {
  return (
    <SiteShell>
      <main className="catalog-page" id="main">
        <PageHero
          description={description}
          eyebrow="Eight design studies"
          title="Design for the story. Keep it reproducible."
        >
          <div className="page-hero__aside">
            <strong>AI starts from the brief.</strong>
            <p>
              It can generate a local visual system for one story, then save the result as a stable,
              testable Theme.
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
                    Study 0{index + 1} · {theme.voice}
                  </span>
                  <h2>{theme.label}</h2>
                  <strong>{details.statement}</strong>
                  <p>{theme.description}</p>
                  <dl>
                    <div>
                      <dt>Reference contract</dt>
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
                      Open live study <ArrowUpRightIcon />
                    </a>
                    <Link className="button button--quiet" to="/docs/themes">
                      Art direction guide <ArrowIcon />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="theme-principle">
          <span>Generated direction · deterministic contract</span>
          <h2>Art direction is made for the story. Theme is the artifact Drever executes.</h2>
          <div>
            <p>
              AI derives type, color, layout, components, and motion from the subject instead of
              selecting a random attractive skin.
            </p>
            <p>
              The result is persisted locally or packaged so builds, URLs, accessibility state,
              exports, and every delivery surface remain reproducible.
            </p>
          </div>
          <Link className="text-link" to="/docs/themes">
            Read the art direction guide <ArrowIcon />
          </Link>
        </section>
      </main>
    </SiteShell>
  );
}

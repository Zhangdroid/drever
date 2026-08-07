import { Link, createFileRoute } from "@tanstack/react-router";

import { CopyAIHandoff } from "../components/ai-handoff";
import { ArrowIcon, ArrowUpRightIcon, PlayIcon } from "../components/icons";
import { PageHero } from "../components/page-hero";
import { ArtDirectionCover, StudyCover } from "../components/showcase-covers";
import { HomeShowcaseCover } from "../components/showcase";
import { demos, githubURL, themes } from "../site-data";
import { pageHead } from "../seo";

const description =
  "Explore complete Drever stories, focused capability studies, and subject-led visual directions—all running as real presentations.";

export const Route = createFileRoute("/showcase")({
  component: ShowcasePage,
  head: () => pageHead("Showcase", description, "/showcase"),
});

function ShowcasePage() {
  const product = demos.find((demo) => demo.id === "product");
  const minimal = demos.find((demo) => demo.id === "basic");
  const capabilityOrder = ["architecture", "motion", "features", "scenes", "spatial"];
  const capabilities = capabilityOrder.map((id) => {
    const demo = demos.find((candidate) => candidate.id === id);
    if (demo === undefined) throw new Error(`The ${id} study is required by the showcase.`);
    return demo;
  });

  if (product === undefined || minimal === undefined) {
    throw new Error("The product and minimal-reference demos are required by the showcase.");
  }

  return (
    <main className="catalog-page showcase-page" id="main" tabIndex={-1}>
      <PageHero
        description={description}
        eyebrow="Built with Drever"
        title={
          <>
            <span className="display-line">See the story,</span>
            <span className="display-line">the system,</span>
            <span className="display-line">and the visual voice.</span>
          </>
        }
      >
        <nav aria-label="Showcase sections" className="showcase-index">
          <a href="#stories">
            <span>01</span>
            Stories
          </a>
          <a href="#capabilities">
            <span>02</span>
            Capabilities
          </a>
          <a href="#art-directions">
            <span>03</span>
            Art directions
          </a>
        </nav>
      </PageHero>

      <section aria-labelledby="showcase-story-title" className="showcase-section" id="stories">
        <header className="showcase-section__heading">
          <div>
            <span>Complete story</span>
            <h2 id="showcase-story-title">
              <span className="display-line">Enter the room,</span>
              <span className="display-line">not a recording of it.</span>
            </h2>
          </div>
          <p>
            Navigate every reveal, draw on the canvas, open Speaker View, read the document, or
            inspect the exact source behind the result.
          </p>
        </header>

        <div className="featured-demo">
          <a
            aria-label="Open the Product tour live presentation"
            className="featured-demo__visual featured-demo__visual--rich"
            data-header-tone="dark"
            href={product.href}
          >
            <HomeShowcaseCover kind="product" />
            <div className="featured-demo__open">
              <PlayIcon />
              <span>Open live presentation</span>
            </div>
          </a>
          <div className="featured-demo__copy">
            <span>{product.meta}</span>
            <h2>{product.label}</h2>
            <p>{product.description}</p>
            <nav aria-label="Product tour surfaces">
              <a href="/showcase/product/">
                Audience <ArrowUpRightIcon />
              </a>
              <a href="/showcase/product/speaker/">
                Speaker <ArrowUpRightIcon />
              </a>
              <a href="/showcase/product/document/">
                Document <ArrowUpRightIcon />
              </a>
            </nav>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="showcase-capabilities-title"
        className="showcase-section"
        id="capabilities"
      >
        <header className="showcase-section__heading">
          <div>
            <span>Focused studies</span>
            <h2 id="showcase-capabilities-title">Watch one capability do a real job.</h2>
          </div>
          <p>
            Each smaller deck gives one capability enough room to prove itself without turning the
            showcase into a feature checklist.
          </p>
        </header>

        <div className="catalog-demos">
          {capabilities.map((demo) => (
            <article className="catalog-demo" data-demo={demo.id} key={demo.id}>
              <a
                aria-label={`Open the ${demo.label} live study`}
                className="catalog-demo__visual catalog-demo__visual--rich"
                href={demo.href}
              >
                {demo.id !== "product" && demo.id !== "basic" ? (
                  <StudyCover study={demo.id} />
                ) : null}
              </a>
              <div>
                <span>{demo.meta}</span>
                <h2>{demo.label}</h2>
                <p>{demo.description}</p>
                <a className="text-link" href={demo.href}>
                  Open live study <ArrowIcon />
                </a>
              </div>
            </article>
          ))}
        </div>

        <aside className="showcase-reference">
          <div>
            <span>Prefer the smallest useful example?</span>
            <strong>{minimal.label}</strong>
          </div>
          <p>{minimal.description}</p>
          <a className="text-link" href={minimal.href}>
            Open the reference <ArrowUpRightIcon />
          </a>
        </aside>
      </section>

      <section
        aria-labelledby="showcase-art-title"
        className="showcase-section showcase-designs"
        id="art-directions"
      >
        <header className="showcase-section__heading">
          <div>
            <span>Art-direction studies</span>
            <h2 id="showcase-art-title">Start from the subject, not a preset.</h2>
          </div>
          <div>
            <p>
              Each study turns a different kind of story into a reproducible visual system. Treat
              them as evidence and references—not a menu of skins.
            </p>
            <Link className="text-link" to="/docs/themes/">
              Read the art direction guide <ArrowIcon />
            </Link>
          </div>
        </header>

        <aside className="showcase-design-import" data-header-tone="dark">
          <div className="showcase-design-import__copy">
            <span>Bring your own visual language</span>
            <h3>Import evidence. Keep the code.</h3>
            <p>
              Drever can study computed color, type, spacing, and shape from a reference page, then
              write a local starting direction without copying its source.
            </p>
            <a className="text-link text-link--light" href="/docs/themes/#import-design-evidence">
              See how design import works <ArrowIcon />
            </a>
          </div>
          <div className="showcase-design-import__visual" aria-hidden="true">
            <div data-import-surface="reference">
              <span />
              <i />
              <i />
              <b />
            </div>
            <strong>→</strong>
            <div data-import-surface="owned">
              <span />
              <i />
              <i />
              <b />
            </div>
          </div>
        </aside>

        <div className="theme-strip">
          {themes.map((theme) => (
            <a className="theme-card" href={theme.liveHref} id={theme.id} key={theme.id}>
              <ArtDirectionCover theme={theme.id} />
              <div>
                <h3>{theme.label}</h3>
                <strong>{theme.statement}</strong>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="catalog-proof" data-header-tone="dark">
        <div>
          <span>Open the real builds</span>
          <h2>
            <span className="display-line">Every linked presentation</span>
            <span className="display-line">runs from repository source.</span>
          </h2>
        </div>
        <p>
          Each linked deck is rebuilt and mounted as a standalone app. Clean URLs, exact Step
          states, Speaker View, Document View, interaction, and assets all keep working below{" "}
          <code>/showcase/*</code>.
        </p>
        <a className="button button--light" href={`${githubURL}/tree/main/examples`}>
          Browse example source <ArrowUpRightIcon />
        </a>
      </section>

      <section className="catalog-next">
        <div>
          <span>Make the next one yours</span>
          <h2>Begin with what the room should change.</h2>
        </div>
        <div>
          <CopyAIHandoff className="button button--primary" />
          <Link className="button button--quiet" to="/docs/getting-started/">
            Getting started <ArrowIcon />
          </Link>
        </div>
      </section>
    </main>
  );
}

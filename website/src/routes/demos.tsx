import { Link, createFileRoute } from "@tanstack/react-router";

import { ArrowIcon, ArrowUpRightIcon, PlayIcon } from "../components/icons";
import { PageHero } from "../components/page-hero";
import { SiteShell } from "../components/site-shell";
import { demos, githubURL } from "../site-data";
import { pageHead } from "../seo";

const description =
  "Explore complete Drever presentations with live interaction, exact Step routes, Speaker View, Document View, and static delivery.";

export const Route = createFileRoute("/demos")({
  component: DemosPage,
  head: () => pageHead("Demos", description, "/demos"),
});

function DemosPage() {
  const product = demos[0];
  const secondary = demos.slice(1);
  if (product === undefined) throw new Error("The product demo is missing from the site manifest.");

  return (
    <SiteShell>
      <main className="catalog-page" id="main">
        <PageHero
          description={description}
          eyebrow="Executable stories"
          title="Made with the same Drever you install."
        >
          <div className="page-hero__aside">
            <strong>Every demo is complete.</strong>
            <p>
              Navigate it, draw on it, open the speaker view, read the document, and inspect source.
            </p>
          </div>
        </PageHero>

        <section className="featured-demo">
          <a className="featured-demo__visual" href={product.href}>
            <span>Product tour</span>
            <h2>
              The room changes.
              <br />
              Your slides should too.
            </h2>
            <div>
              <PlayIcon />
              <span>Open live presentation</span>
            </div>
            <i />
          </a>
          <div className="featured-demo__copy">
            <span>{product.meta}</span>
            <h2>{product.label}</h2>
            <p>{product.description}</p>
            <nav aria-label="Product tour surfaces">
              <a href="/demos/product/">
                Audience <ArrowUpRightIcon />
              </a>
              <a href="/demos/product/speaker">
                Speaker <ArrowUpRightIcon />
              </a>
              <a href="/demos/product/document">
                Document <ArrowUpRightIcon />
              </a>
            </nav>
          </div>
        </section>

        <section className="catalog-demos">
          {secondary.map((demo, index) => (
            <article className="catalog-demo" data-demo={demo.id} key={demo.id}>
              <a className="catalog-demo__visual" href={demo.href}>
                <span>0{index + 2}</span>
                <strong>{demo.label}</strong>
                <ArrowUpRightIcon />
              </a>
              <div>
                <span>{demo.meta}</span>
                <h2>{demo.label}</h2>
                <p>{demo.description}</p>
                <a className="text-link" href={demo.href}>
                  Open demo <ArrowIcon />
                </a>
              </div>
            </article>
          ))}
        </section>

        <section className="catalog-proof" data-header-tone="dark">
          <div>
            <span>No capture tricks</span>
            <h2>These are static production builds.</h2>
          </div>
          <p>
            Each demo is rebuilt from its repository source and mounted as a standalone app. Clean
            slide URLs, exact Step routes, Speaker View, Document View, interaction, and asset
            loading all work below <code>/demos/*</code>.
          </p>
          <a className="button button--light" href={`${githubURL}/tree/main/examples`}>
            Browse example source <ArrowUpRightIcon />
          </a>
        </section>

        <section className="catalog-next">
          <div>
            <span>Build your own</span>
            <h2>Begin with the story. Derive its visual voice next.</h2>
          </div>
          <div>
            <Link className="button button--primary" to="/docs/getting-started">
              Getting started <ArrowIcon />
            </Link>
            <Link className="button button--quiet" to="/themes">
              Explore design studies <ArrowIcon />
            </Link>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}

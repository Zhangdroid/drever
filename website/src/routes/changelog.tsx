import { createFileRoute } from "@tanstack/react-router";

import Changelog from "../../../CHANGELOG.md";
import { ArrowUpRightIcon } from "../components/icons";
import { PageHero } from "../components/page-hero";
import { pageHead } from "../seo";

const description =
  "Curated changes from each Drever release, with the current work in progress kept visible.";

export const Route = createFileRoute("/changelog")({
  component: ChangelogPage,
  head: () => pageHead("Changelog", description, "/changelog"),
});

function HiddenSourceTitle() {
  return null;
}

function ChangelogPage() {
  return (
    <main className="changelog-page" id="main" tabIndex={-1}>
      <PageHero description={description} eyebrow="Releases" title="Changelog">
        <a
          className="button button--quiet changelog-page__releases"
          href="https://github.com/Zhangdroid/drever/releases"
          rel="noreferrer"
          target="_blank"
        >
          GitHub Releases <ArrowUpRightIcon />
        </a>
      </PageHero>

      <article className="changelog-content">
        <Changelog components={{ h1: HiddenSourceTitle }} />
      </article>
    </main>
  );
}

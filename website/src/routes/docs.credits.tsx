import { createFileRoute } from "@tanstack/react-router";

import Content from "../../content/docs/credits.mdx";
import { DocArticle, DocMdx } from "../components/docs-shell";
import { pageHead } from "../seo";

const description =
  "The people, projects, open-source foundations, and AI collaboration behind Drever.";

export const Route = createFileRoute("/docs/credits")({
  component: Page,
  head: () => pageHead("Credits", description, "/docs/credits"),
});

function Page() {
  return (
    <DocArticle description={description} eyebrow="Project" title="Credits">
      <DocMdx content={Content} />
    </DocArticle>
  );
}

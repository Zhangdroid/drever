import { createFileRoute } from "@tanstack/react-router";

import Content from "../../content/docs/authoring.mdx";
import { DocArticle, DocMdx, DocNext } from "../components/docs-shell";
import { pageHead } from "../seo";

const description =
  "Use readable MDX for the story, precise Step state for pacing, and React only where the idea needs behavior.";

export const Route = createFileRoute("/docs/authoring")({
  component: Page,
  head: () => pageHead("Authoring slides", description, "/docs/authoring"),
});

function Page() {
  return (
    <DocArticle description={description} eyebrow="Create" title="Authoring slides">
      <DocMdx content={Content} />
      <DocNext
        description="Derive a visual voice from the subject and persist it as a Theme contract."
        href="/docs/themes/"
        label="Art direction"
      />
    </DocArticle>
  );
}

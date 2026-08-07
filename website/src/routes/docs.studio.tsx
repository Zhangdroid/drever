import { createFileRoute } from "@tanstack/react-router";

import Content from "../../content/docs/studio.mdx";
import { DocArticle, DocMdx, DocNext } from "../components/docs-shell";
import { StudioScreenshots } from "../components/studio-screenshots";
import { pageHead } from "../seo";

const description =
  "Use Drever Studio to answer adaptive questions, approve the content Storyboard, follow agent work, and direct one slide or the whole live draft.";

export const Route = createFileRoute("/docs/studio")({
  component: Page,
  head: () => pageHead("Studio", description, "/docs/studio"),
});

function Page() {
  return (
    <DocArticle description={description} eyebrow="Start" title="Direct the work in Studio" wide>
      <StudioScreenshots />
      <DocMdx content={Content} />
      <DocNext
        description="Understand the project-local workflows, context, and read-only connections that keep agent work grounded."
        href="/docs/ai/"
        label="Agent workflows"
      />
    </DocArticle>
  );
}

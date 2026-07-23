import { createFileRoute } from "@tanstack/react-router";

import Content from "../../content/docs/getting-started.mdx";
import { DocArticle, DocMdx, DocNext } from "../components/docs-shell";
import { pageHead } from "../seo";

const description =
  "Create an AI-ready Drever project, write the first slides, and deliver a static site or PDF.";

export const Route = createFileRoute("/docs/getting-started")({
  component: Page,
  head: () => pageHead("Getting started", description, "/docs/getting-started"),
});

function Page() {
  return (
    <DocArticle description={description} eyebrow="Start" title="Getting started">
      <DocMdx content={Content} />
      <DocNext
        description="Keep zero config or choose the exact project controls you need."
        href="/docs/configuration"
        label="Configuration"
      />
    </DocArticle>
  );
}

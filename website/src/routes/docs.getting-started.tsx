import { createFileRoute } from "@tanstack/react-router";

import Content from "../../content/docs/getting-started.mdx";
import { AIHandoff } from "../components/ai-handoff";
import { DocArticle, DocMdx, DocNext, ManualSetup } from "../components/docs-shell";
import { pageHead } from "../seo";

const description =
  "Tell your AI agent what the presentation must achieve. It prepares, creates, checks, and leaves the deck ready to review.";

export const Route = createFileRoute("/docs/getting-started")({
  component: Page,
  head: () => pageHead("Getting started", description, "/docs/getting-started"),
});

function Page() {
  return (
    <DocArticle compact description={description} eyebrow="Start" title="Start with one sentence">
      <AIHandoff />
      <DocMdx content={Content} />
      <ManualSetup />
      <DocNext
        description="Keep zero config or choose the exact project controls you need."
        href="/docs/configuration/"
        label="Configuration"
      />
    </DocArticle>
  );
}

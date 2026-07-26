import { createFileRoute } from "@tanstack/react-router";

import Content from "../../content/docs/getting-started.mdx";
import { AIHandoff } from "../components/ai-handoff";
import { DocArticle, DocMdx, DocNext, ManualSetup } from "../components/docs-shell";
import { pageHead } from "../seo";

const description =
  "Tell your AI agent what the presentation must achieve. It opens an early live draft, keeps refining it, and finishes with a verified deck.";

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
        description="See how project-local skills, live context, and optional MCP keep AI work grounded."
        href="/docs/ai/"
        label="AI workflows"
      />
    </DocArticle>
  );
}

import { createFileRoute } from "@tanstack/react-router";

import Content from "../../content/docs/getting-started.mdx";
import { AIHandoff } from "../components/ai-handoff";
import { DocArticle, DocMdx, DocNext, ManualSetup } from "../components/docs-shell";
import { pageHead } from "../seo";

const description =
  "Start from one sentence, answer useful questions in a local creation room, approve the content Storyboard, then refine one live draft into a verified deck.";

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

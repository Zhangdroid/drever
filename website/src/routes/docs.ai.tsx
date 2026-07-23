import { createFileRoute } from "@tanstack/react-router";

import Content from "../../content/docs/ai.mdx";
import { DocArticle, DocMdx } from "../components/docs-shell";
import { pageHead } from "../seo";

const description =
  "Use project-local skills, exact JSON authoring context, the live presentation position, and optional read-only MCP.";

export const Route = createFileRoute("/docs/ai")({
  component: Page,
  head: () => pageHead("AI workflows", description, "/docs/ai"),
});

function Page() {
  return (
    <DocArticle description={description} eyebrow="Start" title="AI workflows">
      <DocMdx content={Content} />
    </DocArticle>
  );
}

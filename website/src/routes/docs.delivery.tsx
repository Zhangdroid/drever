import { createFileRoute } from "@tanstack/react-router";

import Content from "../../content/docs/delivery.mdx";
import { DocArticle, DocMdx, DocNext } from "../components/docs-shell";
import { pageHead } from "../seo";

const description =
  "Run evidence-based source checks, create a static deployment, and export exact slide or Step states to PDF.";

export const Route = createFileRoute("/docs/delivery")({
  component: Page,
  head: () => pageHead("Build and export", description, "/docs/delivery"),
});

function Page() {
  return (
    <DocArticle description={description} eyebrow="Deliver" title="Build and export">
      <DocMdx content={Content} />
      <DocNext
        description="Give Codex or Claude exact, versioned context for creation and review."
        href="/docs/ai"
        label="AI workflows"
      />
    </DocArticle>
  );
}

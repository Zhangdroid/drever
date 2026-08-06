import { createFileRoute } from "@tanstack/react-router";

import Content from "../../content/docs/delivery.mdx";
import { DocArticle, DocMdx, DocNext } from "../components/docs-shell";
import { pageHead } from "../seo";

const description =
  "Build and deploy the reviewed static presentation, or export exact slide and Step states to PDF from the same project.";

export const Route = createFileRoute("/docs/delivery")({
  component: Page,
  head: () => pageHead("Build, deploy, and export", description, "/docs/delivery"),
});

function Page() {
  return (
    <DocArticle description={description} eyebrow="Deliver" title="Build, deploy, and export">
      <DocMdx content={Content} />
      <DocNext
        description="Find exact syntax, options, defaults, and the guide that owns each workflow."
        href="/docs/commands/"
        label="Command reference"
      />
    </DocArticle>
  );
}

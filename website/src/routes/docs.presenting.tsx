import { createFileRoute } from "@tanstack/react-router";

import Content from "../../content/docs/presenting.mdx";
import { DocArticle, DocMdx, DocNext } from "../components/docs-shell";
import { pageHead } from "../seo";

const description =
  "Use Audience, Speaker, and Document views with exact routes, rehearsal context, and synchronized focus tools.";

export const Route = createFileRoute("/docs/presenting")({
  component: Page,
  head: () => pageHead("Presenting", description, "/docs/presenting"),
});

function Page() {
  return (
    <DocArticle description={description} eyebrow="Deliver" title="Presenting">
      <DocMdx content={Content} />
      <DocNext
        description="Check the source, deploy the static site, and export selected PDF states."
        href="/docs/delivery/"
        label="Build, deploy, and export"
      />
    </DocArticle>
  );
}

import { createFileRoute } from "@tanstack/react-router";

import Content from "../../content/docs/configuration.mdx";
import { DocArticle, DocMdx, DocNext } from "../components/docs-shell";
import { pageHead } from "../seo";

const description =
  "Configure the Drever entry, canvas, theme, server, build, rehearsal, focus tools, Stage, and plugins.";

export const Route = createFileRoute("/docs/configuration")({
  component: Page,
  head: () => pageHead("Configuration", description, "/docs/configuration"),
});

function Page() {
  return (
    <DocArticle description={description} eyebrow="Reference" title="Configuration">
      <DocMdx content={Content} />
      <DocNext
        description="Meet the people, projects, and open-source foundations behind Drever."
        href="/docs/credits/"
        label="Credits"
      />
    </DocArticle>
  );
}

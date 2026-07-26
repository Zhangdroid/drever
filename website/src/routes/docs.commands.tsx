import { createFileRoute } from "@tanstack/react-router";

import Content from "../../content/docs/commands.mdx";
import { DocArticle, DocMdx, DocNext } from "../components/docs-shell";
import { pageHead } from "../seo";

const description =
  "Find every Drever command, option, default, and the detailed guide that owns its behavior.";

export const Route = createFileRoute("/docs/commands")({
  component: Page,
  head: () => pageHead("Command reference", description, "/docs/commands"),
});

function Page() {
  return (
    <DocArticle description={description} eyebrow="Reference" title="Command reference">
      <DocMdx content={Content} />
      <DocNext
        description="Set the entry, canvas, Theme, server, build, rehearsal, focus tools, Stage, and plugins."
        href="/docs/configuration/"
        label="Configuration"
      />
    </DocArticle>
  );
}

import { createFileRoute } from "@tanstack/react-router";

import Content from "../../content/docs/themes.mdx";
import { DocArticle, DocMdx, DocNext } from "../components/docs-shell";
import { pageHead } from "../seo";

const description =
  "Choose Default, Editorial, or Studio, use semantic layouts, and keep theme, plugin, and Stage responsibilities clear.";

export const Route = createFileRoute("/docs/themes")({
  component: Page,
  head: () => pageHead("Themes", description, "/docs/themes"),
});

function Page() {
  return (
    <DocArticle description={description} eyebrow="Create" title="Themes">
      <DocMdx content={Content} />
      <DocNext
        description="Add build and runtime capability through one typed extension model."
        href="/docs/plugins"
        label="Plugins"
      />
    </DocArticle>
  );
}

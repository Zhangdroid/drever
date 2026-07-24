import { createFileRoute } from "@tanstack/react-router";

import Content from "../../content/docs/plugins.mdx";
import { PluginGallery } from "../components/doc-showcase";
import { DocArticle, DocMdx, DocNext } from "../components/docs-shell";
import { pageHead } from "../seo";

const description =
  "Use default GFM, Shiki, and Tailwind CSS; opt into Math, Charts, and Media; or add typed build and runtime capabilities.";

export const Route = createFileRoute("/docs/plugins")({
  component: Page,
  head: () => pageHead("Plugins", description, "/docs/plugins"),
});

function Page() {
  return (
    <DocArticle compact description={description} eyebrow="Create" title="Plugins" wide>
      <PluginGallery />
      <DocMdx content={Content} />
      <DocNext
        description="Navigate, annotate, rehearse, and share the exact moment."
        href="/docs/presenting/"
        label="Presenting"
      />
    </DocArticle>
  );
}

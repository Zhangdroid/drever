import { createFileRoute } from "@tanstack/react-router";

import Content from "../../content/docs/themes.mdx";
import { ThemeGallery } from "../components/doc-showcase";
import { DocArticle, DocMdx, DocNext } from "../components/docs-shell";
import { pageHead } from "../seo";

const description =
  "Generate subject-led art direction, persist it as a deterministic Theme, and use eight official design studies as references or fallbacks.";

export const Route = createFileRoute("/docs/themes")({
  component: Page,
  head: () => pageHead("Art direction", description, "/docs/themes"),
});

function Page() {
  return (
    <DocArticle
      compact
      description={description}
      eyebrow="Create"
      title="Art direction & themes"
      wide
    >
      <ThemeGallery />
      <DocMdx content={Content} />
      <DocNext
        description="Add build and runtime capability through one typed extension model."
        href="/docs/plugins"
        label="Plugins"
      />
    </DocArticle>
  );
}

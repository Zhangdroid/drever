import { createFileRoute } from "@tanstack/react-router";

import Content from "../../content/docs/motion.mdx";
import { DocArticle, DocMdx, DocNext } from "../components/docs-shell";
import { pageHead } from "../seo";

const description =
  "Describe why content changes, then let the active theme give that relationship a fitting motion voice.";

export const Route = createFileRoute("/docs/motion")({
  component: Page,
  head: () => pageHead("Motion", description, "/docs/motion"),
});

function Page() {
  return (
    <DocArticle description={description} eyebrow="Create" title="Motion with a reason">
      <DocMdx content={Content} />
      <DocNext
        description="Choose a complete visual voice and its semantic layout recipes."
        href="/docs/themes"
        label="Themes"
      />
    </DocArticle>
  );
}

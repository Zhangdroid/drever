import { createFileRoute } from "@tanstack/react-router";

import Content from "../../content/docs/motion.mdx";
import { MotionRecipeGallery } from "../components/doc-showcase";
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
    <DocArticle
      compact
      description={description}
      eyebrow="Create"
      title="Motion with a reason"
      wide
    >
      <MotionRecipeGallery />
      <DocMdx content={Content} />
      <DocNext
        description="Derive a visual voice from the subject and persist it as a Theme contract."
        href="/docs/themes/"
        label="Art direction"
      />
    </DocArticle>
  );
}

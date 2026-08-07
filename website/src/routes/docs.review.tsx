import { createFileRoute } from "@tanstack/react-router";

import Content from "../../content/docs/review.mdx";
import { DocArticle, DocMdx, DocNext } from "../components/docs-shell";
import { pageHead } from "../seo";

const description =
  "Check authored source and every exact rendered Step for clipping, overflow, overlap, contrast, unstable geometry, unsafe text, density, and moving backgrounds.";

export const Route = createFileRoute("/docs/review")({
  component: Page,
  head: () => pageHead("Rendered review", description, "/docs/review"),
});

function Page() {
  return (
    <DocArticle description={description} eyebrow="Review" title="Review with evidence">
      <DocMdx content={Content} />
      <DocNext
        description="Navigate, annotate, rehearse, and share the exact moment with the audience and speaker surfaces."
        href="/docs/presenting/"
        label="Presenting"
      />
    </DocArticle>
  );
}

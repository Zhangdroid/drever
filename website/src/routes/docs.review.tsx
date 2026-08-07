import { createFileRoute } from "@tanstack/react-router";

import Content from "../../content/docs/review.mdx";
import { DocGuideMap } from "../components/doc-guide-map";
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
    <DocArticle compact description={description} eyebrow="Review" title="Review with evidence">
      <DocGuideMap
        items={[
          {
            description: "Catch structural defects before opening a browser.",
            href: "#source-check",
            label: "Check the source",
          },
          {
            description: "Inspect every exact slide and Step state.",
            href: "#rendered-check",
            label: "Render the states",
          },
          {
            description: "Keep settled frames and transitions with the report.",
            href: "#evidence",
            label: "Preserve evidence",
          },
          {
            description: "Use diagnostics as proof, not as a taste score.",
            href: "#judgment",
            label: "Apply judgment",
          },
        ]}
        sequence="Source → browser → evidence → judgment"
      />
      <DocMdx content={Content} />
      <DocNext
        description="Navigate, annotate, rehearse, and share the exact moment with the audience and speaker surfaces."
        href="/docs/presenting/"
        label="Presenting"
      />
    </DocArticle>
  );
}

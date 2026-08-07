import { createFileRoute } from "@tanstack/react-router";

import Content from "../../content/docs/delivery.mdx";
import { DocGuideMap } from "../components/doc-guide-map";
import { DocArticle, DocMdx, DocNext } from "../components/docs-shell";
import { pageHead } from "../seo";

const description =
  "Build and deploy the reviewed static presentation, or export exact slide and Step states to PDF from the same project.";

export const Route = createFileRoute("/docs/delivery")({
  component: Page,
  head: () => pageHead("Build, deploy, and export", description, "/docs/delivery"),
});

function Page() {
  return (
    <DocArticle
      compact
      description={description}
      eyebrow="Deliver"
      title="Build, deploy, and export"
    >
      <DocGuideMap
        items={[
          {
            description: "Carry the reviewed project into production unchanged.",
            href: "#review-first",
            label: "Start from review",
          },
          {
            description: "Create one portable static presentation.",
            href: "#static-build",
            label: "Build the site",
          },
          {
            description: "Publish the same artifact on a static host.",
            href: "#deploy",
            label: "Choose a host",
          },
          {
            description: "Capture exact slide or Step states for handoff.",
            href: "#pdf-export",
            label: "Export the PDF",
          },
        ]}
        sequence="Review → build → publish → export"
      />
      <DocMdx content={Content} />
      <DocNext
        description="Find exact syntax, options, defaults, and the guide that owns each workflow."
        href="/docs/commands/"
        label="Command reference"
      />
    </DocArticle>
  );
}

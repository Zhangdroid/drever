import { createFileRoute } from "@tanstack/react-router";

import Content from "../../content/docs/authoring.mdx";
import { DocGuideMap } from "../components/doc-guide-map";
import { DocArticle, DocMdx, DocNext } from "../components/docs-shell";
import { pageHead } from "../seo";

const description =
  "Use readable MDX for the story, precise Step state for pacing, and React only where the idea needs behavior.";

export const Route = createFileRoute("/docs/authoring")({
  component: Page,
  head: () => pageHead("Authoring slides", description, "/docs/authoring"),
});

function Page() {
  return (
    <DocArticle compact description={description} eyebrow="Create" title="Authoring slides">
      <DocGuideMap
        items={[
          {
            description: "Keep the story readable before adding behavior.",
            href: "#why-mdx",
            label: "Shape the source",
          },
          {
            description: "Turn pacing into exact, addressable state.",
            href: "#steps",
            label: "Control the reveal",
          },
          {
            description: "Separate private guidance from public output.",
            href: "#speaker-notes",
            label: "Add speaker context",
          },
          {
            description: "Reach for React only when the idea needs it.",
            href: "#react-components",
            label: "Introduce behavior",
          },
        ]}
        sequence="Source → pacing → context → behavior"
      />
      <DocMdx content={Content} />
      <DocNext
        description="Derive a visual voice from the subject and persist it as a Theme contract."
        href="/docs/themes/"
        label="Art direction"
      />
    </DocArticle>
  );
}

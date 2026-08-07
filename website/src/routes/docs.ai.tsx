import { createFileRoute } from "@tanstack/react-router";

import Content from "../../content/docs/ai.mdx";
import { DocGuideMap } from "../components/doc-guide-map";
import { DocArticle, DocMdx, DocNext } from "../components/docs-shell";
import { pageHead } from "../seo";

const description =
  "Use versioned project workflows, exact JSON context, the live presentation position, and optional read-only MCP without hiding the source.";

export const Route = createFileRoute("/docs/ai")({
  component: Page,
  head: () => pageHead("Agent workflows", description, "/docs/ai"),
});

function Page() {
  return (
    <DocArticle compact description={description} eyebrow="Create" title="Agent workflows">
      <DocGuideMap
        items={[
          {
            description: "Enter from any coding agent with one public handoff.",
            href: "#public-handoff",
            label: "Start the work",
          },
          {
            description: "Keep behavior versioned beside the presentation.",
            href: "#agent-first",
            label: "Own the workflow",
          },
          {
            description: "Give the agent resolved project facts before internals.",
            href: "#authoring-context",
            label: "Resolve context",
          },
          {
            description: "Use only the connection the current task needs.",
            href: "#boundaries",
            label: "Choose the boundary",
          },
        ]}
        sequence="Handoff → workflow → context → connection"
      />
      <DocMdx content={Content} />
      <DocNext
        description="Shape the story with readable MDX, exact Steps, Notes, and focused React components."
        href="/docs/authoring/"
        label="Authoring slides"
      />
    </DocArticle>
  );
}

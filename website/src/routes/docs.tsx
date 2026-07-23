import { createFileRoute } from "@tanstack/react-router";

import { DocsShell } from "../components/docs-shell";

export const Route = createFileRoute("/docs")({
  component: DocsShell,
});

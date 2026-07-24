import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/themes")({
  beforeLoad: ({ location }) => {
    throw redirect({ hash: location.hash, replace: true, to: "/showcase/" });
  },
});

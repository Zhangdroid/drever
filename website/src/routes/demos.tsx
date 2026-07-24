import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/demos")({
  beforeLoad: () => {
    throw redirect({ replace: true, to: "/showcase/" });
  },
});

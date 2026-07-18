# @drever/client

Modern-browser audience and speaker runtimes for compiled Drever presentations.
Generated Drever clients select `createViewer` for audience paths and
`createSpeaker` for `/speaker` paths; deck authors normally let the `drever` CLI
create that bootstrap.

```tsx
import { createViewer } from "@drever/client";
import "@drever/client/styles.css";
import Content, { deckManifest } from "./slides.mdx";

const container = document.querySelector("#app");
if (!(container instanceof HTMLElement)) {
  throw new Error('Expected an HTMLElement matching "#app".');
}

const viewer = await createViewer({
  baseURL: new URL("/", document.URL), // The deck's mount, not its current deep URL.
  Content,
  container,
  manifest: deckManifest,
});
await viewer.navigate({ type: "next" });
```

The viewer owns canvas scaling, exact Step navigation, clean path/history state,
an accessible audience command bar and slide navigator, keyboard controls,
element-scoped View Transitions, runtime setup, and teardown.
`createSpeaker` adds current/next previews, compiled notes, a timer, controls,
and `BroadcastChannel` synchronization with audience windows. The audience
runtime opens the equivalent speaker path when the user presses `P`.

The package targets current browsers and intentionally requires the Navigation
API, `Element.startViewTransition`, `BroadcastChannel`, and `ResizeObserver`
instead of shipping legacy fallbacks. Deterministic export remains a separate
product slice.

## Status

Version `0.0.0` is part of Drever's from-first-principles rewrite. The API is
under active development and is not yet stable for production use.

For the generated application entry, browser contract, and development setup,
see the Drever main project repository.

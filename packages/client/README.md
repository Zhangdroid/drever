# @drever/client

Modern-browser audience, speaker, and export runtimes for compiled Drever presentations.
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

`createExport` renders one raw canvas-sized page per slide at its final Step by
default. Pass `includeSteps: true` to include Step 0 and every exact authored
Step stop. It runs exporter-only plugin setup, verifies loaded fonts, decodes
authored images, rejects duplicate DOM IDs, then waits for two animation frames before publishing
`data-drever-export-status="ready"` on the document root. Failures publish a
JSON diagnostic through `data-drever-export-error`, including plugin owner,
capability, and module context when available. The export surface inherits the
active theme while disabling animation, transitions, and View Transition names.

Repeated page components should use React `useId`. Export plugins must await CSS
backgrounds, canvas rendering, video posters, and dynamically created resources
inside `exportSetup`; those resources are not directly observable as authored
images.

```tsx
import { createExport } from "@drever/client";
import { runExportSetup } from "virtual:drever/export-runtime";

const result = await createExport({
  Content,
  container,
  manifest: deckManifest,
  runExportSetup,
});
```

The package targets current browsers and intentionally requires the Navigation
API, `Element.startViewTransition`, `BroadcastChannel`, and `ResizeObserver`
instead of shipping legacy fallbacks. Export readiness similarly depends on
modern `FontFaceSet`, image decoding, and animation-frame APIs.

## Status

Version `0.0.0` is part of Drever's from-first-principles rewrite. The API is
under active development and is not yet stable for production use.

For the generated application entry, browser contract, and development setup,
see the Drever main project repository.

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
  focusTools: {
    pen: { color: "#ff4f8b", width: 8 },
    highlighter: { color: "#d5ff3f", opacity: 0.32, width: 34 },
    laser: { color: "#ff2e6f" },
  },
  manifest: deckManifest,
});
await viewer.navigate({ type: "next" });
```

The viewer owns canvas scaling, exact Step navigation, clean path/history state,
an accessible audience command bar and slide navigator, keyboard controls,
deck-scoped View Transitions, runtime setup, and teardown.
Its Copy link control writes the canonical URL for the committed slide and Step
while preserving query and hash state. It requires the Clipboard API in a
secure context and reports a clear error instead of using a legacy fallback.

The audience command bar also opens Focus Tools for pointer, touch, and stylus
input. Press `L` for Laser, `I` for Pen (ink), or `H` for Highlighter. Pressing
the active tool's shortcut again turns it off. Choosing a tool closes its palette,
and the command bar yields while the presenter draws. Completed ink can be
undone or cleared. Ink remains visible across Step changes on the same slide and
clears when the slide changes.
The laser is transient. The overlay is mounted inside `.drever-canvas`, above
the Stage but outside `.drever-deck`, so it never enters the deck-scoped View
Transition. `focusTools` sets per-viewer appearance, while themes and project
styles provide fallback colors, widths, and highlighter opacity through the
documented `--drever-focus-*` CSS variables.

`createSpeaker` adds current/next previews, compiled notes, a searchable slide
navigator, rehearsal controls, and `BroadcastChannel` position synchronization
with audience windows. Its session-local clock reports total and current-slide
time plus accumulated time and visit counts per slide. The speaker can pause,
resume, reset, and edit or clear an optional target. When a target exists,
Drever assigns it across the deck's exact Slide and Step states and reports
whether the current rehearsal is ahead, on pace, or behind that state's time
window. Timings and target edits are not persisted or broadcast, and transition
readiness is not yet a remote contract. The speaker also provides Laser, Pen,
Highlighter, Undo, and Clear controls over its current preview. Their actions
synchronize through `BroadcastChannel`: persistent ink remains across Steps on
the current slide and is included in a late-audience snapshot, while Laser stays
transient and visible only at the matching exact Slide and Step. The audience
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
API, `Document.startViewTransition`, `Element.startViewTransition`,
`BroadcastChannel`, and `ResizeObserver` instead of shipping legacy fallbacks.
Export readiness similarly depends on modern `FontFaceSet`, image decoding, and
animation-frame APIs.

Clipboard support is required only when Copy link is selected. If
`navigator.clipboard.writeText()` is unavailable or rejects the write, the
viewer reports the failure; it never substitutes `document.execCommand()`.

## Status

Version `0.0.0` is part of Drever's from-first-principles rewrite. The API is
under active development and is not yet stable for production use.

For the generated application entry, browser contract, and development setup,
see the Drever main project repository.

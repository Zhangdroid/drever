# Drever basic demo

A five-slide, network-free deck that exercises Drever's primary authoring and
runtime paths:

- semantic `Cover` and `TwoColumn` layouts from the default theme;
- sparse `Step` stops at 2 and 5;
- browser history and exact path URLs;
- an interactive React counter whose state survives inactive slides;
- speaker-only `Note` content;
- a speaker view with audience-window synchronization;
- five-page final-state and seven-page sparse-Step PDF exports.

## Run from this workspace

Build the workspace packages once, then start the demo through its workspace
script:

```sh
vp run -r build
vp run -F @drever/example-basic dev
```

Open <http://localhost:4317>. Use the arrow keys to navigate, or click **Add
one** on the fourth slide and navigate away and back to see React state
preservation.
Open <http://localhost:4317/2/5> directly to verify that a sparse Step deep link
also survives a reload.
Open <http://localhost:4317/speaker> to use the speaker view; its controls,
keyboard navigation, and URL keep any open audience window synchronized through
the browser's native `BroadcastChannel`. The dev command prints this URL, and
pressing `P` from the audience opens the speaker view at the current slide and Step.

The production path uses the same deck and configuration:

```sh
vp run -F @drever/example-basic build
vp run -F @drever/example-basic export
```

The export command writes `slides-export.pdf`. Add `-- --steps` to include Step
0, 2, and 5 for the progressive slide. Install its browser once with
`npx playwright install chromium`.

The root development shortcut is `vp run demo`; the production command is
shown above. From this directory, `vp run dev` and `vp run build` are equivalent.

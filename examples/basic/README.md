# Drever basic demo

A five-slide, network-free deck that exercises Drever's primary authoring and
runtime paths:

- semantic `Cover` and `TwoColumn` layouts from the Basic theme;
- sparse `Step` stops at 2 and 5;
- browser history and exact path URLs;
- an interactive React counter whose state survives inactive slides;
- speaker-only `Note` content;
- a speaker view with a five-minute rehearsal target, per-slide timing, and
  audience-window synchronization;
- canonical current-state link copying from the audience controls;
- a searchable `/document` view with every Step revealed;
- a clean source-based accessibility report;
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
the browser's native `BroadcastChannel`. The rehearsal panel starts with the
five-minute target from `drever.config.ts` and tracks each slide visit. The dev
command prints this URL, and pressing `P` from the audience opens the speaker
view at the current slide and Step. Use **Copy link** in the audience control bar
to copy that exact slide and Step URL.
Open <http://localhost:4317/document>, or press `D`, for the complete scrollable
reading view.

The production path uses the same deck and configuration:

```sh
vp run -F @drever/example-basic check
vp run -F @drever/example-basic build
vp run -F @drever/example-basic export
```

The check command emits a zero-error JSON report for use by CI or an AI review
loop. It requires no browser or development server.

The export command writes `slides-export.pdf`. Add `-- --slides 2 --steps` to
export only the progressive slide at Step 0, 2, and 5. Install its browser once
with `npx playwright install chromium`.

The root development shortcut is `vp run demo`; the production command is
shown above. From this directory, `vp run dev` and `vp run build` are equivalent.

# Drever product tour

A sixteen-slide, network-free product story for people meeting Drever for the
first time. It follows one concrete launch decision from the local creation
room through content-first Storyboard approval, an early complete Draft 1,
human direction, rendered review, a live room response, requested evidence, an
explicit decision, exact-state sharing, and post-meeting reading.

The deck demonstrates:

- a natural-language brief becoming explicit presentation constraints in Studio;
- one topic-specific direction question changing the evidence and decision beats;
- content-first Storyboard approval before per-slide layout and motion;
- an early complete Draft 1 with speaker notes, public agent activity, and
  slide- or deck-scoped feedback;
- rendered review across every exact Step and both transition directions;
- React interaction whose room response remains available to later slides;
- a concrete concern-to-proof-to-decision sequence rather than a feature inventory;
- stable continuity as the requested proof moves through audience, decision,
  speaker, exact-link, and document contexts;
- the exact `/9/2` evidence state, clean path URLs, and canonical link copying;
- the searchable, fully revealed `/document` reading view;
- speaker notes, focus tools, and the `/speaker` rehearsal view with a
  20-minute target;
- one editable story projected into audience, speaker, document, and export
  surfaces.

All visuals are CSS and local React components. There are no fonts, images,
analytics, or network requests.

## Run

From the repository root, build workspace packages once and start this deck:

```sh
vp run -r build
vp run -F @drever/example-product-tour dev
```

Use `vp run demo:showcases` instead when presenting the closing links to the
Feature Gallery and Motion Recipes decks.

Open <http://localhost:4320>. Press `P` at any point to open the synchronized
speaker view, or visit <http://localhost:4320/speaker> directly. Press `D`, or
visit <http://localhost:4320/document>, to read and search the complete deck.
The audience command bar can also copy the canonical URL for the exact visible
slide and Step.

Create the static production artifact with:

```sh
vp run -F @drever/example-product-tour check
vp run -F @drever/example-product-tour build
```

The preflight reads authored MDX and returns a clean, machine-readable
accessibility report without starting the presentation server.

## Delivery notes

The second slide turns a plain-language outcome into explicit presentation
constraints. The next five slides show topic-specific direction, content-first
approval, an early complete Draft 1, human feedback, and rendered evidence.
Then choose a room response on slide eight. Slide nine acknowledges that concern
before revealing the requested proof; slide ten keeps the proof visible while
the room records its decision.

Press `P` on slide eleven to open the real speaker surface. Slide twelve links
back to the exact requested evidence state, while slide thirteen turns the same evidence into a real
`/document` reading surface. Slides fourteen and fifteen keep one story core stable
while the related headline changes from “made once” to “alive everywhere” and
its audience, speaker, document, and export surfaces appear. The final slide
links to Getting Started, Motion Stories, and the Feature Gallery. Speaker
guidance for every slide is authored in `<Note>` and intentionally absent from
the audience DOM.

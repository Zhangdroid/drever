# Drever product tour

A nine-slide, network-free product story for people meeting Drever for the
first time. It follows one concrete launch decision from the local creation
room through content-first Storyboard approval, an early complete Draft 1,
human direction, rendered review, a live room response, requested evidence, an
explicit decision, and four useful delivery surfaces.

The deck demonstrates:

- a natural-language brief becoming explicit presentation constraints in Studio;
- one topic-specific direction question changing the evidence and decision beats;
- content-first Storyboard approval before per-slide layout and motion;
- an early complete Draft 1 with speaker notes, public agent activity, and
  slide- or deck-scoped feedback;
- rendered review across every exact Step and both transition directions;
- React interaction whose room response remains available to later slides;
- a concrete concern-to-proof-to-decision sequence rather than a feature inventory;
- one deliberate continuity handoff as the requested proof moves from the
  decision into audience, speaker, exact-link, and document contexts;
- the exact `/7/2` evidence state, clean path URLs, and canonical link copying;
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

Slide two turns a plain-language outcome into one topic-specific direction
question. Slide three locks a content-first Storyboard; slide four unfolds a
complete Draft 1; slide five keeps human direction and rendered evidence beside
the same live preview. Choose a room response on slide six. Slide seven reveals
the requested proof before recording the decision, and slide eight carries that
same proof into Audience, Speaker, exact-link, and Document contexts. The final
slide links to Getting Started, Motion Stories, and the Feature Gallery.

Press `P` at any point to open the real speaker surface, or `D` to open the real
`/document` reading surface. Speaker guidance for every slide is authored in
`<Note>` and intentionally absent from the audience DOM.

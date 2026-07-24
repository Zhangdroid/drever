# Drever product tour

A twelve-slide, network-free product story for people meeting Drever for the
first time. It follows one concrete launch decision from a plain-language AI
brief through human direction, a live room response, requested evidence, an
explicit decision, exact-state sharing, and post-meeting reading.

The deck demonstrates:

- a natural-language brief becoming an editable presentation route;
- human direction added to an AI-authored outline with an addressable `Step`;
- React interaction whose room response remains available to later slides;
- a concrete concern-to-proof-to-decision sequence rather than a feature inventory;
- stable continuity as the requested proof moves through audience, decision,
  speaker, exact-link, and document contexts;
- the exact `/5/2` evidence state, clean path URLs, and canonical link copying;
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

The second slide turns a plain-language prompt into explicit presentation
constraints. Advance once on slide three to direct the AI-authored route, then
choose a room response on slide four. Slide five acknowledges that concern
before revealing the requested proof at `/5/2`; slide six keeps the proof
visible while the room records its decision.

Press `P` on slide seven to open the real speaker surface. Slide eight links
back to `/5/2`, while slide nine turns the same evidence into a real
`/document` reading surface. Slides ten and eleven keep one story core stable
while the related headline changes from “made once” to “alive everywhere” and
its audience, speaker, document, and export surfaces appear. The final slide
links to Getting Started, Motion Stories, and the Feature Gallery. Speaker
guidance for every slide is authored in `<Note>` and intentionally absent from
the audience DOM.

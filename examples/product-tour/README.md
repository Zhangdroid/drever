# Drever product tour

An eleven-slide, network-free introduction for people evaluating Drever. It tells a
single story: AI made slide production cheap, so Drever focuses on the remaining
work—taste, timing, interaction, and trustworthy delivery.

The deck demonstrates:

- the official Editorial theme through its `Masthead` and `Feature` layouts;
- the MDX, `---`, `Step`, and `Note` authoring contract;
- default build-time Shiki highlighting and reset-free Tailwind utilities;
- accumulated Step states, clean path URLs, and canonical link copying;
- React interaction whose state survives inactive slides;
- React-owned motion with a stable stage boundary;
- the searchable, fully revealed `/document` reading view;
- speaker notes and the `/speaker` rehearsal view with a 20-minute target;
- the AI-first write, inspect, test, build, and deploy loop.

All visuals are CSS and local React components. There are no fonts, images,
analytics, or network requests.

## Run

From the repository root, build workspace packages once and start this deck:

```sh
vp run -r build
vp run -F @drever/example-product-tour dev
```

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

The fifth slide contains the main audience interaction. Change its signal,
navigate away, and return to show preserved React state. On the seventh slide,
use the local control before advancing to distinguish component interaction from
Drever's slide navigation transition. Speaker guidance for every slide
is authored in `<Note>` and intentionally absent from the audience DOM.

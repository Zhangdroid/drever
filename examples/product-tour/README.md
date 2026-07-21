# Drever product tour

An eleven-slide, network-free product story for people meeting Drever for the first
time. It follows one launch decision from an AI-assisted brief through live interaction,
speaker context, exact-state sharing, and post-meeting reading.

The deck demonstrates:

- the official Editorial theme through its `Masthead` and `Feature` layouts;
- the MDX, `---`, `Step`, and `Note` authoring contract behind a user-facing story;
- accumulated Step states, clean path URLs, and exact-moment link copying;
- React interaction whose state survives inactive slides;
- content-driven local motion with a stable stage boundary;
- the searchable, fully revealed `/document` reading view;
- speaker notes, focus tools, and the `/speaker` rehearsal view with a 20-minute target;
- one editable project projected into audience, speaker, and document surfaces.

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

The third slide contains the main audience interaction; change its signal, navigate away,
and return to show preserved React state. The fourth slide reveals three addressable
Steps. On the fifth, use the local control to show motion following a changing idea while
the global stage remains calm. Press `P` on the sixth slide to open the speaker surface,
or `D` on the eighth to turn the post-meeting promise into a real document. Slides nine
and ten deliberately spend their entire motion budget on one related headline change;
the shared project card and brand decoration remain still. Speaker guidance for every
slide is authored in `<Note>` and intentionally absent from the audience DOM.

# Drever architecture tour

An eleven-slide, network-free technical narrative about why Drever is designed
the way it is. It follows information from MDX source through Deck IR, compile
planning, protected extension phases, the manifest, navigation, browser runtime,
and static delivery.

This is not an API inventory. Its recurring argument is that audience view,
speaker view, URLs, build artifacts, diagnostics, and tests must agree on one
semantic deck.

The deck uses the official `@drever/designs/studio` study, then adds only the
diagram-specific styles needed by its local interactive models.

Two local React tools make important contracts inspectable:

- **Artifact Explorer** follows the same idea through source, IR, manifest, and
  runtime projections.
- **Route Compiler** turns a surface, slide, and sparse Step into both a canonical
  URL and its materialized static file.

All diagrams use HTML and CSS. The deck has no external images, fonts, or network
dependencies.

## Run

From the repository root, build workspace packages once and start the deck:

```sh
vp run -r build
vp run -F @drever/example-architecture dev
```

Open <http://localhost:4321>. The synchronized speaker view is available at
<http://localhost:4321/speaker> or through the `P` shortcut. The fully revealed
document is available at <http://localhost:4321/document> or through `D`.

Create the complete static route tree with:

```sh
vp run -F @drever/example-architecture check
vp run -F @drever/example-architecture build
```

The preflight uses the same compiler-owned source locations as other Drever
diagnostics and runs without a browser or development server.

## Suggested delivery

Advance deliberately through the five compiler phases on slide four. Spend most
of the talk in Artifact Explorer, Route Compiler, and the navigation commit
protocol; those three slides carry the architecture's central contracts. Every
slide includes speaker notes with the intended transition to the next idea.

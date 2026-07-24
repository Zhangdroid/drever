# Drever architecture tour

An eleven-slide visual explanation of the contract that keeps Drever's authored
source, runtime, URLs, static files, and presentation surfaces in agreement.

The deck uses a local **Living Build Graph** design derived from the architecture
cover on the Drever website. A persistent violet topology and one lime signal
connect the story from MDX to audience, speaker, document, and export surfaces.
The diagrams are built with React, SVG, and CSS; they use no network resources.

The route compiler is intentionally interactive. Every other state change uses
Drever Steps so the same narrative remains deterministic in audience, speaker,
document, and export modes.

## Run

From the repository root, build workspace packages once and start the deck:

```sh
vp run -r build
vp run -F @drever/example-architecture dev
```

Open <http://localhost:4321>. Use `P` for speaker view and `D` for the fully
revealed document view.

Build the complete static route tree with:

```sh
vp run -F @drever/example-architecture check
vp run -F @drever/example-architecture build
```

## Suggested delivery

Treat the deck as one causal system, not a package inventory. Advance deliberately
through artifact lineage, the five compiler passes, navigation commit, failure
rollback, and testing boundaries. Each slide includes speaker notes for the
transition to the next architectural decision.

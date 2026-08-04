# Drever architecture tour

A fourteen-slide visual explanation of how an approved story plan becomes a
shared contract, route-selected presentation surfaces, and trustworthy rendered evidence.

The deck uses a local **Living Build Graph** design derived from the architecture
cover on the Drever website. A persistent violet topology and one lime signal
connect plan and Storyboard approval to MDX, Deck IR, the manifest, delivery surfaces,
and rendered evidence. The diagrams are built with React, SVG, and CSS; they use no
network resources.

The route compiler is intentionally interactive. Every other state change uses
Drever Steps so the same narrative remains deterministic in audience, speaker,
document, and export modes.

The example also keeps its approved narrative contract in `drever.plan.json`,
so `/storyboard` and `drever check` exercise the architecture the deck explains.

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
through plan approval, artifact lineage, protected compilation, design evidence, extension
ownership, canonical navigation, route-selected delivery, rendered preflight, failure
rollback, and testing boundaries. Each slide includes speaker notes for the transition
to the next architectural decision.

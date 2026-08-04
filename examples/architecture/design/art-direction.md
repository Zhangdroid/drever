# Architecture deck art direction

## Premise

The deck is a **Living Build Graph**. An approved story plan enters one system, becomes
authored source and a sealed semantic contract, then leaves as route-selected surfaces
and rendered evidence that still agree. The visual language should make approval,
ownership, causality, and shared state visible before it explains packages.

## Visual system

- Use the violet field from the website architecture cover (`#4f3bc0` to `#402f9f`) as
  the continuous environment.
- Use deep-indigo glass only for meaningful system boundaries, not as a card grid.
- Render semantic nodes in white, supporting metadata in lavender, and one active signal
  in lime (`#dbff4f`).
- Reserve amber for a real failure or diagnostic state.
- Use Bricolage Grotesque for claims and Instrument Sans for explanations. Use monospace
  only for authored source, routes, diagnostics, and generated artifacts.
- Keep the persistent topology faint. It becomes prominent only when the graph itself is
  the evidence.

## Composition

- Give every slide one primary visual model: a graph, rail, boundary, route, topology, or
  test ring.
- Pair a concise claim with a mostly visual artifact. Do not place a second prose panel
  beside a text-heavy claim.
- Reuse the same nodes and signal across the story so the audience sees one system being
  resolved, not fourteen unrelated diagrams.
- Prefer connected structures over dashboards, card inventories, and equal-weight grids.
- Show code only when its exact syntax proves the current architectural decision.

## Motion

- Move the lime signal only when causality advances through the build graph.
- Change the persistent background at chapter boundaries, not on every slide.
- Use one primary motion per slide and keep all other changes in the same causal chain.
- Keep endpoint geometry, shadows, text metrics, and path coordinates stable.
- Respect reduced motion and leave deterministic final states for document and export
  surfaces.

## Sources and assets

- Primary source: `website/src/components/showcase-covers.tsx`, architecture cover.
- Supporting design references: the local Studio and Construct design studies.
- No external images, fonts, or third-party visual assets are used. Both font families are
  provided by `@drever/brand`.

## Deliberate fallback choices

- Abstract graph geometry stands in for product screenshots because the subject is an
  invisible compiler contract.
- A quiet grid provides spatial continuity when no subject-specific image is appropriate;
  it must remain subordinate to foreground content.

## Avoid

- Teal or blue accents that compete with the violet-and-lime identity.
- Decorative line movement, neon overload, or cyberpunk styling.
- Shadows appearing from `none`, stretched text, or animated boxes with unstable bounds.
- Tiny architecture labels that cannot be read at presentation distance.
- Background contrast that competes with the current claim.

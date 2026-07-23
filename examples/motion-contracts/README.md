# Drever motion contracts

This internal fifteen-slide reference preserves Drever's native View Transition
geometry contracts and semantic-motion browser fixtures. It is intentionally
network-free and uses Drever primitives, the Editorial theme, canonical Drever
brand tokens and fonts, CSS, and one local SVG.

## Continuity contracts

1. **Fixed shared shell** — an absolutely positioned `440 × 270` shell keeps
   identical endpoint geometry. Copy that changes is ordinary slide content,
   outside the shared raster.
2. **Persistent text identity** — the sentence keeps its `600 × 124` box, font
   family, size, weight, line-height, letter spacing, and wrapping. Only its
   position changes.
3. **Media continuity** — both endpoints declare width, height, a `16 / 9`
   aspect ratio, `object-fit: cover`, and the same focal point. The media frame
   can resize without stretching the image.

These are endpoint contracts, not animation effects. `MotionGroup` supplies one
explicit identity in each pair; CSS makes the two states compatible. The first
eight routes remain the focused geometry reference exercised by the browser
suite.

## Semantic recipes

The second chapter demonstrates the complete authored motion vocabulary:

4. **Focus** — completed decisions remain readable while attention moves down a
   three-step argument.
5. **Replace** — question, evidence, and decision occupy one reserved frame and
   remain exact URL states.
6. **Compare** — a second artifact joins the first because both are required to
   understand the contrast.
7. **Stagger** — four pipeline stages arrive in reading order as one navigation
   moment, not four decorative stops.
8. **Local emphasis** — the slide settles for `900 ms`, then a single marker
   draws behind the phrase that changes the action. Text remains unchanged.
9. **Attention budget** — one primary movement, at most one quieter supporting
   cue, and deliberate stillness everywhere else.

The intent examples use Signal for current state and Continuity for identity and
connection. They keep cards free of clipped shadows, reserve layout before
motion, and show their final state immediately under reduced motion, in speaker
previews, in Document View, and during export.

## Run

Build the workspace packages once, then start the example:

```sh
vp run -r build
vp run -F @drever/example-motion-contracts dev
```

Open <http://localhost:4328>. The continuity contracts occupy paired routes
`/2`–`/7`; advance once, then move backward to inspect each reverse path. The
semantic recipes begin at `/9`. Use the arrow keys to inspect the authored Step
states on the focus, replace, compare, and stagger slides.

To inspect the accessibility path, enable reduced motion in the browser or
operating system. Drever skips View Transition capture and commits the same
destination state immediately. The deck still preserves reading order, content,
and navigation.

## Verification strategy

The companion Playwright specification checks the continuity contracts rather
than screenshot pixels. It verifies endpoint dimensions and style invariants,
observes the named shared transition group in both directions, and confirms that
reduced motion creates no View Transition capture. `drever check` validates the
complete fifteen-slide source and `drever build` compiles every semantic Step
state into the production artifact.

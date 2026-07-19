# Drever motion recipes

This eight-slide deck isolates three contracts that make native View Transitions
predictable. It is intentionally network-free and uses only Drever primitives,
the editorial theme, CSS, and one local SVG.

## Recipes

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
explicit identity in each pair; CSS makes the two states compatible.

## Run

Build the workspace packages once, then start the example:

```sh
vp run -r build
vp run -F @drever/example-motion-recipes dev
```

Open <http://localhost:4322>. Each recipe occupies two adjacent slides. Advance
once, then move backward to inspect the reverse path; a shared transition must be
valid in both directions.

To inspect the accessibility path, enable reduced motion in the browser or
operating system. Drever skips View Transition capture and commits the same
destination state immediately. The deck still preserves reading order, content,
and navigation.

## Verification strategy

The companion Playwright specification checks geometry rather than screenshot
pixels. It verifies endpoint dimensions and style invariants, observes the named
shared transition group in both directions, and confirms that reduced motion
creates no View Transition capture.

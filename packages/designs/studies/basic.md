# Basic

The Basic Drever study is a complete visual baseline for a real presentation,
not a reset stylesheet. It combines decisive typography, a restrained blue
accent, generous spacing, semantic layouts, and motion tuned for Drever's View
Transition navigation.

Treat it as the neutral fallback among Drever's eight official design studies
and as a deterministic Theme contract. The primary authoring workflow derives
art direction from the subject, audience, venue, and source material, then
persists that result locally; Basic is appropriate only when the brief does
not justify a more specific visual premise.

It has no font, image, or component-library dependency. The only browser
runtime dependency is React when a deck uses one of its two layouts.

## Use it

```ts
// drever.config.ts
import theme from "@drever/designs/basic";

export default {
  theme,
};
```

Ordinary Markdown is the default authoring surface:

```mdx
# Build presentations like products

Version them, test them, and deploy them as a web application.

---

## One idea at a time

- A clear claim
- Evidence the audience can inspect
- Motion that explains what changed
```

The theme uses a 1600 × 900 canvas. It styles headings, prose, lists, quotes,
code, images, tables, links, Steps, and MotionGroups without requiring custom
components.

## Layouts

Layouts are for semantic composition, not routine decoration. Prefer Markdown
until a slide has a clear layout need.

### Cover

Use `Cover` once at the start of a talk and optionally for major chapter
breaks. Keep `title` under ten words and `supporting` to one short sentence.

```mdx
<Cover
  eyebrow="Quarterly planning / 2026"
  title="Choose what happens next."
  supporting="The evidence, tradeoffs, and one decision the room can act on."
  footer="Strategy workshop"
  tone="accent"
/>
```

Public props:

- `title`: required content rendered as the slide's `h1`.
- `eyebrow`, `supporting`, and `footer`: optional short content.
- `tone`: `light`, `dark`, or `accent`; defaults to `light`.
- Standard HTML `header` attributes, including `className` and `aria-*`.

### TwoColumn

Use `TwoColumn` for comparison, cause and effect, or a text/visual pair. Do not
use it merely to fit more content on screen.

```mdx
<TwoColumn
  ratio="wide-primary"
  primary={
    <>
      <h2>Before</h2>
      <p>A static file assembled by hand.</p>
    </>
  }
  secondary={
    <>
      <h2>After</h2>
      <p>A living interface with inspectable state.</p>
    </>
  }
/>
```

Public props:

- `primary` and `secondary`: required React/MDX content regions.
- `ratio`: `equal`, `wide-primary`, or `wide-secondary`; defaults to `equal`.
- Standard HTML `div` attributes.

## Motion

Basic supports Drever's complete semantic motion grammar: `focus`, `replace`,
`compare`, `stagger`, and `continuity`. Its mapping uses quiet fades and short
spatial movement so the current decision is clear without competing with the
content. The exported theme definition exposes the same supported intents and
author guidance as JSON-safe metadata.

Intent explains why content moves; optional flow identifies its logical
progression axis; the theme supplies the visual voice. Use `flow="block"` for a
vertical reading order and `flow="inline"` for a horizontal pipeline,
comparison, or successive state, or omit it
to keep Basic's balanced direction. Use direct Step children for focus,
replacement, and comparison. Put a stagger group inside one Step with no more
than four direct children. Continuity alone requires an explicit lowercase
kebab-case name shared by the same object on adjacent slides and rejects flow.

Persistent Stage decoration may make a sparse, quiet shift between selected
slides. Keep that surprise smaller than the content motion and omit it when a
strong reveal or continuity transition already carries the idea. See
[Motion choreography](../../../docs/motion.md) for examples, accessibility
behavior, and the reduced-motion contract.

## AI generation prompt

This can be pasted after the presentation brief:

```text
Use @drever/designs/basic. Give every slide one dominant idea. Prefer ordinary
Markdown. Use Cover only for the opening or a true chapter break, and use
TwoColumn only when the relationship between two ideas is the point. Keep titles
under 10 words, body copy under 45 words per region, and avoid more than one
nested list. Use Step for meaningful progressive disclosure, not for animating
every element. Use MotionGroup only for a supported narrative relationship and
follow its required child shape. Intent says why; set flow="block" for vertical
reading order or flow="inline" for a horizontal pipeline, comparison, or successive state, and
omit flow when the theme default fits. Never set flow on continuity. Keep Stage
motion sparse, quiet, and subordinate to stronger content motion. Prefer one
strong visual over decorative gradients or dense text.
```

The machine-readable `manifest` on the exported theme contains the same art
direction, choices, layout slots, constraints, and examples so an AI tool does
not need to scrape this README.

## Custom accents

Add a later Drever utility stylesheet and override theme variables on the
viewer. Do not modify the package CSS:

```css
.drever-viewer {
  --drever-theme-accent: #d63b20;
  --drever-theme-accent-strong: #942612;
  --drever-theme-accent-soft: #ffe0d8;
}
```

The theme targets current browsers and intentionally uses `color-mix()` and
modern text wrapping without legacy fallbacks. The client starts each native
View Transition on the document while named groups isolate the deck, stable
overlays, and explicit continuity objects. Steps animate in the live DOM, and
persistent headings never receive inferred transition identities.

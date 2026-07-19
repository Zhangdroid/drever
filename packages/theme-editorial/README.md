# @drever/theme-editorial

A warm, publication-led official theme for Drever. Editorial is made for
narrative talks, product stories, essays, research, and any deck where a clear
point of view matters more than a grid of cards.

It uses system fonts and has no font, image, animation, or component-library
dependency. React is only needed when a deck uses a layout component.

## Use it

```ts
// drever.config.ts
import theme from "@drever/theme-editorial";

export default {
  theme,
};
```

Ordinary Markdown receives the complete visual system: `h1`–`h6`, prose,
ordered and unordered lists, links, quotations, inline and block code, images,
rules, tables, Steps, and MotionGroups. The canvas is 1600 × 900 (16:9).

## Masthead

Use `Masthead` for the opening or a genuine chapter break. Its content budget is
deliberately strict.

```mdx
<Masthead
  kicker="Drever / Field Notes"
  title="The slide is becoming software."
  deck="A presentation can be interactive, testable, and ready to ship."
  meta="Zhuo · 2026"
/>
```

- `title` is required.
- `kicker`, `deck`, and `meta` are optional short content.
- `align` is `left` or `center`; left is the default.
- `tone` is `paper` or `ink`; paper is the default.
- Standard `header` attributes are forwarded.

## Feature

Use `Feature` when one visual is evidence for one explained claim—not to fit two
unrelated ideas on a slide.

```mdx
<Feature
  heading="Interfaces explain change."
  body={<p>Motion should preserve context, not decorate navigation.</p>}
  visual={<TransitionDiagram />}
  caption="Canvas-scoped transition model"
  balance="visual-led"
/>
```

- `heading`, `body`, and `visual` are required.
- `caption` is an optional source or interpretation.
- `balance` is `balanced`, `text-led`, or `visual-led`.
- Standard `article` attributes are forwarded.

## Motion

Editorial supports `focus`, `replace`, `compare`, `stagger`, and `continuity`.
Its choreography follows the theme's reading rhythm: restrained clipping and
fades reveal an argument, while continuity carries a genuine image, quotation,
or artifact into the next slide. Supported intents and concise author guidance
are part of the theme's JSON-safe motion metadata.

Intent explains why content moves; optional flow identifies its logical
progression axis; Editorial turns that meaning into a publication-led visual voice. Use
`flow="block"` for vertical reading rhythm and `flow="inline"` for a horizontal
pipeline or comparison, or omit it to retain the theme default. Use direct Step
children for focus, replacement, and comparison. Put stagger inside one Step
with at most four direct children. Give continuity the same explicit lowercase
kebab-case name on the same object across adjacent slides; continuity rejects
flow.

Persistent Stage decoration may make an occasional quiet shift, like a small
change in crop or rule position. It must yield when a stronger content reveal
or continuity transition carries the argument. See
[Motion choreography](../../docs/motion.md) for the complete grammar and
non-audience behavior.

## AI generation

The package exports typed `editorialRecipes` and includes machine-readable slot
purposes, variants, constraints, examples, and art direction in the theme
manifest. A generator can use those values directly.

Prompt addendum:

```text
Use @drever/theme-editorial. Write headlines with a point of view. Give each
slide one claim and let typography create the hierarchy. Use Masthead only for
the opening or a true chapter break. Use Feature only when a single visual is
evidence for the claim. Keep body copy under 55 words, use at most four list
items, and avoid card grids, decorative gradients, and generic slogans. Use
MotionGroup only when focus, replacement, comparison, stagger, or continuity
clarifies the reading order. Intent says why; set flow="block" for vertical
reading or flow="inline" for a horizontal pipeline, comparison, or successive state, and omit flow
when Editorial's default fits. Never set flow on continuity. Keep Stage
surprises sparse, quiet, and subordinate to the argument.
```

Editorial targets current browsers. Speaker previews retain the full visual
system while suppressing Step entrance animation, so current and next previews
remain stable.

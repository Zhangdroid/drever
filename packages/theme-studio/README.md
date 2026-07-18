# @drever/theme-studio

A focused dark official theme for technical narratives, product launches,
creative tooling, live artifacts, and interaction-led talks. Studio uses one
signal color deliberately; it is not a neon dashboard skin.

It has no font, image, animation, or component-library dependency. React is
only needed when a deck uses a layout component.

## Use it

```ts
// drever.config.ts
import theme from "@drever/theme-studio";

export default {
  theme,
};
```

Ordinary Markdown receives the complete visual system: `h1`–`h6`, prose,
ordered and unordered lists, links, quotations, inline and block code, images,
rules, tables, Steps, and MotionGroups. The canvas is 1600 × 900 (16:9).

## Statement

Use `Statement` for an opening, a true section marker, or a thesis the audience
should remember. The signal tone is intentionally rare.

```mdx
<Statement
  eyebrow="Architecture"
  index="02"
  title="The compiler owns certainty."
  supporting="Runtime receives a frozen plan, not a bag of configuration."
  tone="signal"
/>
```

- `title` is required.
- `eyebrow`, `index`, and `supporting` are optional short content.
- `tone` is `dark` or `signal`; dark is the default.
- Standard `header` attributes are forwarded.

## Workbench

Use `Workbench` when an interface, diagram, code sample, video, or interactive
component is the evidence. Keep explanation in the rail short enough that the
artifact stays primary.

```mdx
<Workbench
  label="Navigation state"
  main={<StateDiagram />}
  rail={
    <>
      <h3>Invariant</h3>
      <p>Every URL identifies one exact deck state.</p>
    </>
  }
/>
```

- `main` and `rail` are required.
- `label` is an optional artifact or mode name.
- `ratio` is `wide-main` or `equal`; wide-main is the default.
- Standard `section` attributes are forwarded.

## AI generation

The package exports typed `studioRecipes` and includes machine-readable slot
purposes, variants, constraints, examples, and art direction in the theme
manifest. A generator can use those values directly.

Prompt addendum:

```text
Use @drever/theme-studio. Write direct technical or product claims. Reserve the
signal color for the current decision or focal point. Use Statement only for an
opening, section marker, or real thesis. Use Workbench when one interface,
diagram, code sample, or live component is the evidence. Keep rail copy under
35 words, code large enough to discuss, and use at most four meaningful Steps.
Avoid neon overload, tiny dashboard cards, and decorative reveals.
```

Studio targets current browsers. Speaker previews keep the dark canvas and
complete typographic hierarchy while suppressing Step entrance animation, so
current and next previews remain stable.

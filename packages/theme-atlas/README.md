# @drever/theme-atlas

A cartographic official theme for research, travel, science, strategy, history,
and any presentation shaped by place or progression. Atlas uses measured
margins, route geometry, and field labels to clarify scope. It does not add maps
or coordinates to content that has no spatial or sequential relationship.

Treat it as one of Drever's eight official design studies and as a deterministic
Theme contract. The primary authoring workflow derives art direction from the
subject, audience, venue, and source material, then persists that result
locally; use Atlas as a reference or foundation only when place, route,
chronology, or progression genuinely structures the story.

Atlas uses system fonts and has no font, image, animation, or component-library
dependency. React is only needed when a deck uses one of its layouts.

## Use it

```ts
// drever.config.ts
import theme from "@drever/theme-atlas";

export default {
  theme,
};
```

Ordinary Markdown receives the complete visual system: headings, prose, lists,
links, quotations, inline and block code, images, rules, tables, Steps, and
MotionGroups. The canvas is 1600 × 900.

## Route

Use `Route` for a real journey, process, migration, or historical sequence.
The origin and destination must be concrete, and each waypoint must change how
the audience understands the path.

```mdx
<Route
  label="Migration / 2026"
  title="From pilot to public infrastructure."
  origin="Prototype"
  waypoints={["Two partner trials", "Regional validation"]}
  destination="General availability"
  caption="A staged rollout with explicit evidence gates"
  tone="terrain"
/>
```

- `title`, `origin`, `waypoints`, and `destination` are required.
- `label` and `caption` are optional short context.
- `waypoints` accepts one to five React nodes.
- `tone` is `ocean`, `terrain`, or `ember`; `ocean` is the default.
- Standard `section` attributes are forwarded.

Do not use Route to make an unordered feature list look more interesting.

## Survey

Use `Survey` when one map, specimen, diagram, chart, or field artifact is the
evidence. Keep the legend limited to what the audience needs to inspect it.

```mdx
<Survey
  label="Coastal survey"
  title="The risk moved inland."
  finding={<p>Three districts now cross the annual flood threshold.</p>}
  visual={<RiskMap />}
  legend={<MapLegend />}
  caption="Modelled annual exposure · 2026"
  balance="visual-led"
/>
```

- `title`, `finding`, `visual`, and `legend` are required.
- `label` and `caption` are optional context and provenance.
- `balance` is `balanced` or `visual-led`; `balanced` is the default.
- Standard `article` attributes are forwarded.

Every map or diagram still needs an accessible text alternative or summary.

## Motion

Atlas supports `focus`, `replace`, `compare`, `stagger`, and `continuity`.
Motion follows the authored geography or chronology: inline flow carries a
route, while block flow carries strata, traces, or ordered observations.
Focus identifies the current waypoint without erasing the path already
travelled. Replace keeps one map or artifact inside a stable survey frame.
Continuity belongs only to the same place, route, specimen, or visual crop
across adjacent slides.

Keep the Stage fixed. Route color, coordinates, and field labels are semantic
cues, not decorative objects to animate.

## AI generation

The package exports typed `atlasRecipes` and publishes JSON-safe layout slots,
constraints, choices, motion guidance, and art direction in the theme
manifest.

Prompt addendum:

```text
Use @drever/theme-atlas. Establish the scope, place, period, or progression
before presenting detail. Use Route only for a true ordered journey with a
concrete origin, one to five meaningful waypoints, and a destination. Use
Survey for one map, specimen, diagram, chart, or field artifact with a compact
finding and no more than four legend entries. Prefer ordinary Markdown for
context. Do not invent coordinates, add decorative topography, or use multiple
route colors. Use MotionGroup only when focus, replacement, comparison,
stagger, or continuity clarifies geography, chronology, or research order.
```

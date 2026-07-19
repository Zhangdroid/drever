# @drever/core

React authoring and rendering primitives for Drever presentations. This package
is for component authors, theme/plugin runtime code, and renderers that consume
compiled Drever MDX.

```tsx
import { Slide, Step } from "@drever/core";

export function ExampleSlide() {
  return (
    <Slide id="slide-1" index={0} currentStep={1}>
      <h1>One clear idea</h1>
      <Step at={1}>Reveal supporting detail</Step>
    </Slide>
  );
}
```

Exports include `MDXRenderer`, the protected component registry, `Slide`,
`Step`, `Note`, `MotionGroup`, and slide-state context. The runtime targets
React Canary and current browsers; it intentionally uses React `Activity` for
inactive slide state and effect lifecycle.

Components with media, network work, or global listeners should call
`useDreverRenderMode()`. It returns `audience`, `document`, `export`,
`speaker-current`, or `speaker-next`, allowing a component to stay visually
representative while suppressing side effects in reading views, previews, and
deterministic exports.

## MotionGroup

`MotionGroup` requires a semantic intent. `intent` explains why content moves,
optional `flow` identifies its logical progression axis, and the active theme
supplies the visual voice. Use `flow="block"` for vertical reading order and
`flow="inline"` for a horizontal pipeline, comparison, or successive state;
omit it to preserve the theme default. Use direct `Step` children for `focus`, `replace`, and
`compare`; put `stagger` inside one Step with at most four direct visual
children. `continuity` is the only intent with a `name`, requires the same
explicit lowercase kebab-case identity on the same object across adjacent
slides, and rejects `flow`:

```tsx
<MotionGroup intent="focus" flow="block">
  <Step at={1}>Retain this context.</Step>
  <Step at={2}>Focus this decision.</Step>
</MotionGroup>

<MotionGroup intent="continuity" name="deck-contract">
  <ContractCard />
</MotionGroup>
```

Core owns state attributes, render-mode-aware replacement accessibility, and
audience-only continuity identity. Audience, speaker, and export expose one
replacement state; document mode expands every completed and active
replacement into readable flow. Themes own visual choreography; authors do not
pass animation parameters. Missing or unknown intents, invalid continuity
names, and invalid prop combinations fail with structured runtime errors. See
[Motion choreography](../../docs/motion.md) for the complete grammar,
render-mode behavior, and author checklist.

Exporters can pass `idPrefix` to `DreverRenderModeProvider` when they render the
same compiled content tree more than once. The prefix keeps rendered slide IDs
unique without changing the canonical `data-slide-id`. In `export` mode,
inactive slides are omitted from the tree while active slides retain the same
Step state semantics as the audience viewer.

## Status

Version `0.0.0` is part of Drever's from-first-principles rewrite. The API is
under active development and is not yet stable for production use.

For the overall architecture, MDX conventions, and development setup, see the
Drever main project repository.

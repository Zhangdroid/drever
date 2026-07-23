# @drever/theme-construct

A modular official theme for teaching, facilitation, onboarding, community
sessions, and presentations that build understanding from explicit parts.
Construct is approachable without becoming decorative: every block represents
a named concept, step, category, or result.

Treat it as one of Drever's eight official design studies and as a deterministic
Theme contract. The primary authoring workflow derives art direction from the
subject, audience, venue, and source material, then persists that result
locally; use Construct as a reference or foundation only when teaching,
facilitation, or assembly genuinely structures the story.

Construct reuses the redistributable Bricolage Grotesque and Instrument Sans
fonts from `@drever/brand`. It has no image, animation, or component-library
dependency. React is only needed when a deck uses one of its layouts.

## Use it

```ts
// drever.config.ts
import theme from "@drever/theme-construct";

export default {
  theme,
};
```

Ordinary Markdown receives the complete visual system: headings, prose, lists,
links, quotations, inline and block code, images, rules, tables, Steps, and
MotionGroups. The canvas is 1600 × 900.

## Prompt

Use `Prompt` to pause a lesson, workshop, or onboarding flow around one
answerable question or concrete task. It is not a generic title slide.

```mdx
<Prompt
  eyebrow="Workshop / 02"
  question="What must remain true?"
  context="Change the interface without changing its public contract."
  cue="Write one invariant."
  footer="Two minutes · work independently"
  tone="yellow"
  align="left"
/>
```

- `question` is required.
- `eyebrow`, `context`, `cue`, and `footer` are optional.
- `tone` is `blue`, `coral`, `green`, or `yellow`; `blue` is the default.
- `align` is `left` or `center`; `left` is the default.
- Standard `section` attributes are forwarded.

Keep the context under thirty words and the response cue under sixteen.

## Assembly

Use `Assembly` when two to four peer parts genuinely combine into one
mechanism, implication, or conclusion.

```mdx
<Assembly
  label="Delivery contract"
  title="Three guarantees make one dependable release."
  parts={["Stable URLs", "Deterministic export", "Inspectable state"]}
  result={<strong>The artifact tested is the artifact shipped.</strong>}
  caption="Each guarantee is independently verifiable."
  tone="green"
/>
```

- `title`, `parts`, and `result` are required.
- `parts` accepts two to four React nodes at the same conceptual level.
- `label` and `caption` are optional context.
- `tone` is `blue`, `coral`, `green`, or `yellow`.
- Standard `section` attributes are forwarded.

Do not use Assembly as a card grid for unrelated categories.

## Tone

The four tones are category choices, not a palette to scatter across one
slide. Select one tone for the current lesson or concept and keep its text
label visible. Color never carries category or state by itself. Yellow uses
dark ink for every essential label and control.

## Motion

Construct supports `focus`, `replace`, `compare`, `stagger`, and `continuity`.
Focus gives the current concept block one deliberate 12px shift. Replace keeps
a changing part inside a stable footprint. Compare aligns peer blocks.
Stagger assembles two to four pieces in authored order without bounce.
Continuity belongs only to the same labelled concept block across adjacent
slides.

Use block flow for a stack and inline flow for a sequence or combination. Keep
the Stage stable and do not animate background blocks as confetti.

## AI generation

The package exports typed `constructRecipes` and publishes JSON-safe layout
slots, constraints, choices, motion guidance, and art direction in the theme
manifest.

Prompt addendum:

```text
Use @drever/theme-construct. Give every block a named concept, step, category,
or result. Use Prompt only for one answerable question or concrete task, with
no more than thirty words of context and one concise response cue. Use Assembly
only when two to four peer parts combine into one explicit result. Choose one
tone per slide and repeat its text label; do not scatter multiple colors,
confetti, or unrelated cards. Use MotionGroup only when focus, replacement,
comparison, stagger, or continuity explains how understanding is built.
```

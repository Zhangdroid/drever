# Ledger

Ledger is an evidence-led official theme for metrics, research, operational
reviews, analytical arguments, and accountable decisions. It uses aligned
numerals, measured rules, restrained color, and inspectable artifacts without
turning a presentation into a dashboard.

Treat it as one of Drever's eight official design studies and as a deterministic
Theme contract. The primary authoring workflow derives art direction from the
subject, audience, venue, and source material, then persists that result
locally; use Ledger as a reference or foundation only when evidence,
measurement, and accountability genuinely structure the story.

It has no font, image, animation, or component-library dependency. System sans
and monospace stacks keep it deterministic offline; tabular lining numerals
keep quantities aligned. React is required only when a deck uses a layout.

## Use it

```ts
// drever.config.ts
import theme from "@drever/designs/ledger";
import { defineConfig } from "drever";

export default defineConfig({
  theme,
});
```

Ordinary Markdown receives the complete visual system: headings, prose, lists,
quotations, links, inline and block code, images, rules, tables, Steps, and
MotionGroups. The canvas is 1600 × 900.

## Metric

Use `Metric` when one exact measure changes a decision. Name its period and
unit, label the comparison in words, and use `context` to explain the
consequence instead of repeating the number.

```mdx
<Metric
  label="Activation rate"
  value="68.4"
  unit="%"
  period="Q2 · New accounts"
  change="+7.2 pp vs Q1"
  context="Guided setup moved more teams to their first shared result."
  benchmark="Target 65%"
  tone="positive"
/>
```

- `label`, `value`, and `context` are required.
- `unit`, `period`, `change`, and `benchmark` are optional short content. Write `benchmark` as a
  self-contained label such as `Target 65%`; the layout does not inject English UI copy.
- `tone` is `neutral`, `positive`, or `attention`; neutral is the default.
- Standard `article` attributes are forwarded. The label supplies the
  accessible article name unless the author provides `aria-label` or
  `aria-labelledby`.

## Evidence

Use `Evidence` when the audience should be able to inspect the artifact behind
one conclusion. The visual region accepts a chart, table, code sample, media
object, or interactive component. Include the source, sample, method, or date
needed to audit it.

```mdx
<Evidence
  label="Finding 04"
  claim="Most delay enters before review."
  interpretation={<p>Queue time, not implementation, explains the missed service level.</p>}
  evidence={<CycleTimeChart />}
  source="Workflow events · Apr–Jun 2026 · n=1,842"
  balance="evidence-led"
/>
```

- `claim`, `interpretation`, and `evidence` are required.
- `label` and `source` are optional.
- `balance` is `evidence-led`, `balanced`, or `argument-led`; evidence-led is
  the default.
- Standard `article` attributes are forwarded.

## Motion

Ledger supports `focus`, `replace`, `compare`, `stagger`, and `continuity`.
Motion settles quickly onto a baseline with short travel, as if a finding were
being recorded rather than performed.

Use `flow="block"` for an audit trail, ranked list, or vertically ordered
evidence. Use `flow="inline"` for periods, cohorts, or a horizontal comparison.
Use direct Step children for focus, replace, and compare. Put a stagger group
inside one Step with no more than four direct children. Continuity requires the
same explicit lowercase kebab-case name on the same measure or artifact across
adjacent slides and rejects flow.

Audience choreography is removed for reduced motion and is never applied to
speaker, document, or export rendering. Persistent Stage decoration should stay
quiet and stationary when a measure or artifact already carries the change.

## AI generation

The package exports typed `ledgerRecipes`. The theme descriptor also publishes
literal tokens, art direction, layout slot purposes, variants, constraints, and
examples for Drever authoring context.

Prompt addendum:

```text
Use @drever/designs/ledger. Lead with the conclusion and make its evidence
inspectable. Give each slide one decision-driving number, claim, comparison, or
artifact. Always label units, periods, baselines, samples, and sources. Use
Metric for one exact measure with a concise implication. Use Evidence for one
claim supported by one chart, table, code sample, media object, or source
artifact. Avoid dashboard mosaics, false precision, ornamental grids, financial
clichés, and color-only status. Use motion only to clarify focus, replacement,
comparison, order, or genuine continuity. Use block flow for an audit trail and
inline flow for periods or cohorts. Never set flow on continuity.
```

## Project accents

Project utility CSS can override the stable semantic variables without editing
the package:

```css
.drever-viewer {
  --drever-theme-accent: #3157a4;
  --drever-theme-accent-strong: #223b70;
  --drever-theme-accent-soft: #dce5f8;
}
```

Keep metadata values literal when authoring a derivative theme; unresolved
`var(...)` values are not useful to people or AI.

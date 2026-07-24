# Fieldnote

A disciplined handwritten theme for lessons, workshops, tutorials, reflections,
and early ideas. Fieldnote uses one handwritten voice across the presentation,
with annotation as information structure and a near-white paper field that
recedes behind the content. It deliberately avoids scrapbook decoration,
random rotation, and dense prose.

Treat it as one of Drever's eight official design studies and as a deterministic
Theme contract. The primary authoring workflow derives art direction from the
subject, audience, venue, and source material, then persists that result
locally; use Fieldnote as a reference or foundation only when annotation and
reflection are meaningful to the story.

The bundled Caveat variable font is used across Latin headings, body copy,
labels, annotations, and data. Chinese text falls back to the platform's Kai
typeface. Literal code remains monospace because its structure is semantic,
not decorative.

## Use it

```ts
import fieldnoteTheme from "@drever/designs/fieldnote";
import { defineConfig } from "drever";

export default defineConfig({
  theme: fieldnoteTheme,
});
```

## Layouts

`Notebook` opens a talk or chapter with one memorable thought:

```mdx
<Notebook
  eyebrow="Workshop · 01"
  title="Start with what changed."
  note="The useful story begins where the audience must see the situation differently."
  footer="Field notes"
/>
```

`Annotated` explains one visible artifact with no more than three direct notes:

```mdx
<Annotated
  heading="The gap appears at handoff."
  annotationsLabel="Research recommendations"
  evidence={<ProcessSketch />}
  annotations={
    <ol>
      <li>The decision loses an owner.</li>
      <li>The artifact loses context.</li>
    </ol>
  }
  caption="Workshop synthesis"
/>
```

`annotationsLabel` is optional and author-controlled so non-English decks can name the
complementary region in their own language.

Ordinary Markdown receives the full theme, including headings, prose, lists,
quotes, links, code, images, tables, Steps, and MotionGroups. The package also
exports typed `fieldnoteRecipes` for tools that import it directly.

## Motion

Fieldnote follows writing order with short, restrained movement. It never
simulates handwriting across whole paragraphs. Use continuity only for the same
note, sketch, image, or worked object on adjacent slides.

## Font license

Caveat is distributed under the SIL Open Font License 1.1. Its unmodified font
file and license are included in `fonts/`.

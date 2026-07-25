# Cinema

A projection-dark Drever theme for narrative talks, product stories, documentary explanation, and visual evidence. Cinema creates tension with hierarchy, pacing, title cards, and stable frames—not decorative movie props.

Treat it as one of Drever's eight official design studies and as a deterministic
Theme contract. The primary authoring workflow derives art direction from the
subject, audience, venue, and source material, then persists that result
locally; use Cinema as a reference or foundation only when media and narrative
pacing genuinely carry the story.

## Use

```tsx
import cinemaTheme from "@drever/designs/cinema";
import "@drever/designs/cinema/theme.css";
import { Frame, TitleCard } from "@drever/designs/cinema/layouts";
```

The package exports a JSON-safe theme descriptor as the default export, named `theme`, and typed `cinemaRecipes` for composition tools.

## Layouts

`TitleCard` marks a real story boundary. Keep the title under eight words, the optional logline to one sentence, and the credit quiet.

```tsx
<TitleCard
  eyebrow="Act I / The Interface"
  title="Every state deserves a URL."
  logline="The presentation becomes software when its structure survives the stage."
  credit="Drever · 2026"
/>
```

`Frame` gives one image, chart, diagram, video, or interactive artifact a stable widescreen or academy frame. The caption should tell the audience what to notice.

```tsx
<Frame
  heading="The route is the state."
  media={<Diagram />}
  caption="A stable URL identifies one exact presentation moment."
  credit="Runtime model / 04"
  ratio="academy"
/>
```

The media box keeps its aspect ratio throughout a slide. Direct images, video, SVG, and canvas use `object-fit: contain`, so the theme does not trade evidence for a dramatic crop.

## Motion

Cinema cuts into close-ups and interventions, then reserves a short dissolve for
return shots or credits. It does not apply a default Ken Burns effect: still
media is not scaled, panned, or re-cropped merely to create movement. When a
frame changes geometry, cut before capture and render its border, crop, and
shadow in the destination's first frame. Use `continuity` only for the same
artifact with identical geometry across slides, and keep staggered sequences
short enough to read as deliberate beats.

All typefaces use robust system-font stacks. The theme loads no remote fonts and requires no runtime image, texture, or video assets.

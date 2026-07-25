# @drever/plugin-charts

Opt-in, presentation-sized charts and metrics for Drever. The plugin uses React,
semantic SVG, CSS, and `requestAnimationFrame` directly. It does not ship a
general-purpose chart runtime, canvas renderer, or external chart dependency.

```bash
pnpm add -D @drever/plugin-charts
```

```ts
import chartsPlugin from "@drever/plugin-charts";
import { defineConfig } from "drever";

export default defineConfig({
  plugins: [chartsPlugin],
});
```

## DataChart

`DataChart` supports five concise visual relationships:

- `bar` compares category magnitudes.
- `line` shows a sequence or trend with straight segments.
- `area` emphasizes the amount above or below the shared baseline.
- `dot` presents a readable horizontal category ranking.
- `donut` shows parts of one positive whole.

```mdx
<DataChart
  label="Adoption by quarter"
  kind="area"
  valueSuffix="%"
  data={[
    { label: "Q1", value: 28 },
    { label: "Q2", value: 46 },
    { label: "Q3", value: 71 },
  ]}
/>
```

`label` is required and becomes the SVG title. The generated description lists
every labeled value, so the same data remains understandable without seeing the
marks. `data` accepts one to twelve JSON-safe points; labels must be non-empty
and values must be finite numbers. `valuePrefix` and `valueSuffix` decorate both
visible and accessible values.

Bar, line, area, and dot charts accept positive, zero, and negative values
against a deterministic zero baseline. Donut charts reject negative values and
a zero total. Zero-valued donut categories remain in the legend but do not
produce an arc.

The component inherits text color and uses `--drever-theme-accent`. Donut series
use the deterministic `--drever-data-chart-series-1` through
`--drever-data-chart-series-12` palette, which a design can override.

## AnimatedNumber

Use `AnimatedNumber` for one metric that deserves emphasis:

```mdx
<AnimatedNumber label="Audience agreement" value={96} valueSuffix="%" duration={1400} />
```

The component counts from `from` (zero by default) when its owning audience
slide becomes active and replays when the audience returns to that slide.
Speaker, document, export, and reduced-motion surfaces receive the final value
without animation. Assistive technology also receives only the final labeled
value; interpolated frames are visual and hidden from its reading order.

`duration` is measured in positive milliseconds. `decimals` accepts a whole
number from zero through six. Tabular numerals and reserved inline width keep
surrounding slide content stable throughout the count.

Wrap a chart in `Step` when its appearance is part of the story. `DataChart`
itself remains motionless: the data relationship should lead, rather than
decorative chart animation.

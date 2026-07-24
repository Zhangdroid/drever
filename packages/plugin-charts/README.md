# @drever/plugin-charts

Opt-in, presentation-sized bar and line charts for Drever. The plugin uses
React and semantic SVG directly: there is no chart runtime, canvas renderer, or
external chart dependency.

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

The plugin registers `DataChart` for MDX:

```mdx
<DataChart
  label="Adoption by quarter"
  kind="line"
  valueSuffix="%"
  data={[
    { label: "Q1", value: 28 },
    { label: "Q2", value: 46 },
    { label: "Q3", value: 71 },
  ]}
/>
```

`label` is required and becomes the SVG title. The generated description lists
every labeled value, so the same data remains understandable without seeing
the marks. `data` accepts one to twelve JSON-safe points; labels must be
non-empty and values must be finite numbers. Positive, zero, and negative
values share one deterministic baseline.

The component inherits text color and reads `--drever-theme-accent`, allowing a
Drever design to own the visual language. Wrap the chart in a `Step` when its
appearance is part of the story; the chart itself does not add decorative
motion.

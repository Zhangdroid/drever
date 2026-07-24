# @drever/designs

Eight official Drever design studies in one package. Each study is a deterministic
Theme contract with its own art direction, motion voice, semantic layouts, and
CSS. They are useful fallbacks and concrete references for generating a
subject-led local design.

Install the collection once:

```sh
npm install --save-dev @drever/designs
```

Import only the study a deck uses:

```ts
import editorialTheme from "@drever/designs/editorial";
import { defineConfig } from "drever";

export default defineConfig({
  theme: editorialTheme,
});
```

Layouts and CSS remain available through explicit subpaths:

```ts
import { Feature, Masthead } from "@drever/designs/editorial/layouts";
import "@drever/designs/editorial/theme.css";
```

| Study     | Best suited to                                              | Layouts                  |
| --------- | ----------------------------------------------------------- | ------------------------ |
| Default   | A neutral fallback with restrained hierarchy                | `Cover`, `TwoColumn`     |
| Editorial | Publication-led narratives and typographic evidence         | `Masthead`, `Feature`    |
| Studio    | Technical systems, interfaces, code, and live artifacts     | `Statement`, `Workbench` |
| Fieldnote | Workshops, lessons, annotations, and reflective stories     | `Notebook`, `Annotated`  |
| Atlas     | Place, routes, chronology, research, and spatial narratives | `Route`, `Survey`        |
| Ledger    | Metrics, analysis, evidence, and accountable decisions      | `Metric`, `Evidence`     |
| Cinema    | Image-led stories, title cards, and stable media frames     | `TitleCard`, `Frame`     |
| Construct | Teaching, facilitation, named parts, and concept assembly   | `Prompt`, `Assembly`     |

The package root exposes the typed `officialDesigns` catalog and named Theme
exports such as `editorialTheme`. Prefer a direct study subpath in project
configuration so the dependency and intended visual language stay explicit.

The detailed reasoning behind each study lives in [`studies/`](./studies).

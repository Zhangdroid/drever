# drever

The unscoped Drever command line package. A project needs only an MDX deck:

```mdx
# Opening

---

# A precise reveal

<Step>First idea</Step>
<Step>Second idea</Step>
```

Run it with:

```sh
drever dev slides.mdx
drever build slides.mdx
drever export pdf slides.mdx --steps --output slides-export.pdf
```

All commands default to `slides.mdx`. PDF export writes
`<entry-basename>-export.pdf` in the project root unless `--output` is provided;
`--steps` includes every incremental reveal. The CLI owns its Vite application entry;
deck authors configure only Drever's stable surface:

PDF export uses Playwright's Chromium runtime without loading it for `dev` or
`build`. Install the browser once with `npx playwright install chromium` (or
`npx playwright install --with-deps chromium` in CI).

```ts
import { defineConfig } from "drever";

export default defineConfig({
  canvas: { width: 1600, height: 900 },
  server: { port: 4317 },
  build: { outDir: "dist" },
});
```

Deck modules import author-facing primitives from the same package:

```mdx
import { Note, Step } from "drever";

<Step>A meaningful reveal</Step>

<Note>Explain why this transition matters.</Note>
```

Plugins can be registered directly or with settings; the CLI marks them as
user plugins internally:

```ts
export default defineConfig({
  plugins: [charts, { plugin: mermaid, enabled: true }],
});
```

The default theme is used when `theme` is omitted. Plugins are explicit
`PluginRegistration` values; Vite remains available to plugin developers
through the Drever plugin contract rather than through this config.

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
drever agent sync
drever context slides.mdx --json
drever dev slides.mdx
drever current --json
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
  rehearsal: { targetDurationMinutes: 20 },
  server: { port: 4317 },
  build: { outDir: "dist" },
});
```

`rehearsal.targetDurationMinutes` must be a positive finite number. The CLI
converts it to the speaker runtime's millisecond target for both development and
static builds. It initializes the editable target only; rehearsal timings and
runtime target changes remain local to each speaker-view session.

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

## Agent authoring

Run `drever agent sync` at the project root to install Drever's project-local
authoring kit:

```text
AGENTS.md
.agents/skills/drever-create-deck/
.agents/skills/drever-author-deck/
.agents/skills/drever-review-deck/
```

Each skill contains `SKILL.md` plus optional agent metadata. The command runs
before deck or config resolution, so it also works while a new project is still
being assembled. Repeated runs are idempotent and update Drever-owned content.
It replaces only the marked block in `AGENTS.md` and only skill files carrying
the generated ownership marker. User content outside that block is preserved.
If any target is user-owned, malformed, or not a regular file, sync reports all
conflicts and writes none of the planned files.

Run `drever context [entry] --json` before substantial authoring or review. The
versioned JSON document contains:

- the resolved canvas and source path;
- the exact compiler-owned slide manifest, including titles and sparse Step
  stops, joined to authored fragments and source ranges;
- the active theme tokens, design guidance, motion intents, layouts, component
  manifests, and semantic elements;
- normalized plugin registrations and the source-based preflight report.

The command resolves config and runs Drever's protected slide grammar plus
configured Remark contributions. It does not start a Vite server, construct the
full adapter, render React, execute Rehype or Recma transforms, or infer
runtime-generated content and computed visual quality. Use `drever check
--json`, a production build, and rendered slide, document, and speaker evidence
for those later validation layers. Without `--json`, `context` prints only a
concise human summary.

While `drever dev` and an audience or speaker window are active, `drever current
--json` reports the most recently updated open surface, exact route, source path,
slide id, zero-based slide index, and sparse Step. It follows query and fragment
changes, falls back across multiple open windows or dev-server sessions, and
removes session state when the window disconnects. The development-only cache
is not included in production output.

See [Agent authoring](../../docs/agent-authoring.md) for the ownership contract,
output scope, and recommended create/edit/review loop.

# drever

The unscoped Drever command line package. Create an AI-ready project in one command:

```sh
npm create drever@latest my-deck
```

The command creates a metadata-ready MDX deck, a presentation brief, a versioned
`drever.plan.json` story contract, and
project-local skills for Codex and Claude Code. It installs dependencies by
default; use `--no-install` for automation or `--open codex` / `--open claude`
to open the project with a prepared task.

A project needs only an MDX deck:

```mdx
# Opening

---

# A precise reveal

<Step>First idea</Step>
<Step>Second idea</Step>
```

Run it with:

```sh
npm exec -- drever agent sync --target all
npm exec -- drever doctor --json
npm exec -- drever context slides.mdx --json
npm exec -- drever check slides.mdx --rendered --json
npm exec -- drever dev slides.mdx
npm exec -- drever studio status --json
npm exec -- drever current --json
npm exec -- drever mcp slides.mdx
npm exec -- drever build slides.mdx --json
npm exec -- drever browser install
npm exec -- drever design import https://brand.example --name "Brand reference"
npm exec -- drever export pdf slides.mdx --slides 2-5,8 --steps --output slides-export.pdf --json
```

These examples use npm. In projects installed with pnpm, Yarn, or Bun, use
`pnpm exec drever`, `yarn exec drever`, or `bunx --no-install drever`
respectively, plus that manager's script runner.

All commands default to `slides.mdx`. PDF export writes
`<entry-basename>-export.pdf` in the project root unless `--output` is provided;
`--slides` accepts one-based numbers and inclusive ranges, while `--steps`
includes every incremental reveal for each selected slide. The CLI owns its Vite
application entry; deck authors configure only Drever's stable surface:

`build --json` and `export pdf --json` return a versioned artifact receipt with absolute source and output paths. Without `--json`, both commands keep their concise human-readable output.

`npm exec -- drever doctor --json` checks the required Node version and deck
entry, then reports project-local installation and Chromium readiness as
non-blocking warnings. It never installs software or starts a browser.

PDF export, rendered preflight, and website design import use Playwright's
Chromium runtime without loading it for `dev` or `build`. Install its exact
matching browser once with
`npm exec -- drever browser install`. Linux environments that also need
operating-system packages can use
`npm exec -- drever browser install --with-deps`.

## Rendered preflight

`drever check` remains the fast source check. Add `--rendered` when a production
candidate needs browser evidence:

```sh
npm exec -- drever check slides.mdx --rendered
npm exec -- drever check slides.mdx --rendered --json
```

The rendered phase builds an isolated inspection app and visits Step 0 plus
every exact authored Step at the configured canvas. It reports stable
diagnostics for line-fragment clipping, canvas and direct scroll overflow,
high-confidence sibling overlap, resolved solid-color contrast, unintended
movement of persistent geometry, and suspicious density. Proven clipping,
overflow, overlap, and contrast failures are errors; geometry, density, and
paint that cannot be resolved through gradients, images, blending, or
translucency remain warnings that require review. Runtime or missing-browser
failures are also explicit errors.

JSON mode emits the current typed `DeckPreflightReportV2`. Its `rendered`
receipt records the receipt and ruleset versions, canvas, `chromium` engine,
optional browser version, captured `stateCount`, and `status`. When source
errors make rendering unsafe, the receipt is `skipped` with reason
`source-errors`; browser and runtime failures report `failed` with their
matching reason. `@drever/schema` also exposes the legacy source-only V1 shape
and a safe report union for stored artifacts. Receipt version 1 accepts both
ruleset 1 and the current ruleset 2; compare the recorded ruleset with
`RENDERED_PREFLIGHT_RULESET_VERSION` before reusing stored evidence. This evidence is deterministic
and useful to CI or an agent, but it cannot judge hierarchy, motion quality,
aesthetic fit, or contrast through complex paint. Keep a real visual review in
the delivery loop.

## Import a design reference

Start a local Theme from the rendered evidence of an existing website:

```sh
npm exec -- drever design import https://brand.example \
  --name "Brand reference" \
  --output design/brand \
  --color-scheme light
```

The command samples a fixed `1600×900` Chromium viewport and writes
`reference.json`, `theme.ts`, `theme.css`, and `art-direction.md` into a new or
empty child directory. Omit `--name` and `--output` to derive both from the
hostname; use `--color-scheme dark` to sample that preference and `--json` for
the versioned receipt. The JSON result identifies
`kind: "drever.design-import"`, its schema version, Theme name, absolute output
path, generated files, and complete capture reference.

Public HTTP and HTTPS references are allowed by default. URL credentials are
always rejected. Localhost and private-network targets require an explicit
opt-in:

```sh
npm exec -- drever design import http://127.0.0.1:4317 \
  --allow-private \
  --output design/local-reference
```

Persisted URL references omit credentials, query strings, and fragments. Treat
all captured titles, descriptions, style values, and asset references as
untrusted evidence: review them before using them in authored code, copy, or
configuration. `--allow-private` changes network reachability only; it does not
make the captured page or its metadata trusted.

The result is an evidence-based local **Pass-0 Theme**, not a finished design or a
copy of the source site. Drever records computed color, typography, spacing,
shape, and asset-reference evidence. It never copies or hotlinks source HTML,
CSS, JavaScript, fonts, images, or scripts, and it never overwrites a non-empty
target. Review licenses, replace any referenced brand assets with approved
local files, refine the Theme for the presentation, then run
`drever check --rendered`.

Wire the generated Theme into the project explicitly:

```ts
import importedTheme from "./design/brand/theme";
import { defineConfig } from "drever";

export default defineConfig({
  theme: importedTheme,
});
```

## Configuration

```ts
import { defineConfig } from "drever";

export default defineConfig({
  deck: {
    title: "Choose what happens next",
    description: "The evidence and one decision the room can act on.",
    lang: "en",
    dir: "ltr",
  },
  canvas: { width: 1600, height: 900 },
  focusTools: {
    pen: { color: "#ff4f8b", width: 8 },
    highlighter: { color: "#d5ff3f", opacity: 0.32, width: 34 },
    laser: { color: "#ff2e6f" },
  },
  rehearsal: { targetDurationMinutes: 20 },
  server: { port: 4317 },
  build: { outDir: "dist" },
});
```

`focusTools` configures the interactive Pen, Highlighter, and Laser appearance.
It accepts CSS color values, positive widths, and a highlighter opacity from
zero to one. Themes and project CSS can still supply defaults through the
`--drever-focus-*` variables; explicit config values take precedence.

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
import chartsPlugin from "@drever/plugin-charts";
import { defineConfig, gfm } from "drever";

export default defineConfig({
  plugins: [gfm({ singleTilde: false }), chartsPlugin],
});
```

The Basic theme is the automatic fallback when `theme` is omitted. GFM, Shiki,
and Tailwind CSS are ordered defaults; the first matching config entry can configure or disable
one in place. Other plugins are explicit `PluginRegistration` values. Vite
remains available to plugin developers through the Drever plugin contract
rather than through this config.

## Agent authoring

Run `npm exec -- drever agent sync` at the project root to install Drever's project-local
authoring kit:

```text
AGENTS.md
.agents/skills/drever-create-deck/
.agents/skills/drever-create-design/
.agents/skills/drever-author-deck/
.agents/skills/drever-review-deck/
.agents/skills/drever-deliver-deck/
.claude/skills/drever-create-deck/
.claude/skills/drever-create-design/
.claude/skills/drever-author-deck/
.claude/skills/drever-review-deck/
.claude/skills/drever-deliver-deck/
```

Use `--target codex`, `--target claude`, `--target all`, or `--target auto` to choose the project adapter. Omitting the target preserves the Codex-only compatibility behavior.

Each skill contains `SKILL.md` plus optional agent metadata. The command runs
before deck or config resolution, so it also works while a new project is still
being assembled. Repeated runs are idempotent and update Drever-owned content.
It replaces only the marked block in `AGENTS.md` and only skill files carrying
the generated ownership marker. User content outside that block is preserved.
If any target is user-owned, malformed, or not a regular file, sync reports all
conflicts and writes none of the planned files.

New-deck creation and explicit replacement begin with a plan review. Edits to an
authored deck use the focused authoring skill, preserve its approved plan, and
do not restart that gate. The agent writes the human-readable
brief and outline to `brief.md`, records its smaller machine-checkable story
contract in `drever.plan.json`, and validates it. When a development host can
keep the server alive, the agent prefers the experimental local creation room
for the common brief, adaptive questions, visual Storyboard approval, and later
deck- or slide-scoped feedback. Chat plus the plan-only `/storyboard` route is
the fallback; that route does not import the MDX entry, Theme, or presentation
runtime, so it remains useful while the first deck source is absent or incomplete.
The machine-readable contract gives every slide a stable ID, narrative job,
evidence, focal artifact, composition recipe, density, and optional single
motion owner. Those IDs are stable planning and review labels; compiled slide
identity remains positional, while the check validates plan shape, order, and
approved slide count. Once approved, the agent reuses the same development
server. When the plan becomes a coherent end-to-end Draft 1, it shares the
audience URL for immediate story and content
review, and continues visual and technical refinement without another approval
pause. Authoring and design use source-only and affected-route checks while the
preview changes. Review owns the exhaustive rendered gate; delivery reuses its
fresh evidence and runs the one production build plus requested exports. Any
later source, configuration, or asset mutation invalidates affected evidence.

The provider-neutral bridge uses `drever studio status`, `drever studio wait`,
and `drever studio publish`. These are agent-facing commands over ephemeral
`.drever/studio` state, not a hosted API. The browser never receives model
credentials or arbitrary file access, and the creation room is excluded from
production and export bundles.

Run `npm exec -- drever context [entry] --json` before substantial authoring or review. The
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
runtime-generated content and computed visual quality. Use `npm exec -- drever
check --rendered --json`, a production build, and visual slide, document, and
speaker review for those later validation layers. Without `--json`, `context`
prints only a concise human summary.

While `npm exec -- drever dev` and an audience or speaker window are active,
`npm exec -- drever current --json` reports the most recently updated open surface, exact route, source path,
slide id, zero-based slide index, and sparse Step. It follows query and fragment
changes, falls back across multiple open windows or dev-server sessions, and
removes session state when the window disconnects. The development-only cache
is not included in production output.

## Read-only MCP

Run `npm exec -- drever mcp [entry]` to expose the authoring contract as a standalone MCP
2025-11-25 stdio server. It does not require a development server and adds no
SDK dependency. Register the local project binary with an MCP client:

```json
{
  "mcpServers": {
    "drever": {
      "command": "npm",
      "args": ["exec", "--", "drever", "mcp", "slides.mdx"]
    }
  }
}
```

The server exposes five read-only tools:

- `drever_get_context`: the complete resolved authoring and design contract;
- `drever_list_slides`: compact slide identity, Step, note, and source ranges;
- `drever_get_slide`: exact authored source and notes for one slide;
- `drever_check`: source preflight with `valid` and stable diagnostics;
- `drever_get_current`: the latest available `npm exec -- drever dev` audience or speaker
  position.

Each successful tool returns both `structuredContent` and its JSON projection as
text. Tool calls reread and recompile the MDX source, so edits are visible without
restarting the server. Restart after changing `drever.config.ts`, the selected
theme, or plugin registrations because those are resolved when `mcp` starts.
Source mutation is intentionally outside the MCP server: agents use their normal
workspace tools, and Git remains the review and rollback boundary. Stdout is
reserved exclusively for newline-delimited JSON-RPC; process diagnostics use
stderr.

See [Agent authoring](../../docs/agent-authoring.md) for the ownership contract,
output scope, and recommended create/edit/review loop.

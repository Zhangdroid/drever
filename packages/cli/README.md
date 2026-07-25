# drever

The unscoped Drever command line package. Create an AI-ready project in one command:

```sh
npm create drever@latest my-deck
```

The command creates a zero-config MDX deck, a presentation brief, and project-local skills for Codex and Claude Code. It installs dependencies by default; use `--no-install` for automation or `--open codex` / `--open claude` to open the project with a prepared task.

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
npm exec -- drever dev slides.mdx
npm exec -- drever current --json
npm exec -- drever mcp slides.mdx
npm exec -- drever build slides.mdx --json
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
entry, then reports project-local installation and PDF-browser readiness as
non-blocking warnings. It never installs software or starts a browser.

PDF export uses Playwright's Chromium runtime without loading it for `dev` or
`build`. Install the browser once with `npx playwright install chromium` (or
`npx playwright install --with-deps chromium` in CI).

```ts
import { defineConfig } from "drever";

export default defineConfig({
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

The default theme is used when `theme` is omitted. GFM, Shiki, and Tailwind CSS
are ordered defaults; the first matching config entry can configure or disable
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
check --json`, a production build, and rendered slide, document, and speaker evidence
for those later validation layers. Without `--json`, `context` prints only a
concise human summary.

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

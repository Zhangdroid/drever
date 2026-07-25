# Agent authoring

Drever treats AI authoring as a framework contract, not a prompt copied between
projects. The contract has five surfaces:

- `npm create drever@latest` creates an AI-ready project from an empty directory.
- `npm exec -- drever agent sync` installs concise, project-local working instructions for
  Codex, Claude Code, or both.
- `npm exec -- drever context [entry] --json` reports the resolved deck and design system in
  a stable, machine-readable form.
- `npm exec -- drever current --json` identifies the state currently visible in a local
  audience or speaker window.
- `npm exec -- drever mcp [entry]` exposes those read-only contracts to MCP-capable agents.

The MDX source remains authoritative. Agents use the contract to make smaller,
more accurate changes and then validate those changes through the same CLI and
browser surfaces a person uses.

Examples use npm. A project using pnpm, Yarn, or Bun should invoke the same
local binary with `pnpm exec drever`, `yarn exec drever`, or
`bunx --no-install drever` and use the matching script runner.

## Install the project agent kit

New projects receive both adapters automatically. To refresh an existing
project, run this command at its root:

```bash
npm exec -- drever agent sync --target all
```

It creates or updates:

```text
AGENTS.md
CLAUDE.md
.agents/
  skills/
    drever-create-deck/
      SKILL.md
      agents/openai.yaml
    drever-create-design/
      SKILL.md
      agents/openai.yaml
    drever-author-deck/
      SKILL.md
      agents/openai.yaml
    drever-review-deck/
      SKILL.md
      agents/openai.yaml
    drever-deliver-deck/
      SKILL.md
      agents/openai.yaml
.claude/
  skills/
    drever-create-deck/SKILL.md
    drever-create-design/SKILL.md
    drever-author-deck/SKILL.md
    drever-review-deck/SKILL.md
    drever-deliver-deck/SKILL.md
```

The five skills cover starting a deck, deriving subject-led art direction,
making focused source changes, reviewing presentation readiness, and delivering
verified web or PDF artifacts. They instruct an agent to use semantic MDX,
persist the generated visual system as a deterministic Theme contract, preserve
exact Step routes, and verify the affected audience, document, speaker, and
export states. The eight official Theme packages are equal design studies and
quality references; Basic is only the neutral fallback when the brief does
not justify a stronger direction.

The `SKILL.md` content is canonical across hosts. Codex-specific UI metadata is
additive and is omitted from Claude's adapter. Teams should commit both adapters
so every authoring session starts from the same version-matched instructions.

Use `--target auto` to update adapters already present in a project, or
`--target codex` and `--target claude` to install one explicitly. Omitting
`--target` preserves the Codex-only compatibility behavior; the project creator
uses `all` by default.

## Install the global agent plugin

`@drever/agent` packages the same canonical skills as one plugin directory with
separate Codex and Claude manifests. Its global responsibility is intentionally
small: recognize an empty workspace, invoke `npm create drever@latest`, then
defer to the version-matched project kit. It has no model SDK, MCP server, hooks,
or runtime dependency.

This repository includes marketplace catalogs at
`.agents/plugins/marketplace.json` and `.claude-plugin/marketplace.json`. For
local plugin development, add the repository root as a marketplace:

```bash
codex plugin marketplace add .
claude plugin marketplace add .
claude plugin install drever@drever --scope user
```

After adding the Codex marketplace, restart the ChatGPT desktop app and install
Drever from its Plugins Directory. The publishable plugin payload is the
`@drever/agent` package; the website can later link to the public marketplace
without changing the skill contract.

### Ownership and conflicts

`AGENTS.md` contains one Drever-owned block delimited by
`drever-agent-kit:start` and `drever-agent-kit:end` comments. Sync may replace
that block, but preserves all text outside it. If the file has no managed block,
sync appends one without changing existing instructions.

Generated skill and metadata files carry an ownership marker. Sync may replace
only files with that marker. A target without it is user-owned; duplicate or
incomplete `AGENTS.md` markers and non-file targets are conflicts. Drever reports
all target conflicts before writing any planned file. There is intentionally no
force flag: merge or move user-owned content, then run sync again.

The operation is idempotent. Its summary reports created, updated, and unchanged
files. It runs before config or deck resolution, so a missing or temporarily
invalid `drever.config.ts` does not prevent kit installation.

## Read the authoring context

Run:

```bash
npm exec -- drever context --json
npm exec -- drever context talks/keynote.mdx --json
```

The optional entry follows the same resolution rules as build commands. Config
is resolved with production semantics so the report describes the deck an agent
is expected to deliver. The JSON root currently contains:

| Field        | Meaning                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| `version`    | Schema version for consumers that cache or validate the report.                                        |
| `sourcePath` | Resolved MDX entry path.                                                                               |
| `canvas`     | Resolved width and height from config, theme, or framework defaults.                                   |
| `deck`       | Exact slides, titles, and sparse Step stops, joined to authored fragments and source ranges.           |
| `design`     | Theme tokens and guidance, motion intents, layout recipes, component manifests, and semantic elements. |
| `plugins`    | Ordered normalized plugin registrations and public JSON-safe config.                                   |
| `preflight`  | The same source-based accessibility evidence exposed by Drever's preflight domain.                     |

Without `--json`, the command prints only the source path, slide count, active
theme, and plugin count. The concise form is for orientation; agents and tools
should consume the versioned JSON form.

### Exact scope

The deck section is compiler evidence. Drever applies its protected slide
grammar, loads configured Remark contributions, and finalizes the same static
slide and Step manifest used for navigation. It then joins that manifest with
parser-owned source fragments. Implicit Step numbering, repeated reveal groups,
and intentional sparse stops are therefore represented exactly; they are not
reconstructed with regular expressions.

The design section is planning evidence. It exposes only JSON-safe public theme,
layout, motion, component, and plugin metadata. Executable layout and component
module references stay private. This gives an agent the available visual
vocabulary without coupling its output to Vite internals.

`context` is intentionally not a rendered-deck oracle. It does not:

- start a development server or browser;
- execute Rehype, Recma, Vite transforms, or runtime React components;
- discover slides or Steps created dynamically by JavaScript;
- evaluate computed layout, overflow, contrast, animation quality, media
  readiness, or interaction behavior;
- replace `npm exec -- drever check`, `npm exec -- drever build`, PDF export, or browser inspection.

Preflight inside the report analyzes the authored source. Runtime components
remain responsible for their generated semantics, and visual claims require
rendered evidence at the configured canvas and exact Step route.

Rendered readability is a delivery gate. Every visible authored string is a
reading promise. Treat any heading, body copy, label, caption, legend,
annotation, link, code, table cell, or control that is not immediately legible
at presentation distance on the configured canvas as a blocking P0 defect. If
text is not meant to be read, use a non-text visual texture instead of fake
microcopy. Check actual font size, weight, spacing, and computed foregrounds on
the rendered descendants against the worst background, motion frame, and Step
state; passing a contrast ratio alone does not prove presentation legibility.
Do not infer contrast from a wrapper's `color`. Reduce or dim background layers
and decoration, not a container that also contains required text.

Keep every label and copy block fully contained within the shape or surface
that visually owns it, with deliberate padding in every Step and intermediate
frame. For circles, rings, clipped polygons, and other non-rectangular owners,
validate the usable inner silhouette after borders and padding, not merely the
rectangular bounding box. If the copy cannot fit, enlarge or reflow the owner,
or move the label outside with an explicit association. Never repair it by
clipping, overlap, or shrinking below presentation legibility.

After Draft 1, inspect every slide at Step 0 and every exact authored Step route
at the configured canvas; representative sampling is not sufficient.

## Follow the live presentation

While `npm run dev` is running, each audience or speaker window publishes its
latest committed position under `.drever/cache/current/`. Read it through the
public command instead of depending on that cache path:

```bash
npm exec -- drever current
npm exec -- drever current --json
```

The versioned JSON contains the resolved `sourcePath`, `surface`, exact `route`,
and compiler-owned `slideId`, zero-based `slideIndex`, and sparse `step`. Query
parameters and the fragment remain part of the route. Option-click on macOS or
Alt-click on another platform to attach an exact static MDX element as
`selection`, including its project-contained source range, tag, and rendered
text. The development viewer outlines that element; Escape clears it, and
ordinary clicks do not replace it. The most recently updated open audience or
speaker window is authoritative; if it closes, Drever falls back to the
previous open window. Document and export surfaces never publish a cursor.

The snapshot is local, ephemeral development state. Drever clears it when the
last interactive window disconnects or the development server closes. A missing
snapshot is an actionable error: start `npm run dev`, open an interactive surface,
and try again. Agents should use this signal to locate the user's current state,
then use `context --json` and the authored source for edits.

## Connect an MCP agent

Start the dependency-free stdio server directly from an MCP client:

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

The server follows MCP `2025-11-25` and exposes `drever_get_context`,
`drever_list_slides`, `drever_get_slide`, `drever_check`, and
`drever_get_current`. Every tool is annotated read-only and returns both
structured JSON and a text projection. Slide and context calls read the current
MDX on every invocation. The config, theme, plugin plan, and entry are resolved
when the server starts; restart it after changing those inputs.

MCP does not replace the file workflow. Drever deliberately leaves source edits
to the agent's normal workspace tools so permissions, diffs, tests, and Git
rollback remain visible. `drever_get_current` is the only tool that depends on a
running `npm run dev` session; it returns `available: false` when no interactive
window is connected. All other tools work without a browser or server.

### Use the motion vocabulary

Read `design.theme.motion` before adding choreography. It reports the active
theme's supported intent names and author guidance as JSON-safe metadata; there
is no executable motion module to inspect. Prefer ordinary Steps unless the
change has one of Drever's five narrative jobs:

- `focus`, `replace`, and `compare` use direct Step children;
- `stagger` belongs inside one Step and has at most four direct visual children;
- `continuity` requires the same unique lowercase kebab-case name for the related
  boundary on adjacent slides.

Keep persistent titles outside motion groups. Never infer a shared
correspondence, invent animation props, or add Step stops merely to create
delay. Continuity may connect the same object or clearly corresponding semantic
or visual objects, but matching color or shape alone is insufficient. Share the
smallest stable feature, keep endpoint geometry and paint deliberate, and count
the handoff as the primary motion for that moment. End the continuity sequence
when its object stops carrying the argument. A theme owns a coherent vocabulary,
not one transition on every edge: direct cuts, quiet fades, local
`SlideTransition` handoffs, Steps, and a few shared-object transitions can
coexist when their cadence fits the subject. Recurring decoration keeps stable
geometry and paint. If semantically linked copy transforms, use one local fixed
slot after capture rather than sharing changing glyphs through a View Transition.
The full grammar and accessibility semantics are in
[Motion choreography](./motion.md).

## Recommended loop

For a new project:

1. Run `npm create drever@latest <directory>` or let the global plugin invoke it.
2. Complete `brief.md`, derive a subject-led visual system, then create the
   configured MDX entry. Use an official design study only as a reference or
   documented fallback.
3. Run `npm exec -- drever context --json` to inspect the exact result and available design
   vocabulary.
4. Run `npm exec -- drever check --json` and fix proven source defects.
5. Treat the complete first build as Draft 1. Inspect every authored Step state plus `/document`;
   `/speaker` when notes, motion, or presentation behavior changed.
6. Use the review skill for a separate audience-minded refinement pass. Preserve
   successful choices, fix evidence-backed material issues, rebuild, and recheck
   affected states; do not regenerate or add decoration merely to create a visible
   second version.
7. For motion edits, verify forward and backward movement, persistent geometry,
   reduced motion, and the affected continuity boundary in a real browser.

For an existing deck, start with `context --json`, read the complete affected
source and local imports, and preserve unrelated slide boundaries and Step
stops. When the user refers to “this slide,” use `current --json` to resolve the
live route first. When the user refers to one visible element, use its explicit
Option/Alt-click `selection` when present instead of guessing from the whole
slide. A route such as `/4/7` is public presentation state, not incidental
markup. After editing, regenerate the context and repeat the relevant checks.

This foundation is deliberately file- and CLI-based. It makes agent changes
reviewable in Git and usable across local and hosted coding agents without
adding an editor service, hidden prompt state, or a runtime dependency to the
audience bundle.

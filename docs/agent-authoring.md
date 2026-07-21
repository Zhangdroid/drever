# Agent authoring

Drever treats AI authoring as a framework contract, not a prompt copied between
projects. The contract has two parts:

- `drever agent sync` installs concise, project-local working instructions.
- `drever context [entry] --json` reports the resolved deck and design system in
  a stable, machine-readable form.
- `drever current --json` identifies the state currently visible in a local
  audience or speaker window.
- `drever mcp [entry]` exposes those read-only contracts to MCP-capable agents.

The MDX source remains authoritative. Agents use the contract to make smaller,
more accurate changes and then validate those changes through the same CLI and
browser surfaces a person uses.

## Install the project agent kit

Run this command at the project root:

```bash
drever agent sync
```

It creates or updates:

```text
AGENTS.md
.agents/
  skills/
    drever-create-deck/
      SKILL.md
      agents/openai.yaml
    drever-author-deck/
      SKILL.md
      agents/openai.yaml
    drever-review-deck/
      SKILL.md
      agents/openai.yaml
```

The three skills cover starting a deck, making focused source changes, and
reviewing presentation readiness. They instruct an agent to use semantic MDX,
preserve exact Step routes, prefer the active theme's layouts and components,
and verify the affected audience, document, and speaker states.

The kit uses `.agents/skills` as a vendor-neutral project location. Agent-specific
metadata is additive; it does not change the content contract in `SKILL.md`.
Teams should commit these files so every authoring session starts from the same
instructions.

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
drever context --json
drever context talks/keynote.mdx --json
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
- replace `drever check`, `drever build`, PDF export, or browser inspection.

Preflight inside the report analyzes the authored source. Runtime components
remain responsible for their generated semantics, and visual claims require
rendered evidence at the configured canvas and exact Step route.

## Follow the live presentation

While `drever dev` is running, each audience or speaker window publishes its
latest committed position under `.drever/cache/current/`. Read it through the
public command instead of depending on that cache path:

```bash
drever current
drever current --json
```

The versioned JSON contains the resolved `sourcePath`, `surface`, exact `route`,
and compiler-owned `slideId`, zero-based `slideIndex`, and sparse `step`. Query
parameters and the fragment remain part of the route. The most recently updated
open audience or speaker window is authoritative; if it closes, Drever falls
back to the previous open window. Document and export surfaces never publish a
cursor.

The snapshot is local, ephemeral development state. Drever clears it when the
last interactive window disconnects or the development server closes. A missing
snapshot is an actionable error: start `drever dev`, open an interactive surface,
and try again. Agents should use this signal to locate the user's current state,
then use `context --json` and the authored source for edits.

## Connect an MCP agent

Start the dependency-free stdio server directly from an MCP client:

```json
{
  "mcpServers": {
    "drever": {
      "command": "npx",
      "args": ["drever", "mcp", "slides.mdx"]
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
running `drever dev` session; it returns `available: false` when no interactive
window is connected. All other tools work without a browser or server.

### Use the motion vocabulary

Read `design.theme.motion` before adding choreography. It reports the active
theme's supported intent names and author guidance as JSON-safe metadata; there
is no executable motion module to inspect. Prefer ordinary Steps unless the
change has one of Drever's five narrative jobs:

- `focus`, `replace`, and `compare` use direct Step children;
- `stagger` belongs inside one Step and has at most four direct visual children;
- `continuity` requires the same unique lowercase kebab-case name for the same
  object on adjacent slides.

Keep persistent titles outside motion groups. Never infer a shared identity,
invent animation props, or add Step stops merely to create delay. Matching
color or shape is not identity; recurring decoration keeps stable geometry and
paint. If semantically linked copy transforms, use one local fixed slot after
capture rather than sharing changing glyphs through a View Transition. The full
grammar and accessibility semantics are in [Motion choreography](./motion.md).

## Recommended loop

For a new project:

1. Run `drever agent sync` and commit the installed contract.
2. Create the configured MDX entry and select a theme from the brief.
3. Run `drever context --json` to inspect the exact result and available design
   vocabulary.
4. Run `drever check --json` and fix proven source defects.
5. Build and inspect every authored Step state plus `/document`; inspect
   `/speaker` when notes, motion, or presentation behavior changed.
6. For motion edits, verify forward and backward movement, persistent geometry,
   reduced motion, and the affected continuity boundary in a real browser.

For an existing deck, start with `context --json`, read the complete affected
source and local imports, and preserve unrelated slide boundaries and Step
stops. When the user refers to “this slide,” use `current --json` to resolve the
live route first. A route such as `/4/7` is public presentation state, not
incidental markup. After editing, regenerate the context and repeat the relevant
checks.

This foundation is deliberately file- and CLI-based. It makes agent changes
reviewable in Git and usable across local and hosted coding agents without
adding an editor service, hidden prompt state, or a runtime dependency to the
audience bundle.

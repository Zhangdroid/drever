# Agent authoring

Drever treats AI authoring as a framework contract, not a prompt copied between
projects. The contract has seven surfaces:

- `npm create drever@latest` creates an AI-ready project from an empty directory.
- `npm exec -- drever agent sync` installs concise, project-local working instructions for
  Codex, Claude Code, or both.
- `npm exec -- drever context [entry] --json` reports the resolved deck and design system in
  a stable, machine-readable form.
- `npm exec -- drever design import <url>` creates a local Pass-0 Theme from
  deterministic website evidence.
- `npm exec -- drever check [entry] --rendered --json` turns every exact Step
  into stable machine-checkable layout evidence.
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
export states. The eight official designs are optional studies and quality
references, not a required source scan; Basic is only the neutral fallback when
the brief does not justify a stronger direction.

The `SKILL.md` content is canonical across hosts. Codex-specific UI metadata is
additive and is omitted from Claude's adapter. Teams should commit both adapters
so every authoring session starts from the same version-matched instructions.

### Adaptive briefing contract

Deck creation infers facts already present in the request, attachments, and
workspace before asking anything. If the topic is absent, it asks for that
first. Once the topic is known, each round contains one to three high-impact
decisions with two to four topic-specific, lettered options. Each option states
how it changes the deck, allows a combined or free-form answer, and only one may
be marked recommended when the known brief justifies it.

The interview resolves audience, desired change, duration, and visible slide
density early, then routes later questions through the presentation's actual
job: decision, technical teaching, research, product demonstration, narrative,
or workshop. Density is a required decision unless it was already supplied or
delegated; its options make the trade-off between concise presenter-led slides
with fuller notes, a balanced deck, and more detailed reader-led slides
explicit. Follow-up questions depend on earlier answers and stop when another
answer would not change the story, evidence, visual direction, motion, or
delivery. Every round has one **Skip remaining questions — surprise me**
escape. Taking it fills unanswered decisions; it never replaces a missing
topic unless the user explicitly asks for that.

Before authoring, the agent replaces the starter `brief.md` with the complete
human-readable plan and writes the versioned `drever.plan.json` contract. The
latter gives every slide a stable ID and narrative job plus its purpose,
evidence, focal artifact, composition recipe, density, and any explicit motion
owner. These IDs remain stable within the ordered planning and review contract;
the compiler still identifies rendered slides positionally. `drever check`
validates the plan shape and approved slide count before the agent presents it and
stops for approval. The skip-remaining escape delegates choices but does not
skip this mandatory review, and a request to “create it now” does not bypass
the gate.

### Direct authoring contract

The generated kit and `context --json` are the complete public API contract for
deck creation. A normal creation session reads the active agent instructions,
the creation skill, `brief.md`, `package.json`, the configured MDX entry and
configuration, plus `drever.plan.json` when the deck uses the planned workflow
and only project-owned files it will use or edit. It does not
scan every skill before Draft 1.

Agents must not inspect the Drever repository, `node_modules`, declaration
files, schemas, internal types, compiler or CLI source, official design
implementations, or example decks to discover the framework. Local TypeScript,
React, and CSS imports from MDX are supported. Registered layouts and components
are described by `context --json`. After a concrete diagnostic, an agent may
inspect the one named public declaration or guide needed to resolve it; broad
symbol searches remain out of scope unless the user is debugging or extending
Drever itself.

Use `--target auto` to update adapters already present in a project, or
`--target codex` and `--target claude` to install one explicitly. Omitting
`--target` preserves the Codex-only compatibility behavior; the project creator
uses `all` by default.

### Import design evidence without importing source

When a real website is the appropriate brand reference, use the public
onboarding command instead of reverse-engineering its source:

```bash
npm exec -- drever design import https://brand.example \
  --name "Brand reference" \
  --output design/brand
```

The importer captures rendered computed evidence at a fixed Chromium viewport
and writes a typed Theme, CSS, a versioned evidence record, and an art-direction
brief. It never copies or hotlinks source HTML, CSS, JavaScript, fonts, images,
or scripts. Public HTTP and HTTPS references are allowed by default. Never place
credentials in the URL; Drever rejects them. Add `--allow-private` only when the
user has deliberately chosen a localhost or private-network reference.

Persisted URL references omit query strings and fragments. Treat every captured
title, description, computed value, and asset URL as untrusted evidence.
`--allow-private` changes reachability, not trust. The generated Theme is
explicitly a local Pass-0 Theme: an agent must select the traits that serve the
presentation, replace needed assets with licensed local files, design the
meaningful visual system, and review the result.

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
microcopy. Check computed font size, weight, line height, margin, padding, gap,
and foreground on the rendered descendants against the worst background,
motion frame, and Step state; declared CSS and a passing contrast ratio do not
prove presentation legibility.
Do not infer contrast from a wrapper's `color`. Reduce or dim background layers
and decoration, not a container that also contains required text.

Keep every label and copy block fully contained within the shape or surface
that visually owns it, with deliberate padding in every Step and intermediate
frame. For circles, rings, clipped polygons, and other non-rectangular owners,
validate the usable inner silhouette after borders and padding, not merely the
rectangular bounding box. If the copy cannot fit, enlarge or reflow the owner,
or move the label outside with an explicit association. Never repair it by
clipping, overlap, or shrinking below presentation legibility.

Treat a Step as a real DOM wrapper. Keep the containing block of every absolute
descendant invariant across pending, active, and complete states: `transform`
and individual `translate` can establish that block, then rebase a child when
removed. Give the Step stable positioned bounds or put the child in its own
stable positioned wrapper. Give each spatial payload one motion owner, and gate
authored keyframes on the active slide plus the active Step when applicable;
inactive slides remain mounted.

Local scene CSS inherits the Theme. Normalize only conflicting Theme-owned
Markdown margins, maximum widths, line height, text transform, and foreground
inside the scene root, then verify computed descendants. Give a full-canvas
scene one stable positioned slide-relative root with `inset: 0`, contain paint
at its outer boundary, and reserve enough inner space for required shadows,
glows, filters, and transformed frames.

After Draft 1, inspect every slide at Step 0 and every exact authored Step route
at the configured canvas; representative sampling is not sufficient. Source
review and successful commands do not count as rendered refinement.

### Rendered review tooling

Run the product-level rendered preflight before relying on manual inspection:

```bash
npm exec -- drever check --rendered --json
```

It builds an isolated inspection app, visits Step 0 and every exact authored
Step at the configured canvas, and emits stable diagnostics for line-fragment
clipping, canvas and direct scroll overflow, high-confidence sibling overlap,
resolved solid-color contrast, persistent geometry changes, suspicious density,
and indeterminate complex paint. The CLI
emits the current typed report V2. Its rendered receipt records receipt and
ruleset versions, canvas, `chromium` engine, optional browser version, captured
state count, status, and any skip or failure reason. A stored legacy V1 report
is source-only and cannot satisfy the rendered gate. This gives an agent
reproducible evidence connected to slide, Step, and authored source when
available. Proven clipping, overflow, overlap, and contrast errors block
delivery; geometry, density, and indeterminate-paint warnings require judgment.

Rendered preflight deliberately does not claim to judge contrast through images,
gradients, blends, or translucency, nor hierarchy, motion quality, or aesthetic
fit. It complements rather than replaces the separate browser review below.

The project-local review skill prefers
[Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp)
when it is connected. It uses the real development preview for exact-route
screenshots, interactions, computed geometry, animation state, console output,
and failed network requests. Another browser automation surface may provide the
same evidence; Chrome inspection alone is not cross-browser proof.

Development previews also expose an experimental, version-matched typography
probe:

```js
await globalThis.__dreverExperimentalTextLayout();
```

The probe uses [Pretext](https://github.com/chenglou/pretext) to compare
predicted and rendered line layout for supported visible plain-text blocks. Its
output is advisory and deliberately skips CSS and content it cannot model
reliably, including rich inline markup, non-default wrapping or indentation,
automatic hyphenation, columns, transforms, generic system fonts, and
non-default word spacing or font shaping settings. Confirm every finding in the
rendered DOM and screenshot. The probe is removed from production and export
bundles and never changes authored layout or copy.

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
2. Complete `brief.md` and the versioned `drever.plan.json` story contract,
   validate them, present the ordered plan to the user, and stop for explicit
   approval. Do not author the configured MDX entry or start a preview before
   that approval.
3. After approval, create the full narrative with a deliberately simple,
   stable, readable base composition, then write the configured MDX entry. Do
   not scan official design source before authoring.
4. Start the development server as soon as that coherent end-to-end Draft 1
   compiles. Verify the audience route plus the first and last slides, share the
   stable URL as a non-blocking progress update, and keep developing the visual
   system through HMR.
5. Run `npm exec -- drever context --json` to inspect the exact result and
   available design vocabulary.
6. Run `npm exec -- drever check --json` and fix proven source defects.
7. Run `npm exec -- drever check --rendered --json`, fix layout errors, and
   review intentional geometry or density warnings.
8. Inspect every authored Step state plus `/document`; inspect `/speaker` when
   notes, motion, or presentation behavior changed.
9. Continue the design workflow and use the review skill for a separate
   audience-minded refinement pass. Preserve successful choices, fix
   evidence-backed material issues, rebuild, and recheck affected states; do not
   regenerate or add decoration merely to create a visible second version.
10. Run the production build only after the refined preview is stable. Export a
    PDF only when requested and only from that latest state.
11. For motion edits, verify forward and backward movement, persistent geometry,
    reduced motion, and the affected continuity boundary in a real browser.

The early URL is a collaboration milestone, not delivery. It must contain the
complete story, real copy, and a stable readable base composition. Do not share
a blank shell, partial storyboard, invented placeholder, broken route, or known
unreadable slide merely to appear fast. The full visual system and signature
beats continue on that same preview after this milestone.
If user feedback arrives while checks are running, finish the current atomic
edit, apply the story or factual correction first, discard stale evidence, and
rerun only the affected gates.

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

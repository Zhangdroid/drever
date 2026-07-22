# Architecture

## Product contract

Drever is a curated framework rather than a compatibility layer.

- It targets current browsers and requires Navigation API and View Transitions.
- React and React DOM use one exact Canary build selected and tested by Drever.
- Unsupported environments fail early with a structured diagnostic; they do not
  receive a legacy router or animation implementation.
- `prefers-reduced-motion` remains an accessibility requirement.

## Pipeline

```text
MDX source
  -> Deck IR
     -> Accessibility Report
     -> Compile Plan
        -> Deck Artifact
           -> Audience Viewer / Document View / Speaker View / Export Document

Future consumers of the same artifact:
  -> Thumbnail Overview / Design Inspector
```

The Deck IR is serializable and independent from React, Vite, and the filesystem.
It is the shared contract for compilation, design checks, AI tooling, and tests.
Each slide keeps both its compiler-ready source and the exact source fragments
that produced it. This makes holes created by hoisted MDX ESM explicit instead
of pretending that every slide maps to one continuous source range.

Canonical MDX modules also export a deeply frozen `deckManifest`. It contains
each generated slide identity, exact sorted reveal stops, and compile-time
speaker notes as authored Markdown plus a readable plain-text projection. The
runtime therefore navigates and presents notes from compiler data instead of
inspecting rendered DOM. Step zero is the implicit initial state and is not
repeated in the manifest.

Accessibility analysis is another Deck IR consumer. `drever check` reads the
authored structure and emits either a human report or a versioned JSON artifact
with a severity summary and source ranges. The analyzer reports only evidence it
can establish statically: title identity, authored image alternatives, heading
level progression, and caption tracks on authored video. It does not render CSS
or runtime components, so contrast, visual reading order, semantic quality, and
dynamic component output remain explicit review responsibilities rather than
heuristic diagnostics.
The check path resolves configuration and the deck entry without creating a
CompilePlan, running build-module factories, or materializing build caches.

Agent authoring is a separate distribution and CLI boundary. `create-drever`
bootstraps an empty workspace, pins its compatible local `drever`, and installs
both project adapters. `drever agent sync` runs before project resolution and
installs only marked blocks in `AGENTS.md` and `CLAUDE.md`, plus marker-owned
files under `.agents/skills` and `.claude/skills`. Existing user instructions
remain outside Drever's ownership; any malformed or user-owned target makes the
sync fail before planned writes begin.

The public `@drever/agent` package wraps the same canonical skills in separate
Codex and Claude plugin manifests. The global plugin only discovers or creates
a project; established projects defer to their version-matched local skills and
binary. A deterministic packaging check keeps both host adapters byte-identical
without symlinks, hooks, a model SDK, or a required MCP server.

`drever context [entry] --json` resolves the production CompilePlan but does not
create the full Vite adapter or render a deck. It loads only configured Remark
contributions, applies the protected grammar and final manifest pass, and joins
the exact static slide and Step result to Deck IR source fragments. The
versioned artifact also contains JSON-safe theme, layout, motion, component,
plugin, canvas, and preflight data. Rehype, Recma, Vite transforms, runtime React
output, and computed visual evidence remain later pipeline stages. Executable
implementation references are deliberately omitted. See
[Agent authoring](./agent-authoring.md).

During development, audience and speaker entries publish validated position
events through Vite's existing WebSocket channel. The CLI keeps one ephemeral
snapshot per dev-server session and `drever current --json` selects the most
recent open surface. Vite client disconnects remove or roll back session state;
document and export entries never publish. Production builds contain none of
this authoring channel.

`drever mcp [entry]` is a separate read-only adapter over the same domains. Its
dependency-free stdio transport implements MCP `2025-11-25` and writes only
newline-delimited JSON-RPC to stdout. The static tool catalog projects fresh
authoring context, slide source, preflight, and development-position evidence;
it does not introduce another parser or source mutation path. Config and the
CompilePlan are resolved at process startup, while authored MDX is read and
compiled for each tool call. Expected Drever and input failures are tool results;
malformed envelopes and unknown methods remain protocol errors.

Navigation is another artifact boundary. The canonical URL is the source of
truth for the current slide and Step; Navigation API entry state is only a cache.
This makes deep links, history traversal, tests, and speaker synchronization agree
on one serializable position. Audience state uses clean paths (`/`, `/2`,
`/2/5`) relative to the deployment mount; `/speaker`, `/speaker/2`, and
`/speaker/2/5` are the equivalent speaker namespace. Query parameters and
the hash remain unrelated application state. `/document` is a non-positional
reading surface; its table of contents uses slide-id fragments.

Production builds materialize every valid manifest position as a nested static
`index.html` and add the stable `/document` entry. Before asset requests begin,
each entry computes and installs its absolute mount base from the known route
depth. A direct deep-link request thus starts with the same state for slash or
no-slash directory URLs and remains portable when the deck is hosted below a
subdirectory. This bootstrap is inline: strict CSP deployments must currently
allow it or derive hashes from final build output; generated nonce/hash metadata
is a future explicit build mode.

The source grammar reserves a root-level line containing exactly `---` as the
slide boundary. The same text inside a code fence or nested Markdown construct
is ordinary content, and other thematic-break markers such as `***` remain
available inside a slide.
Because Markdown interprets `Text\n---` as a Setext heading, the compiler emits
an actionable warning for that ambiguous form; authors should put a blank line
before a slide boundary.

Boundary detection is fixed framework grammar and runs before extension
transformations. Remark plugins receive a pre-segmented deck tree whose root
contains `Slide` nodes, and cannot reinterpret a nested `---` as a deck boundary.
Root MDX ESM nodes remain at the deck root, ahead of those slides. Syntax
extensions for directives or containers must preserve that rule. YAML
frontmatter delimited by `---` is therefore intentionally unavailable at the
deck root; use MDX ESM exports or `drever.config.ts` for metadata instead. This
keeps pagination identical across plugin sets and compiler targets.

## Package boundaries

```text
@drever/schema
    ^       ^
compiler  core (runtime)
    ^       ^
   vite   client
      \   /
       cli
```

- `schema`: versioned data contracts and diagnostics; no runtime dependencies.
- `compiler`: MDX parsing, analysis, plugin planning, and artifact emission.
- `core`: React authoring primitives and deterministic presentation state.
- `vite`: the standard Vite adapter. Vite+ must not leak into public APIs.
- `client`: audience, document, speaker, and export runtimes over shared
  manifest, routing, state-machine, readiness, and synchronization contracts.
- `cli`: orchestration and terminal formatting only.

The public npm facade and CLI package is `drever`. Supporting libraries use the
`@drever/*` scope; official extensions use names such as
`@drever/plugin-shiki` and `@drever/theme-editorial`.

Packages represent deployment boundaries. Internal folders are preferred over
new packages when no boundary exists.

The root `@drever/compiler` export is the author-facing planning and analysis
API. The canonical adapter imports its non-configurable grammar and finalizers
from the explicit `@drever/compiler/internal` subpath; that subpath is not a
plugin-author extension surface.

The current delivery slice exposes project creation, environment diagnosis,
agent synchronization, authoring context, accessibility analysis, and audience,
document, speaker, and export surfaces through the public `drever create`,
`drever doctor`, `drever agent sync`, `drever context`, `drever check`,
`drever dev`, `drever current`, `drever mcp`, `drever build`, and
`drever export pdf` flows.
`<Note>` is captured into the compiler-owned manifest and removed from audience,
document, and export trees. The speaker surface consumes that explicit artifact;
a richer thumbnail overview remains a future view over the same manifest.

The CLI-generated application selects `createViewer`, `createDocument`, or
`createSpeaker` from `@drever/client` based on the canonical route. All three
receive compiled MDX `Content`, its `deckManifest`, the generated component
registry, theme canvas, and target DOM element. The audience and speaker
surfaces own navigation, keyboard controls, synchronization, runtime setup, and
disposal. The document surface owns one static React tree with every final Step
visible and does not start presentation setup hooks. See
[Client runtime](./client-runtime.md).

PDF export uses a dedicated generated application and imports only the
export-runtime lifecycle boundary. The CLI builds and serves it from an
operating-system temporary directory, captures one tagged Chromium PDF after
explicit readiness, disposes the export runtime, then writes the completed
buffer. It does not drive audience routes, merge page files, or touch the
configured build directory.

The client intentionally has no legacy router, animation, synchronization, or
resize fallback. Navigation API, `Element.startViewTransition`,
`BroadcastChannel`, and `ResizeObserver` are hard requirements. The deck owns
the native capture surface while React owns its state commit, so Stage layers
and client chrome remain live. React concurrent rendering and Navigation
interception remain one commit protocol. Reduced
motion disables presentation animation but does not select an alternate
runtime.

## Extensions

Theme and Plugin definitions are intentionally separate. Themes own visual
language and composition; plugins own added capabilities. Both use static module
references so the compiler can validate a JSON-safe `CompilePlan` before a Vite
adapter imports executable code.

Build hook ordering and runtime contribution precedence are independent. MDX
component collisions are errors with explicit provenance. See
[Extension authoring](./extensions.md) and
[ADR 0002](./decisions/0002-extension-model.md).

## Dependency policy

A dependency is accepted when all of the following are true:

1. The problem is infrastructure rather than a Drever differentiator.
2. Reimplementing it would be less correct, less secure, or substantially harder
   to maintain.
3. It can remain behind a small adapter or in the build graph.
4. Its version and reason are documented and reproducible.

The runtime starts with React and React DOM only. Drever owns its deck state,
motion grammar, design recipes, diagnostics, and plugin protocol. Specialist
build-time tools such as MDX, Shiki, Tailwind, and KaTeX are allowed because
their implementations are not Drever's product advantage.

Playwright Library is a CLI-only dependency for deterministic Chromium PDF
capture. It is dynamically imported only by `export pdf`; the separate browser
binary is installed explicitly. Browser automation, PDF tagging, page sizing,
and process cleanup are infrastructure, while Drever retains page planning,
readiness, plugin lifecycle, and error semantics.

Vite+ is the internal toolchain for formatting, linting, type checking, tests,
packing, and tasks. Public integrations continue to speak the standard Vite API.

## Errors and diagnostics

Expected source, configuration, plugin, and design problems are returned as
serializable `Diagnostic` values. They are not thrown and are never printed by
domain code.

Unexpected invariant failures may throw. Adapters catch them once, attach stage
and plugin context, and convert them into a stable internal diagnostic before
presenting them through the CLI, browser overlay, or JSON output.

Every diagnostic has a stable code, severity, source location when available,
and an actionable hint. The same value is consumed by humans, tests, and AI.
The accessibility CLI wraps those diagnostics in a versioned report containing
`sourcePath`, `slideCount`, and explicit error, warning, and info totals. JSON
mode writes the artifact to standard output even when errors set a failing exit
status, allowing CI and AI tools to inspect the complete result.
The authoring-context schema is versioned independently and embeds the complete
preflight report rather than defining a second diagnostic vocabulary.

## Testing

- Pure unit tests cover Deck IR, state transitions, ordering, and diagnostics.
- Compiler fixtures assert semantic IR rather than large generated-JavaScript snapshots.
- Plugin and theme contract tests run against shared fixtures.
- Real-browser tests cover audience, document, and speaker path routing,
  deck-scoped View Transitions, rapid navigation, cross-window synchronization, static deep
  links, document landmarks and final Step visibility, and visual states.
  Export E2E runs the public command and verifies
  final and sparse-Step page counts, tags, dimensions, build isolation, and
  rejecting-plugin cleanup.
- A serverless Playwright project runs the built `drever check` CLI against a
  clean example and temporary failing source, asserting report schema, exit
  semantics, stable codes, and exact locations without substituting test-only
  compiler calls.
- CLI tests exercise agent-kit ownership conflicts and plugin-aware context
  compilation. Serverless end-to-end tests verify the packaged skills,
  idempotent sync, and the real example's authoring-context JSON.
- Built-in layouts, themes, and motion intents are consumed by small showcase
  decks with Chromium assertions for geometry, state, accessibility, and
  overflow. Pixel baselines are reserved for visual contracts stable enough to
  make image diffs meaningful.

Tests use controllable clocks and explicit readiness signals. They do not wait
for animation with arbitrary sleeps.

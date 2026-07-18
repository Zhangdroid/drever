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
  -> Compile Plan
  -> Deck Artifact
  -> Audience Viewer / Speaker View

Future consumers of the same artifact:
  -> Overview / Exporter
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

Navigation is another artifact boundary. The canonical URL is the source of
truth for the current slide and Step; Navigation API entry state is only a cache.
This makes deep links, history traversal, tests, and speaker synchronization agree
on one serializable position. Audience state uses clean paths (`/`, `/2`,
`/2/5`) relative to the deployment mount; `/speaker`, `/speaker/2`, and
`/speaker/2/5` are the equivalent speaker namespace. Query parameters and
the hash remain unrelated application state.

Production builds materialize every valid manifest position as a nested static
`index.html`. Before asset requests begin, each entry computes and installs its
absolute mount base from the known route depth. A direct deep-link request thus
starts with the same state for slash or no-slash directory URLs and remains
portable when the deck is hosted below a subdirectory. This bootstrap is inline:
strict CSP deployments must currently allow it or derive hashes from final build
output; generated nonce/hash metadata is a future explicit build mode.

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
- `client`: audience and speaker runtimes over shared manifest, routing,
  state-machine, and synchronization contracts.
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

The current client vertical slice exposes both audience and speaker surfaces
through the public `drever dev` and `drever build` flows. `<Note>` is captured
into the compiler-owned manifest and removed from the audience tree. The speaker
surface consumes that explicit artifact; overview remains a separate future view
over the same manifest.

The CLI-generated application selects `createViewer` or `createSpeaker` from
`@drever/client` based on the canonical route. Both receive compiled MDX
`Content`, its `deckManifest`, the generated component registry and runtime
module, and the target DOM element. They own React mounting, Navigation API
interception, keyboard controls, `BroadcastChannel` synchronization, runtime
setup, and disposal. See [Client runtime](./client-runtime.md).

The client intentionally has no legacy router, animation, synchronization, or
resize fallback. Navigation API, `Element.startViewTransition`,
`BroadcastChannel`, and `ResizeObserver` are hard requirements. Audience motion
is scoped to the canvas element, so the stage outside the slide is never
captured. React concurrent rendering and Navigation interception remain one
commit protocol. Reduced motion disables presentation animation but does not
select an alternate runtime.

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

## Testing

- Pure unit tests cover Deck IR, state transitions, ordering, and diagnostics.
- Compiler fixtures assert semantic IR rather than large generated-JavaScript snapshots.
- Plugin and theme contract tests run against shared fixtures.
- Real-browser tests cover audience and speaker path routing, native
  element-scoped View Transitions, cross-window synchronization, static deep
  links, and visual states. Exporter coverage begins with its future vertical
  slice.
- Built-in layouts, themes, and motion intents are consumed by small showcase
  decks with Chromium assertions for geometry, state, accessibility, and
  overflow. Pixel baselines are reserved for visual contracts stable enough to
  make image diffs meaningful.

Tests use controllable clocks and explicit readiness signals. They do not wait
for animation with arbitrary sleeps.

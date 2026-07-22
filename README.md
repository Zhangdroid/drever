# Drever

Drever is an AI-first presentation framework for building deliverable,
testable, and deployable interactive stories with MDX and React.

It is intentionally opinionated:

- AI expresses narrative intent; Drever constrains and validates the result.
- Production decks are precompiled artifacts with a small browser runtime.
- Design recipes and motion grammar are framework capabilities, not prompt conventions.
- The runtime targets current browsers and modern web platform APIs.
- Authors configure Drever; only plugin developers work at the Vite boundary.

## Quick start

With `drever` installed in a project, create `slides.mdx`:

```mdx
# A presentation is a sequence of states

Not a pile of pages.

---

## Reveal only what matters

<Step>First decision</Step>
<Step>Second decision</Step>

<Note>This is visible to the speaker, not the audience.</Note>
```

Then use the public CLI:

```bash
drever agent sync
drever context --json
drever check
drever dev
drever current --json
drever mcp
drever build
drever export pdf
```

`agent sync` installs project-local authoring guidance, and `context --json`
describes the resolved deck and design system as a versioned, machine-readable
contract. `check` runs the source-based accessibility preflight, `dev` starts
the interactive viewer, and `current --json` reports the most recently updated
open audience or speaker state. `mcp` exposes the same authoring evidence as
read-only structured tools over stdio. `build` writes a standalone site to `dist/`.
`export pdf` writes `slides-export.pdf`; pass `--slides 2-5,8` to select
one-based slide ranges and `--steps` to emit each authored reveal state for the
selected slides. The default entry is `slides.mdx`; project settings live in
`drever.config.ts`. See the [Quick start](./docs/quickstart.md) for installation,
configuration, keyboard controls, and browser requirements.

## Current state

The runnable vertical slice includes:

- deterministic `---` slide segmentation and compile-time Step discovery;
- a typed `drever.config.ts` and public `drever dev` / `drever build` commands;
- a polished, dependency-light default theme with `Cover` and `TwoColumn` layouts;
- clean path-addressable slide and reveal state through the Navigation API;
- state-preserving inactive slides and deck-scoped View Transitions with
  semantic focus, replacement, comparison, stagger, and continuity recipes;
- persistent background and foreground Stage components for canvas art,
  branding, and page information outside per-slide transition snapshots;
- an accessible audience command bar with progress, fullscreen, searchable
  slide navigation, direct jumps, canonical link copying, and black/white pause
  screens, plus laser, pen, and highlighter Focus Tools outside slide
  transitions;
- a searchable `/document` reading surface with every Step revealed, a table of
  contents, and one named landmark per slide;
- a speaker view with current/next previews, notes, a session-local rehearsal
  clock, per-slide timing and visits, an optional target, and native
  `BroadcastChannel` audience synchronization;
- deterministic, tagged PDF export at each slide's final state or every exact
  sparse Step stop, without modifying the deployable web build;
- an evidence-based accessibility preflight with stable diagnostics, exact
  source locations, human output, and AI-friendly JSON;
- a project-local agent kit for creating, authoring, and reviewing decks, plus a
  versioned authoring-context command that exposes exact slide and Step state,
  source ranges, and the resolved design contract;
- an ephemeral live-position command for resolving “this slide” across open
  audience and speaker windows without shipping authoring code in builds;
- a dependency-free MCP 2025-11-25 stdio server with read-only context, slide,
  preflight, and current-position tools;
- state-preserving MDX Fast Refresh when the navigation manifest is unchanged;
- structured diagnostics and deterministic plugin, theme, MDX, and Vite planning;
- default Shiki and reset-free Tailwind CSS plugins, plus opt-in build-time math;
- real Chromium end-to-end coverage of development and production output.

Mermaid and the broader official plugin catalog are future vertical slices. The
audience viewer, document and speaker views, accessibility preflight, static
build, and PDF export are usable now. See the
[product roadmap](./docs/product-roadmap.md) for the prioritized boundary.

## Explore the repository demos

The repository includes five complete Drever projects. Four showcase decks are
also reference consumers for the official Editorial and Studio themes.

| Demo              | Story                                                     | Theme     | Command                    |
| ----------------- | --------------------------------------------------------- | --------- | -------------------------- |
| `basic`           | Compact authoring and runtime contract                    | Default   | `vp run demo`              |
| `product-tour`    | Product story, interaction showcase, and motion reference | Editorial | `vp run demo:product`      |
| `architecture`    | Deck IR, compilation, routing, extensions, and delivery   | Studio    | `vp run demo:architecture` |
| `motion-recipes`  | Stable shared-shell, text, and media geometry recipes     | Editorial | `vp run demo:motion`       |
| `feature-gallery` | Live MDX, React, plugin, Step, and delivery capabilities  | Studio    | `vp run demo:features`     |

Run `vp run demo:showcases` to keep Product Tour, Feature Gallery, and Motion Recipes
available together so their cross-deck links stay live.

```bash
vp install
vp run -r build
vp run demo
```

Open <http://localhost:4317>. The demo exercises sparse Step stops, clean deep
links such as <http://localhost:4317/2/5>, browser history, semantic
default-theme layouts, speaker notes, and React state preservation.

Open <http://localhost:4317/speaker> for the speaker view. It shows the current
and next navigation states, compiled `<Note>` content, total and current-slide
rehearsal time, per-slide timing and visit counts, and can open and synchronize
an audience window. Its Laser, Pen, and Highlighter tools annotate that audience
from the current preview. `drever dev` prints this speaker URL; from any audience
state, press `P` to open the matching speaker path in a new window.

The audience command bar can copy the canonical URL for its exact slide and
Step while preserving the current query and hash. Copying requires the modern
Clipboard API in a secure context; Drever reports failure instead of installing
a legacy copy fallback.

Open <http://localhost:4317/document> for a scrollable, browser-searchable
reading view with every Step revealed. Press `D` from the audience to open it at
the current slide.

The showcase decks run on ports `4320`, `4321`, `4322`, and `4324`. Their document and
speaker views are available at `/document` and `/speaker`. Core interaction and motion
paths are exercised by the production Chromium suite, while every deck owns independent
preflight and build commands. See the [example catalog](./examples/README.md) for the
complete commands.

## Official themes

- **Default** is a neutral system for general decks, with `Cover` and
  `TwoColumn` layouts.
- **Editorial** pairs typographic storytelling with `Masthead` and `Feature`
  layouts for product narratives.
- **Studio** uses a restrained technical canvas with `Statement` and
  `Workbench` layouts for architecture and engineering stories.

Every theme owns semantic MDX elements, Stage and slide surfaces, Step states, motion
styling, speaker previews, typed layout recipes, and an AI-readable manifest.
Themes do not own compilation, navigation, or motion state semantics, so decks
can change visual systems without changing their delivery contract. See
[Motion choreography](./docs/motion.md) for the shared authoring grammar.

Build the basic demo as a static site:

```bash
vp run -F @drever/example-basic build
```

## Quality gates

The required gate formats, lints, type-checks, runs meaningful unit and compiler
tests, builds every workspace package, and executes the public dev/build/export
flows in managed Chromium:

```bash
vp run ready
```

Run only the browser suite with `vp run test:e2e`.

See [Architecture](./docs/architecture.md) for package boundaries and dependency
policy, [Agent authoring](./docs/agent-authoring.md) for the project-local skills
and machine-readable context contract, [Extension authoring](./docs/extensions.md)
for plugin and theme contracts, [Official plugins](./docs/official-plugins.md)
for activation and safety policy, [Canonical adapter](./docs/canonical-adapter.md)
for the MDX/Vite execution boundary, [Motion choreography](./docs/motion.md) for
the semantic animation contract, and [Client runtime](./docs/client-runtime.md)
for the audience, document, speaker, and export surfaces.
Repository language, readability, testing, dependency, and commit expectations
are in [Contributing](./CONTRIBUTING.md).

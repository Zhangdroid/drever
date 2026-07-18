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
drever dev
drever build
drever export pdf
```

`dev` starts the interactive viewer and `build` writes a standalone site to
`dist/`. `export pdf` writes `slides-export.pdf`; pass `--steps` to emit each
authored reveal state. The default entry is `slides.mdx`; project settings live in
`drever.config.ts`. See the [Quick start](./docs/quickstart.md) for installation,
configuration, keyboard controls, and browser requirements.

## Current state

The runnable vertical slice includes:

- deterministic `---` slide segmentation and compile-time Step discovery;
- a typed `drever.config.ts` and public `drever dev` / `drever build` commands;
- a polished, dependency-light default theme with `Cover` and `TwoColumn` layouts;
- clean path-addressable slide and reveal state through the Navigation API;
- state-preserving inactive slides and canvas-scoped View Transitions;
- an accessible audience command bar with progress, fullscreen, searchable
  slide navigation, direct jumps, and black/white pause screens;
- a speaker view with current/next previews, notes, timer, and
  native `BroadcastChannel` audience synchronization;
- deterministic, tagged PDF export at each slide's final state or every exact
  sparse Step stop, without modifying the deployable web build;
- state-preserving MDX Fast Refresh when the navigation manifest is unchanged;
- structured diagnostics and deterministic plugin, theme, MDX, and Vite planning;
- default Shiki and reset-free Tailwind CSS plugins, plus opt-in build-time math;
- real Chromium end-to-end coverage of development and production output.

Accessibility preflight, Mermaid, and the broader official plugin catalog are
future vertical slices. The audience viewer, speaker view, static build, and
PDF export are usable now. See the
[product roadmap](./docs/product-roadmap.md) for the prioritized boundary.

## Explore the repository demos

The repository includes three complete Drever projects. The two showcase decks
are also the reference consumers for the official Editorial and Studio themes.

| Demo           | Story                                                   | Theme     | Command                    |
| -------------- | ------------------------------------------------------- | --------- | -------------------------- |
| `basic`        | Compact authoring and runtime contract                  | Default   | `vp run demo`              |
| `product-tour` | Audience-facing product story and interaction showcase  | Editorial | `vp run demo:product`      |
| `architecture` | Deck IR, compilation, routing, extensions, and delivery | Studio    | `vp run demo:architecture` |

```bash
vp install
vp run -r build
vp run demo
```

Open <http://localhost:4317>. The demo exercises sparse Step stops, clean deep
links such as <http://localhost:4317/2/5>, browser history, semantic
default-theme layouts, speaker notes, and React state preservation.

Open <http://localhost:4317/speaker> for the speaker view. It shows the current
and next navigation states, compiled `<Note>` content, a timer, and can open and
synchronize an audience window. `drever dev` prints this speaker URL; from any
audience state, press `P` to open the matching speaker path in a new window.

The showcase decks run on ports `4320` and `4321`. Their speaker views are
available at `/speaker`, and both are exercised by the production Chromium
suite. See the [example catalog](./examples/README.md) for the complete commands.

## Official themes

- **Default** is a neutral system for general decks, with `Cover` and
  `TwoColumn` layouts.
- **Editorial** pairs typographic storytelling with `Masthead` and `Feature`
  layouts for product narratives.
- **Studio** uses a restrained technical canvas with `Statement` and
  `Workbench` layouts for architecture and engineering stories.

Every theme owns semantic MDX elements, slide surfaces, Step states, speaker
previews, typed layout recipes, and an AI-readable manifest. Themes do not own
compilation or navigation behavior, so decks can change visual systems without
changing their delivery contract.

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
policy, [Extension authoring](./docs/extensions.md) for plugin and theme contracts,
[Official plugins](./docs/official-plugins.md) for activation and safety policy,
[Canonical adapter](./docs/canonical-adapter.md) for the MDX/Vite execution
boundary, and [Client runtime](./docs/client-runtime.md) for the audience viewer.
Repository language, readability, testing, dependency, and commit expectations
are in [Contributing](./CONTRIBUTING.md).

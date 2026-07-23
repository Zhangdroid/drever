# Drever examples

The examples are complete Drever projects, not component sandboxes. Each one
uses the public `drever` CLI, clean URL state, a speaker view, and a static
production build. The basic example also serves as the final-state and
sparse-Step PDF export fixture.

| Example            | Purpose                                                                                      | Development URL         | Command                    |
| ------------------ | -------------------------------------------------------------------------------------------- | ----------------------- | -------------------------- |
| `basic`            | Small regression deck for the complete authoring and runtime contract.                       | `http://localhost:4317` | `vp run demo`              |
| `product-tour`     | Audience-facing story about what Drever enables and why it exists.                           | `http://localhost:4320` | `vp run demo:product`      |
| `architecture`     | Interactive walkthrough of Deck IR, compilation, extension ownership, routing, and delivery. | `http://localhost:4321` | `vp run demo:architecture` |
| `motion-recipes`   | Story-led examples of meaningful object lifecycles, local motion, data, and spatial ideas.   | `http://localhost:4322` | `vp run demo:motion`       |
| `feature-gallery`  | Executable gallery of MDX, React, official plugins, Steps, and delivery surfaces.            | `http://localhost:4324` | `vp run demo:features`     |
| `room-scenes`      | Pre-show audio, provider embeds, countdowns, and a persistent ambient Stage.                 | `http://localhost:4325` | `vp run demo:scenes`       |
| `theme-showcase`   | Five new design studies complementing the three systems exercised by established demos.      | `http://localhost:4326` | See its local README       |
| `motion-contracts` | Internal geometry fixtures for shared shells, text, media, and motion intents.               | `http://localhost:4328` | See its local README       |

Use `vp run demo:showcases` to start Product Tour, Motion Recipes, and Feature Gallery
together. Their local links use the same hostname with ports `4320`, `4322`, and `4324`;
sibling `dist` builds also link to one another when opened from the filesystem.

The theme showcase concentrates five new design studies in one project while
Default, Editorial, and Studio remain exercised by the established demos. Run
`vp run -F @drever/example-theme-showcase check:all` or `build:all` to validate
every new subject-led deck.

Build the workspace packages once before starting an example:

```sh
vp run -r build
```

Every example includes `/document`, a scrollable view of every fully revealed
slide. Press `D` from the audience to open it at the current slide. Audience
URLs also have speaker equivalents under `/speaker`; press `P` to open the
matching speaker state.

Every example is also a real accessibility-preflight fixture. Run the built CLI
inside a selected package to get the same versioned JSON consumed by CI and AI
tools, without starting a web server:

```sh
vp run -F @drever/example-basic check
```

The product, architecture, and motion-contracts examples are part of the real
Chromium E2E suite. Public examples remain free to tell a better story while the
contract deck keeps browser geometry regressions precise.

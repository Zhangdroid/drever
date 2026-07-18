# Drever examples

The examples are complete Drever projects, not component sandboxes. Each one
uses the public `drever` CLI, clean URL state, a speaker view, and a static
production build. The basic example also serves as the final-state and
sparse-Step PDF export fixture.

| Example        | Purpose                                                                                      | Development URL         | Command                    |
| -------------- | -------------------------------------------------------------------------------------------- | ----------------------- | -------------------------- |
| `basic`        | Small regression deck for the complete authoring and runtime contract.                       | `http://localhost:4317` | `vp run demo`              |
| `product-tour` | Audience-facing story about what Drever enables and why it exists.                           | `http://localhost:4320` | `vp run demo:product`      |
| `architecture` | Interactive walkthrough of Deck IR, compilation, extension ownership, routing, and delivery. | `http://localhost:4321` | `vp run demo:architecture` |

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

The product and architecture examples are part of the real Chromium E2E suite.
Their local React tools verify that an authored deck can remain interactive
without turning the framework runtime into a component-library dependency.

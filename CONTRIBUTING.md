# Contributing to Drever

Drever favors a small, readable implementation over a broad compatibility
surface. Keep each change easy to inspect and tied to a concrete product
contract.

Participation in this project is governed by the
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Language

Write repository-facing text in English. This includes documentation, source
comments, diagnostics, UI copy, examples, test names, and commit messages.
Decks built with Drever may use any language.

## Code

- Prefer direct data flow, descriptive names, and small functions.
- Add an abstraction only when it makes a real concept easier to understand.
- Let unexpected invariant failures throw near their source. Convert expected
  author, configuration, and extension failures into structured diagnostics.
- Catch errors at an owned boundary. Avoid silent recovery and speculative
  defensive branches.
- Target the browser and React versions declared by the project. Do not add a
  legacy fallback without changing the product contract explicitly.

## Tests

- Test behavior that could break, not implementation details or trivial syntax.
- Use focused unit tests for state, compilation, planning, and diagnostics.
- Give E2E tests priority for public CLI flows, clean URLs, browser APIs,
  presentation state, speaker synchronization, and production output.
- Keep browser contracts on private fixtures under `e2e/fixtures`. Public
  examples and showcases may change their story, layout, and motion without
  becoming permanent E2E APIs; validate those surfaces with source checks and
  production builds instead.
- Reproduce a bug before fixing it when a focused regression test is practical.

Run targeted checks while iterating. Before committing, run the complete gate:

```sh
vp run ready
```

## Dependencies and commits

Prefer the web platform and small local modules. Add a dependency only for
specialist infrastructure that would be less correct or maintainable in-house,
and keep it behind a narrow adapter or in the build graph.

An official plugin is complete only when its package contract and behavioral
tests pass, the Feature Gallery proves it with real rendered output, and the
website plugin catalog plus canonical official-plugin guide document its
activation, browser/export cost, and limitations. Keep generic agent prompts
catalog-agnostic; expose each capability through its plugin manifest and
authoring context.

Keep commits focused and self-contained. Update the relevant documentation when
a public contract changes. Record user-facing additions, changes, and fixes in
the `Unreleased` section of [`CHANGELOG.md`](./CHANGELOG.md), then commit only
after the complete gate passes.

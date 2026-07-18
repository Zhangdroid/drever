# Contributing to Drever

Drever favors a small, readable implementation over a broad compatibility
surface. Keep each change easy to inspect and tied to a concrete product
contract.

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
- Reproduce a bug before fixing it when a focused regression test is practical.

Run targeted checks while iterating. Before committing, run the complete gate:

```sh
vp run ready
```

## Dependencies and commits

Prefer the web platform and small local modules. Add a dependency only for
specialist infrastructure that would be less correct or maintainable in-house,
and keep it behind a narrow adapter or in the build graph.

Keep commits focused and self-contained. Update the relevant documentation when
a public contract changes, and commit only after the complete gate passes.

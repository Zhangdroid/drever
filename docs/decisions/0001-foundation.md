# 0001: Foundation and dependency policy

- Status: accepted
- Date: 2026-07-20

## Context

Drever wants current platform capabilities, a small production runtime, fast
authoring tools, and reproducible output. It also needs enough constraints that
AI-generated decks remain coherent instead of becoming arbitrary React pages.

"Use few dependencies" therefore cannot mean reimplementing compilers,
syntax highlighters, or browser automation. It means keeping dependencies away
from Drever's differentiating domain logic and preventing tools from leaking
through public APIs.

## Decision

The repository uses this foundation:

| Concern       | Choice                         | Policy                                                                    |
| ------------- | ------------------------------ | ------------------------------------------------------------------------- |
| Runtime       | React Canary                   | Exact version, curated and tested by Drever                               |
| Language      | TypeScript 7                   | Strict, erasable syntax; no programmatic compiler dependency              |
| Toolchain     | Vite+                          | Internal formatting, linting, type checking, testing, packing, and tasks  |
| App build     | Vite                           | Available to adapters and plugin authors, not ordinary deck configuration |
| Content       | MDX 3, unified, remark, rehype | Build-time compiler infrastructure                                        |
| Navigation    | Navigation API                 | Required capability; no legacy router dependency                          |
| Motion        | View Transitions, WAAPI, CSS   | Wrapped by a small Drever motion adapter                                  |
| Unit tests    | Vite+ Test                     | Tests colocated with pure domain modules                                  |
| Browser tests | Playwright                     | Added when the first viewer and export path exist                         |

React Canary is pinned to a complete build identifier. Updates are deliberate
framework releases, not floating installs. Experimental React and platform APIs
stay behind internal adapters so a version change cannot spread through author
components or plugin contracts.

Vite+ is a repository implementation detail. Public configuration exposes
Drever concepts and a curated subset of common settings. A separate adapter API
may expose Vite types to plugin developers.

The workspace override exercises the Vite-compatible runtime bundled with
Vite+, while the published CLI declares upstream Vite 8. Plugin peer ranges
accept both tested implementations because plugin authors may develop inside a
Vite+ workspace. The release gate installs the packed packages in a clean
consumer so workspace resolution cannot hide the public dependency graph.

## Dependency admission rule

A dependency is admitted only when:

1. it solves infrastructure or a specialist problem;
2. an in-house implementation would be materially less correct or maintainable;
3. it can live behind a narrow boundary or only in the build graph;
4. its version, purpose, runtime cost, and exit path are understood.

This admits MDX, Shiki, Tailwind, KaTeX, Mermaid, and Playwright in their relevant
optional packages. It rejects generic routers, state containers, animation
frameworks, CLI frameworks, and utility libraries until a concrete requirement
shows that native APIs or small local modules are insufficient.

## Consequences

- Production decks do not ship MDX, remark, rehype, Tailwind, or Shiki compilers.
- The initial browser runtime should depend only on React and React DOM.
- Drever owns Deck IR, diagnostics, layouts, motion grammar, state, plugin
  planning, and design validation because those are product capabilities.
- Browser-only authoring may later use a separate, lazy browser compiler with a
  smaller registered plugin set. It is not the canonical production pipeline.
- Unsupported browsers receive one actionable startup diagnostic instead of a
  partially working compatibility mode.
- `prefers-reduced-motion` remains mandatory because it is an accessibility
  contract, not a legacy-browser fallback.

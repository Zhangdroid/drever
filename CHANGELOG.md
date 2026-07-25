# Changelog

Notable user-facing changes to Drever are recorded here. Named releases use their matching version
section, while commit snapshots use the current Unreleased section.

## [Unreleased]

### Fixed

- Made the public AI handoff explicitly continue after fetching `prompt.md` without naming a
  competing generic presentation workflow.
- Slowed the Motion showcase cover's opening change and kept the Architecture signal behind its
  labels instead of obscuring them.

## [0.2.1] - 2026-07-24

### Fixed

- Made project-name normalization linear for separator-heavy directory names, preventing crafted
  create-command input from causing excessive regular-expression backtracking.
- Reduced the public AI handoff to a neutral prompt fetch and made adaptive interviews ask a real
  question before offering the optional surprise escape.
- Kept audience toolbar navigation immediately clickable by avoiding a document snapshot that
  temporarily removes its controls from browser hit testing.
- Kept documentation route changes pinned to the correct top or restored history position instead
  of letting the navigation sidebar move the page.
- Made the homepage light field composite consistently in Safari without its translucent canvas
  becoming a bright white circle.

## [0.2.0] - 2026-07-24

### Added

- Added an accessible first-load presentation shell and narrow Vite entry warmup so a cold
  development session communicates progress while its MDX graph compiles.
- Added a deterministic keynote-style motion card wall with reduced-motion and export-safe states.

### Changed

- Renamed the neutral `Default` design study and public package subpaths to `Basic`, matching its
  existing minimal showcase route without changing Drever's automatic fallback behavior.
- Made the public AI handoff a short fetch instruction, added an adaptive briefing flow with an
  always-available surprise escape, and raised the generated-deck quality bar for subject-led visuals,
  highlighted code, and rendered review.
- Gave Editorial, Studio, and Fieldnote distinct theme-led whole-slide transition voices while
  keeping Basic's existing transition unchanged.

### Fixed

- Kept the Motion showcase's revealed decision and closing quote on one stable line.

## [0.1.1] - 2026-07-24

### Added

- Rebuilt the Architecture showcase as a visual tour of compilation, routing, extensions, runtime
  surfaces, and delivery.
- Expanded the lightweight Charts plugin with area, dot, and donut stories plus an active-slide
  animated number that remains stable for accessibility, reduced motion, and delivery surfaces.
- Added one canonical changelog for the repository, public website, and audited GitHub Release
  notes.
- Added a private vulnerability reporting policy for the public repository.
- Added crawlable site icons, social sharing metadata, a launch card, and `WebSite` structured data
  to the public website.
- Added concise Cloudflare Pages, Vercel, and GitHub Pages recipes to the delivery guide.

### Changed

- Moved slide navigation to document View Transitions with explicitly named deck and overlay groups,
  removing the client requirement for element-scoped transitions while keeping Stage backgrounds
  live.
- Simplified the website hero and setup path while making showcase entry points easier to discover.
- Aligned canonical, sitemap, and first-party website URLs with their final trailing-slash routes.
- Refined Product Tour and Architecture motion so repeated elements remain stable and ambient
  animation does not compete with the story.
- Made the public website informative rather than blocking when newer presentation APIs are
  unavailable; the Drever client continues to enforce its browser contract.
- Marked Room Scenes as an incubating source study until its components have a supported public
  package contract.
- Reframed Room Sense as a full-canvas microphone-reactive scene: its active opening requests
  access directly, removes the control card, and gives the lime, violet, and ring field a stronger
  response to nearby sound.
- Reworked the Feature Gallery chart chapter around one decision story so each chart form answers a
  distinct comparison, trend, ranking, or part-to-whole question.
- Made website presentation briefs start empty, with broad examples shown only as placeholders.
- Reframed external motion and spatial tools as a neutral, non-exhaustive capability reference.
- Made post-publish verification exercise the public `npm create drever` command, dependency
  installation, validation, and build exactly as a new user would.

### Fixed

- Made generated AI guidance invoke the project-local CLI through the detected package manager,
  state the exact creation skill, and keep accessible descriptions aligned with the current Step.
- Kept authoring imports such as `Step` and `Note` from `drever` on a browser-safe runtime entry
  instead of pulling CLI and build tooling into the presentation bundle.
- Kept audience controls usable on narrow screens, added a portrait reading choice, and made the
  phone-sized speaker surface prioritize the current slide, notes, and primary controls.
- Restored the intended glass surface behind the client slide navigator.
- Kept loud microphone input from pinning Room Sense at its visual ceiling by adapting its listening
  range to the room.
- Restored MDX and JSX token highlighting in the public documentation.
- Kept the reveal Footer out of route transitions and removed its stray shadow below final-page
  calls to action.
- Stabilized the website build and deployment contracts used by CI.
- Prevented initial hydration from stealing focus and improved the announcement and contrast of
  essential website guidance.

## [0.1.0] - 2026-07-24

### Highlights

- Introduced an AI-first project flow with one-command creation, project-local Codex and Claude
  skills, readable briefs, and deterministic authoring context.
- Shipped readable MDX slides with protected `---` boundaries, exact sparse Step URLs, speaker
  notes, semantic MotionGroup intents, and persistent Stage layers.
- Delivered Audience, Speaker, and Document views together with rehearsal timing, Laser, Pen,
  Highlighter, static website output, and deterministic PDF export.

### Extensions and design

- Added official GFM, Shiki, Tailwind CSS, math, charts, and media plugins with build/runtime costs
  kept behind the plugin contract.
- Added eight reproducible design studies: Default, Editorial, Studio, Fieldnote, Atlas, Ledger,
  Cinema, and Construct.
- Published complete Product, Feature, Motion, Room Scene, Architecture, and minimal-reference
  showcases as real Drever builds.

### Delivery

- Established lockstep npm releases with Trusted Publishing, audited tarballs, clean-consumer
  verification, provenance-ready package metadata, and GitHub Releases.
- Added parallel source, unit, package, browser, export, and website checks in CI.
- Deployed the prerendered public website and per-branch previews through Cloudflare Pages.

[Unreleased]: https://github.com/Zhangdroid/drever/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/Zhangdroid/drever/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Zhangdroid/drever/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/Zhangdroid/drever/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Zhangdroid/drever/releases/tag/v0.1.0

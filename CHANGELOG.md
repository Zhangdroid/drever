# Changelog

Notable user-facing changes to Drever are recorded here. Named releases use their matching version
section, while commit snapshots use the current Unreleased section.

## [Unreleased]

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

[Unreleased]: https://github.com/Zhangdroid/drever/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/Zhangdroid/drever/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Zhangdroid/drever/releases/tag/v0.1.0

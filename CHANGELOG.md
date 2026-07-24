# Changelog

Notable user-facing changes to Drever are recorded here. Named releases use their matching version
section, while commit snapshots use the current Unreleased section.

## [Unreleased]

### Added

- Rebuilt the Architecture showcase as a visual tour of compilation, routing, extensions, runtime
  surfaces, and delivery.
- Added one canonical changelog for the repository, public website, and audited GitHub Release
  notes.

### Changed

- Simplified the website hero and setup path while making showcase entry points easier to discover.
- Refined Product Tour and Architecture motion so repeated elements remain stable and ambient
  animation does not compete with the story.
- Made the public website informative rather than blocking when newer presentation APIs are
  unavailable; the Drever client continues to enforce its browser contract.

### Fixed

- Restored the intended glass surface behind the client slide navigator.
- Kept the reveal Footer out of route transitions and removed its stray shadow below final-page
  calls to action.
- Stabilized the website build and deployment contracts used by CI.

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

[Unreleased]: https://github.com/Zhangdroid/drever/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Zhangdroid/drever/releases/tag/v0.1.0

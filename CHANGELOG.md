# Changelog

Notable user-facing changes to Drever are recorded here. Named releases use their matching version
section, while commit snapshots use the current Unreleased section.

## [Unreleased]

### Added

- Added an independent Claude Opus 5 path to the post-release AI smoke, with
  the same guided and surprise-me briefs shown beside Codex as live decks,
  source, conversations, timing, and verified build receipts. Both providers
  use medium reasoning effort for a balanced, bounded comparison, followed by
  an explicit literal-source review before isolated validation. Claude runs
  serialize against the shared credential and use a bounded 35-minute
  scenario, 20-minute turn, $6 cumulative budget, and finite agent and proxy
  request counts.

## [0.7.0] - 2026-07-26

### Added

- Added a focused Spatial Stories showcase that carries one official Spline
  cloner scene through authored 3D rotations, then contrasts it with a focused
  moving object and a CC0 ambient community scene, while keeping one remote 3D
  renderer at a time and deterministic original posters for non-audience
  surfaces.
- Exposed `useDreverRenderMode` from the root `drever` authoring surface so
  project-local components can distinguish audience, document, speaker, and
  export rendering without importing an internal package.

### Changed

- Made AI creation author directly from the version-matched public contract
  instead of scanning `node_modules`, declarations, Drever source, official
  design implementations, and example decks. Draft 1 now exposes the complete
  readable content structure before a full custom Theme, while the design
  workflow can continue on the same preview or derive a disjoint art-direction
  plan in parallel.

## [0.6.0] - 2026-07-26

### Changed

- Made AI deck creation preview-first: agents now expose one stable, coherent
  Draft 1 URL before exhaustive validation, keep refining through HMR without
  waiting, and defer production builds and requested PDFs until the live draft
  is stable.

## [0.5.0] - 2026-07-26

### Changed

- Expanded the AI-first briefing into a short, adaptive multi-round interview
  with topic-specific choices, visible trade-offs, contextual recommendations,
  compact answers, and a skip-remaining escape in every round.

## [0.4.0] - 2026-07-26

### Added

- Added typed deck document metadata for canonical URL, language, direction,
  title, description, icon, and social previews; production builds now derive
  an omitted title from the first slide, preserve that language in tagged PDF
  export, require an explicit authored language for web/PDF delivery, validate
  local public metadata assets, and emit absolute link-preview image URLs at
  every static route.
- Added public audience, document, and speaker client entrypoints so generated
  applications can load only the selected presentation JavaScript runtime.
- Added a scheduled full browser suite alongside focused pull-request coverage,
  plus concise project setup, contribution templates, ownership, and community
  guidance for the public repository.

### Changed

- Added explicit CJK font stacks and language-aware tracking, casing, and
  leading to every official design study, including locale-correct Simplified
  Chinese, Traditional Chinese, Japanese, and Korean glyph selection for both
  whole decks and mixed-language content.
- Split generated JavaScript by presentation surface; the speaker chunk also
  avoids audience-only controls while all surfaces retain the shared client
  stylesheet.
- Kept Vite+ inside the repository toolchain while publishing the CLI against
  upstream Vite 8, and reduced the PDF automation dependency to Playwright Core
  with a Drever-owned command that installs its exact matching Chromium
  revision without the unused headless-shell payload.

### Fixed

- Preserved Chinese, Japanese, and Korean glyphs in PDF exports with
  export-safe locale-specific sans, serif, and handwritten fallback stacks.
- Kept fixed English presentation controls, loading states, and browser notices
  isolated from authored language and writing direction, derived RTL document
  direction when omitted, and prevented unsupported document-only language
  tags from breaking PDF browser startup.
- Kept export-page labels explicitly English without retagging authored slide
  content, and refreshed manifest titles after development edits instead of
  leaving browser and navigation labels stale.
- Replaced generated showcase metadata as one canonical set during website
  assembly, avoiding stale titles and duplicate social tags.
- Kept the adaptive website header in sync with structural dark surfaces across
  documentation, showcase, and release-smoke pages.
- Gave the Docs handoff card enough reading width and simplified its supporting
  copy, while returning the homepage hero artwork to a text-free composition.

## [0.3.0] - 2026-07-26

### Added

- Added a dev-only experimental Pretext typography probe for supported visible
  plain-text blocks, with advisory predicted-versus-rendered layout evidence
  that stays out of production and export bundles.
- Made the installed deck-review workflow prefer Chrome DevTools MCP for its
  final rendered gate, including exact-route screenshots, computed geometry,
  real interaction, and console and network evidence.

## [0.2.6] - 2026-07-26

### Fixed

- Retried bounded transient TLS, 404, rate-limit, and server failures while
  verifying newly uploaded Cloudflare Pages release-smoke previews.
- Restored the browsable release-smoke history and preserved its run metadata
  across later Cloudflare Pages Direct Upload deployments.
- Kept long Slide Navigator titles inside their cards with stable two-line
  captions, separate current-state labels, and authored title spacing.

## [0.2.5] - 2026-07-26

### Changed

- Moved generated AI release-smoke decks, source, transcripts, and receipts out
  of Git and into a dedicated Cloudflare Pages Direct Upload deployment, with a
  short-lived GitHub Actions bundle retained only for diagnostics.
- Strengthened the installed creation, design, authoring, and review workflows
  with stable Step coordinate systems, active-state keyframes, one motion owner,
  scoped Theme normalization, full-canvas paint containment, computed
  readability and spacing evidence, and a mandatory rendered Draft 1
  refinement.
- Expanded AI release smoke from a single audience advance to every exact slide
  and Step route, with transition and settled-frame geometry checks for
  material clipping and large layout rebases.

### Fixed

- Restored the public release-smoke decks from their immutable Pages deployment
  and hid bootstrap previews once the same package commit has a formal release
  run.
- Made ordinary Step reveals opacity-only so an implicit transition cannot
  become a temporary containing block and make absolutely positioned content
  jump between coordinate systems.

## [0.2.4] - 2026-07-25

### Changed

- Gave all eight official design studies distinct motion vocabularies and cadences, then expanded
  their reference decks beyond one repeated three-page, left-copy/right-artifact continuity formula.
- Reframed the homepage as one continuous creation story that carries the same brief, visual
  direction, room signal, evidence, and exact route through every useful presentation surface.
- Taught generated creation, design, authoring, and review workflows to treat motion consistency as
  a shared vocabulary of cuts, fades, local handoffs, Steps, and selective continuity—not a View
  Transition on every page.
- Taught generated creation, design, authoring, and review workflows to keep shared View Transition
  shells identical in width, height, aspect ratio, and box sizing, and to diagnose a
  grow-then-shrink handoff as endpoint geometry rather than easing.
- Made every visible authored string a presentation-distance reading promise, required labels to
  fit the usable inner silhouette of their visual owner, and replaced representative visual
  sampling with exact slide and Step inspection after initial generation.
- Unified the AI briefing around one adaptive interview flow and one skip-remaining escape per
  question round instead of advertising a second topic-level surprise mode.
- Defined showcase-quality signature moments through a topic-fingerprint test, an explicit
  claim-to-static-endpoint beat sheet, and a final memorable-scene refinement ceiling.
- Changed release automation to accumulate small fixes into intentional batches, run AI smoke by
  default only for stable releases, and let maintainers explicitly opt prereleases or commit
  snapshots in or out.
- Pinned AI release smoke to quality-first `gpt-5.6-sol` with medium reasoning, controlling cost
  through release-level batching rather than a lower-capability generation model.

### Fixed

- Materialized finite CSS and Web Animations at their final export state and froze infinite
  decoration at a deterministic frame so animated text remains visible in generated PDFs.
- Preloaded the homepage display font and gave its hero an explicit responsive line structure so
  slow first visits no longer reflow the headline after the font arrives.
- Stabilized Cinema's changing media frame so its border, crop, and supporting composition no
  longer pop into place after the second-to-third-slide handoff.
- Stabilized Atlas's shared river artifact in one fixed frame so it moves between compositions
  without stretching or settling after the transition.

## [0.2.3] - 2026-07-25

### Added

- Added a post-release Codex smoke workflow that exercises the public AI handoff through surprise
  and guided interviews, builds the generated decks without the API secret, and publishes
  interactive review evidence through an immutable Cloudflare Pages deployment.

### Changed

- Re-composed prominent website and showcase headings around complete semantic phrases, and taught
  generated design, authoring, and review skills to treat line breaks as editorial structure.
- Varied the eight design studies with content-led full-canvas, stacked, reversed, and asymmetric
  compositions, restored their website catalog to a four-by-two grid, and taught generated
  authoring guidance to connect clearly corresponding objects without treating resemblance alone
  as continuity.
- Made generated creation, design, authoring, and review workflows require a separate rendered
  refinement pass after the complete first draft, preserving successful choices while fixing
  evidence-backed narrative, visual, motion, and interaction issues.
- Made release verification explicitly preserve the complete MIT license in every publishable
  package archive and documented the provenance of the Cinema study's original generated artwork.
- Made the public showcase build reject authoring diagnostics before publishing, aligned the Motion
  and Art Direction guides with current continuity and layout-diversity principles, and refreshed
  the Delivery guide's GitHub Actions examples.
- Replaced developer-specific and personal Basic and Editorial examples with audience-neutral
  presentation briefs in both the public studies and machine-readable design manifests.

### Fixed

- Made generated creation, design, authoring, and review workflows treat unreadable rendered text
  as a blocking defect, including descendant colors that override an inherited custom-surface
  foreground.
- Gave the Feature Gallery opening a static accessible title and preserved semantic spacing in the
  Product Tour cover title used by navigation and search.
- Used endpoint-appropriate media types when release-smoke provenance checks query npm and GitHub.
- Kept the guided release-smoke transcript coherent by completing its optional interview before
  requesting a separate refinement pass.

## [0.2.2] - 2026-07-24

### Changed

- Reduced the Architecture showcase's persistent topology contrast and strengthened its content
  surfaces so the background supports rather than competes with the explanation.
- Taught generated design and review skills to apply a first-glance hierarchy test to decorative
  backgrounds and foreground surfaces.

### Fixed

- Made the public AI handoff explicitly continue after fetching `prompt.md` without naming a
  competing generic presentation workflow.
- Let the homepage Motion showcase finish its active lifecycle after pointer exit, removed its
  unnecessary vertical detour, and moved its route marker off the labels.
- Slowed the Motion showcase cover's opening change and kept the Architecture signal behind its
  labels instead of obscuring them.
- Kept the Product Tour cover color in its persistent Stage so foreground fades no longer fade the
  full-canvas background between the opening and the first content slide.

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

[Unreleased]: https://github.com/Zhangdroid/drever/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/Zhangdroid/drever/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/Zhangdroid/drever/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/Zhangdroid/drever/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Zhangdroid/drever/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Zhangdroid/drever/compare/v0.2.6...v0.3.0
[0.2.6]: https://github.com/Zhangdroid/drever/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/Zhangdroid/drever/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/Zhangdroid/drever/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/Zhangdroid/drever/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/Zhangdroid/drever/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/Zhangdroid/drever/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Zhangdroid/drever/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/Zhangdroid/drever/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Zhangdroid/drever/releases/tag/v0.1.0

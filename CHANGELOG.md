# Changelog

Notable user-facing changes to Drever are recorded here. Named releases use their matching version
section, while commit snapshots use the current Unreleased section.

## [Unreleased]

## [0.16.0] - 2026-08-06

Release impact: **minor** — this batch makes Studio's completed creation stages safely revisitable
and adds explicit public state for superseded Storyboards and live drafts.

### Added

- Added a dedicated `@drever/client/studio-thumbnail` entry point for isolated visual slide
  thumbnails without loading the complete Studio surface.

### Changed

- Made completed Brief, Direction, Storyboard, and Draft stages navigable from Studio's progress
  header. Revising an earlier stage now asks for confirmation, rebuilds dependent work, and keeps
  the previous Storyboard and live Draft available as clearly marked read-only references.
- Persisted validated adaptive-question context with Studio actions so Direction remains reviewable
  after plan publication, agent reconnection, and local server reloads.
- Rebalanced Studio's creation progress, Storyboard rail, plan cards, and supporting controls around
  a compact semantic type scale, equally spaced stages, and content-first slide labels.
- Replaced Live Draft's text-only rail with lazy, isolated visual slide thumbnails while keeping
  Storyboard navigation focused on story structure and feedback scope in the Direction panel.

### Fixed

- Kept Studio's packaged brand fonts available to generated development apps, avoiding a system-font
  fallback when the authored deck lives outside Drever's workspace.
- Kept Live Draft canvas geometry stable as speaker-note length changes, removed a discrete hover
  repaint from Brief actions, and moved the disconnected-agent notice into a dismissible floating
  glass panel that no longer reduces the workspace height.
- Kept production output outside the development watch graph so existing build files cannot reload
  Studio while visual Draft thumbnails initialize.

## [0.15.0] - 2026-08-06

Release impact: **minor** — this batch makes Storyboard approval content-first, while preserving
legacy plan files and strengthening the live Draft 1 handoff.

### Changed

- Added a strict version-2 `drever.plan.json` story contract that keeps each slide's job, purpose,
  evidence, and anchor artifact in review while deferring per-slide density, layout, and motion
  until the approved design pass. Existing version-1 plans remain readable.
- Simplified Studio and standalone Storyboard cards around content and sequence, with roomier
  evidence surfaces and no premature layout or motion labels.
- Kept the parent creation task observing a managed Studio session across the human approval gate,
  so a browser approval can start the next managed turn without a separate chat message.
- Added explicit whole-deck and current-slide feedback targets to Live Draft without coupling the
  chosen feedback scope to preview navigation.

### Fixed

- Opened Draft View History as a compact anchored popover instead of expanding the work-in-progress
  banner, preventing the canvas and neighboring Studio rails from shifting.
- Made `drever check` reject `data:`, `blob:`, and `javascript:` CSS imports with a precise source
  diagnostic before Vite or PostCSS can strand the live preview on an error overlay.
- Replaced Studio's backtracking Markdown link cleanup with a linear forward scan so malformed or
  adversarial agent narration cannot monopolize the browser main thread.
- Attached audience shortcuts before the viewer reports itself ready so an immediate keypress after
  a cold load is no longer dropped.

## [0.14.0] - 2026-08-05

Release impact: **minor** — this batch makes Studio creation more resilient and deliberate, adds
recoverable audience rendering, and deliberately stops treating the Basic design study as an
implicit default. Existing decks that rely on Basic layouts must select Basic explicitly.

### Changed

- Made Direction publish a first reviewable Storyboard from the submitted brief before browsing or
  open-ended research, with uncertain facts carried forward as evidence requirements and deeper
  research deferred until the approved live draft.
- Added restrained transitions for Studio screens, semantic status copy, disclosures, plan-card
  metadata, controls, notices, dialogs, and feedback so state changes remain legible without
  animating streaming text or the live presentation canvas.
- Reframed Storyboard card metadata as explicit Layout and Motion information with an accessible
  motion purpose, and aligned Studio controls with Drever's shared design tokens.
- Locked the approved canvas, safe area, surface ownership, and last-known-good layout across the
  generated authoring skills; official designs now remain reference studies unless explicitly
  selected, and custom art direction replaces conflicting starter paint instead of layering over it.
- Stopped applying the official Basic study when `theme` is omitted. Theme-less projects now use an
  undecorated internal baseline with safe insets and readable semantic Markdown, while Basic and its
  named layouts remain available through an explicit project choice.

### Fixed

- Gave newly created projects an explicit 1600 × 900 canvas contract so an agent cannot silently
  switch resolutions while replacing the starter design or refining motion.
- Kept authored render failures inside their owning slide or deck surface so one broken Draft 1
  route no longer turns the audience view or Studio preview into a blank page; development previews
  retain actionable error detail while production fallbacks avoid exposing source exceptions.
- Kept custom art directions from exposing a half-migrated starter frame by making official designs
  reference-only for agents, assigning one owner to the complete Theme and Stage surface, and
  preparing replacement modules before switching the live configuration.
- Removed synthetic `0 of 5` progress from provider-internal planning steps while retaining truly
  measurable progress when a reliable completed and total count exists.
- Kept a managed agent's idle review checkpoint resumable instead of reporting a normal app-server
  exit as a disconnect failure, and let the durable awaiting-approval Storyboard outrank late
  transport errors.
- Kept Live Draft feedback scoped to the corresponding semantic Storyboard slide while bridging the
  audience runtime's positional slide identity by ordered index.
- Prewarmed the authored presentation graph and recovered one transient cold-module fetch with a
  guarded reload, so Studio previews no longer remain stranded on the loading shell after Vite
  refreshes its dependency graph.
- Suppressed the config watcher's initial file-discovery events so cold startup does not reset a
  Live Draft after the user has already begun navigating it.
- Kept the user-owned Studio development server isolated from agent review infrastructure by
  putting managed agents in their own process group, rejecting nested managed `drever dev`
  launches, and reserving temporary rendered-check cleanup for its own ephemeral loopback preview
  and browser.

## [0.13.1] - 2026-08-05

Release impact: **patch** — this batch fixes compatible Studio preview and lifecycle regressions in
the new local authoring workflow.

### Fixed

- Kept the embedded Live Draft in its preview row when the lifecycle banner is absent, so speaker
  notes can no longer collapse the rendered deck to zero height.
- Treated an approved Storyboard that is waiting for Draft 1 as active work, preserving truthful
  progress and toolbar copy while keeping the not-yet-available preview disabled.
- Rendered bounded agent summaries as clean plain text instead of exposing Markdown formatting
  markers in Studio activity.
- Gave atomic agent publications a bounded verification grace window and kept a current durable
  ready state above a late transport error, preventing completed Studio passes from being reported
  as paused.

## [0.13.0] - 2026-08-05

Release impact: **minor** — this batch adds a more legible and inspectable local Studio workflow
without changing authored presentation APIs.

### Added

- Added an authenticated, HMR-stable Live Draft bridge for manifest-backed slide navigation and real
  speaker notes inside Studio, with a dedicated low-privilege preview capability isolated from both
  arbitrary parent messages and Studio's action token.

### Changed

- Derived Studio progress from durable brief, question, plan, and draft artifacts so transient agent
  telemetry cannot mark Storyboard complete before it exists.
- Reduced agent activity to the current specific public summary by default, with completed history
  available on demand, and made active refinement, review readiness, recoverable errors, and required
  approvals visually explicit.
- Kept stale approved storyboards out of a new Direction pass, switched the Live Draft rail to the
  currently rendered manifest, mapped its positions back to storyboard feedback, and added truthful
  retry or resume actions when agent work pauses.
- Kept the latest bounded tail of managed-agent public summaries visible during long operations
  without exposing private reasoning or raw provider output.
- Accepted one reviewable storyboard publication for the common “submit brief, then skip the
  remaining questions” path while retaining strict action-order and artifact postconditions.

### Fixed

- Allowed the embedded Live Draft to enter fullscreen, retained its authenticated connection across
  child HMR, added a child-ready handshake for slow cold starts, and kept slide-rail navigation in
  Live Draft instead of unexpectedly returning to Storyboard.
- Preserved the last available draft when refinement pauses and clarified that intermediate HMR
  layouts may still change while the agent is working.
- Coalesced duplicate configuration file events into one development-server restart, avoiding
  transient outdated dependency requests during local theme and Stage reloads.

## [0.12.1] - 2026-08-05

Release impact: **patch** — this batch keeps the compatible local Studio workflow responsive and
coherent across progressive authoring and development-time configuration changes.

### Changed

- Made the approved-plan handoff publish a bounded, content-complete Draft 1 through the existing
  Studio server before design research, rendered review, production builds, or browser automation,
  so users can review real content sooner while the agent continues visual refinement.
- Kept managed agent sessions and their development command alive for the full Studio workflow,
  while one-shot and non-interactive hosts now use the chat-based Storyboard workflow instead of
  handing users a Creation room whose local agent process has already exited.

### Fixed

- Kept an already published Studio live draft available while the agent starts later drafting or
  refinement passes, without forcing the user back to the Storyboard view.
- Reloaded imported `drever.config.ts` dependencies, local theme modules, and Stage components in
  the same development listener, preserving the Studio URL and session; an invalid configuration
  now leaves the last valid preview running and recovers when its missing dependency is created.
- Kept the public development listener stable and held requests during Vite configuration-graph
  swaps, so browsers no longer hit transient resets or stale-graph responses while reloading
  virtual styles or Studio.

## [0.12.0] - 2026-08-05

Release impact: **minor** — this batch adds compatible managed-agent sessions, durable visual
evidence, and stronger rendered-quality checks without changing existing deck workflows.

### Added

- Added `drever dev --open studio` so local agent-led creation can open the exact loopback Creation
  room automatically, while CI and headless environments retain a printed URL fallback.
- Added a bounded Studio activity timeline so planning, research, drafting, and review can report
  truthful user-facing milestones without exposing private model reasoning.
- Added managed Studio adapters for Codex and Claude Code, plus one standards-based ACP adapter for
  Gemini CLI, GitHub Copilot CLI, Goose, Cursor CLI, OpenCode, OpenHands, and Cline. Existing and
  unsupported agents can continue to use the provider-neutral action journal.
- Added a blocking rendered diagnostic for recurring full-canvas slide paint that would move under
  the default document View Transition instead of remaining on the stationary Stage.
- Added opt-in Playwright visual evidence to `drever check --rendered`, with every exact settled
  state, forward and reverse transition samples, contact sheets, integrity hashes, and a versioned
  manifest. The manifest is published atomically and shares an inspection-build fingerprint with
  the JSON receipt, so a failed or stale refresh cannot be mistaken for current evidence.

### Changed

- Clarified that the public bootstrap is a Drever MDX/React project workflow and directs an agent
  away from unrelated artifact skills before delegating to Drever's version-matched local skill.
- Made open Studio sessions detect agent-state and plan publications even when the operating-system
  file watcher misses an atomic replacement, removing the need to refresh the page manually.
- Derived audience, speaker, document, and export canvas fallbacks from semantic Theme canvas and
  ink tokens, and made AI design and review require a sequence-level visual story plus source-backed
  implementation receipts for signature moments.
- Distinguished content-complete Draft 1, active visual refinement, and a reviewed ready state in
  the local creation room instead of presenting the first tidy preview as finished work.
- Consolidated required deck review on Drever's isolated Playwright Chromium instead of requiring
  Chrome DevTools MCP or a second agent browser.

### Fixed

- Evaluated full-canvas background ownership independently in both transition directions and made
  rendered review reject console errors and failed subresources instead of trusting incomplete
  pixels.
- Kept the audience toolbar visible across slide navigation initiated by its previous and next
  buttons, while keyboard and canvas navigation continue to hide it before transition capture.

## [0.11.0] - 2026-08-04

Release impact: **minor** — this batch adds a compatible local creation room, rendered-quality
diagnostics, and a visual-refinement gate for AI-authored presentations.

### Added

- Added an experimental, development-only local creation room for the common brief, adaptive
  topic-specific questions, visual Storyboard approval, a real Audience View preview, and deck- or
  slide-scoped feedback. A provider-neutral local action journal and `drever studio` agent commands
  coordinate the existing coding agent without placing model credentials or editor code in the
  production presentation.
- Added rendered text safe-area diagnostics for required copy that hugs the
  canvas edge, including source evidence and a matching hard release-smoke
  browser gate.
- Added content-led scene recipes and practical typography, spacing, contrast,
  and CJK-aware review baselines to the installed design, authoring, and review
  skills.

### Changed

- Made the experimental creation room's first brief clearer and more flexible with arbitrary
  minute durations, plain-language audience-goal copy, readable option descriptions, and compact
  recommendation badges. It now also distinguishes an active local coding-agent lease from an
  unconnected room instead of presenting the transport itself as a live agent.
- Refined the creation room with a smaller navigation surface, calmer form typography, and a
  truthful animated activity timeline driven by the local agent's published milestones. The
  bundled creation skill now treats topic-specific questions as a latency-sensitive one-pass task,
  uses an exact decoder-verified publication template, and bounds schema recovery instead of
  inspecting project internals or entering open-ended debugging.
- Taught the bundled design and review skills to reject detached annotations, connector overshoot,
  and implementation details that visually overpower the audience-facing claim.
- Made every AI release-smoke candidate capture settled slides and adjacent
  transition frames in a keyless browser job, return two bounded contact sheets
  to its provider for one visual-refinement turn, and pass a fresh keyless build
  before publication.
- Kept full-canvas Stage backgrounds stationary by default and directed agents
  to animate only meaningful inner paint, signals, or focal objects. Chapter
  and closing palette changes now have an explicit live-background recipe.
- Removed Real AI Runs from public website discovery while the automated visual
  benchmark is being refined; retained runs remain directly addressable for
  internal review.

### Fixed

- Published build-module cache entries atomically so concurrent presentation builds can safely
  reuse the same project cache without observing a partially written content-addressed proxy.
- Hid the audience toolbar before slide View Transition capture and kept it
  out of the presentation until fresh pointer intent, preventing its rounded
  glass surface from blurring content during navigation.
- Preserved the submitted creation-room brief across entry-module hot updates by invalidating the
  virtual startup state after every accepted action, and prevented an older agent publication from
  moving a durable session back to the first screen.

## [0.10.0] - 2026-08-03

Release impact: **minor** — this batch adds compatible public planning and rendered-preflight
capabilities.

### Added

- Added the versioned `drever.plan.json` story contract for AI-created decks.
  Source preflight now validates the interview state, brief, stable slide IDs,
  narrative jobs, evidence, focal artifacts, composition recipes, density, and
  explicit motion ownership before authoring begins.
- Expanded rendered preflight with line-fragment clipping, direct scroll
  overflow, high-confidence sibling overlap, and resolved solid-color WCAG
  contrast diagnostics. Complex image, gradient, blend, and translucent paint
  remains an explicit review warning instead of receiving a false pass.
- Added a development-only `/storyboard` surface that renders the versioned
  plan before deck authoring, updates through HMR, preserves the last valid
  structure during partial writes, and never enters production deck builds.

### Changed

- Resolved the current Codex `latest` and Claude Code `stable` CLI versions once at the start of
  each comparative AI release-smoke run, then reused those exact versions across generation and
  repair so a single run remains internally reproducible while tracking current stable agents.
- Routed new, replacement, and existing-deck AI requests through explicit workflows, exposed the
  coherent Draft 1 before design refinement, and assigned exhaustive rendered review plus final
  artifact builds to single owners so feedback invalidates stale evidence without repeating every
  expensive gate.
- Reduced the public AI bootstrap to a small handoff and made the installed,
  version-matched creation skill the single workflow authority. Design,
  authoring, review, and comparative AI release smoke now preserve and verify
  the same approved story contract end to end.

- Put the full AI release smoke behind one protected approval, then ran all four
  provider-and-briefing journeys independently in parallel. Failed cases now
  receive bounded validation diagnostics and at most one provider repair turn
  before a final keyless build; passing cases make no extra model call.
- Reframed the comparative AI release smoke around a globally readable
  12-slide black-hole science story, with a 10-to-14-slide contract for longer
  narrative, diagram, motion, and speaker-note review, plus a bounded Claude
  budget sized to finish that larger artifact.
- Presented the public AI generation evidence consistently as **Real AI runs**
  in page metadata, the footer, and the agent index.

### Fixed

- Raised the Basic accent-cover eyebrow and footer contrast above the rendered
  large-room readability threshold.
- Made the documentation navigation roomier on common laptop screens while
  keeping long sidebars smoothly scrollable and external destinations clear.
- Made the final AI release-smoke source review explicitly inventory normalized
  slide headings and keep a repeated closing refrain beneath a distinct title.
- Kept the Motion showcase's anticipated browser bitmap out of viewport
  letterboxing before its authored entrance.
- Returned pointer-activated audience toolbar actions to the presentation
  surface so navigation shortcuts remain immediate and the controls hide after
  a shorter idle interval.

## [0.9.0] - 2026-07-27

### Changed

- Made AI deck creation resolve visible slide density as an essential briefing
  decision, persist a complete `brief.md` with slide count, direction, and a
  numbered outline, and stop for explicit plan approval before authoring or
  opening Draft 1.
- Made the guided and surprise-me release-smoke journeys share one stable,
  presentation-worthy neighborhood-park proposal and factual fixture so their
  briefing modes can be compared without subject drift.
- Reorganized the public documentation around the path from AI-assisted creation
  through authoring, presenting, and delivery; added one complete command
  reference with exact options, defaults, workflow links, and drift protection
  against future CLI additions.

### Fixed

- Kept audience keyboard navigation active after using the previous and next
  toolbar controls with a pointer.
- Kept the static sitemap synchronized with new public documentation routes and
  added a fast regression check before deployment.

## [0.8.0] - 2026-07-27

### Added

- Added `drever check --rendered`, which builds an isolated production
  inspection app, visits Step 0 and every exact authored Step at the configured
  canvas, and emits stable diagnostics for clipping, canvas overflow,
  persistent-geometry instability, suspicious density, and runtime readiness.
  The current typed V2 JSON report includes a rendered receipt with receipt and
  ruleset versions, canvas, Chromium engine, optional browser version, captured
  state count, status, and explicit skip or failure reason.
- Added `drever design import <url>` to derive a project-owned Pass-0 Theme,
  stylesheet, evidence record, and art-direction brief from deterministic
  rendered website evidence. The importer writes only to a new or empty local
  directory and copies or hotlinks no source HTML, CSS, JavaScript, font, image,
  or script asset. Public HTTP and HTTPS references are allowed by default;
  credential-bearing URLs are rejected, localhost and private-network targets
  require `--allow-private`, persisted references redact query strings and
  fragments, and captured metadata remains untrusted evidence.

### Changed

- Advanced the emitted deck preflight report to typed V2 so source and optional
  rendered diagnostics share one stable summary and diagnostic vocabulary,
  while retaining a typed source-only V1 shape and report union for stored
  consumers. Advanced the authoring context to typed V2 with a corresponding
  V1-or-V2 union. Rendered preflight complements rather than replaces visual
  review.

## [0.7.1] - 2026-07-27

### Added

- Added an independent Claude Opus 5 path to the post-release AI smoke, with
  the same guided and surprise-me briefs shown beside Codex as live decks,
  source, conversations, timing, and verified build receipts. Both providers
  use medium reasoning effort for a balanced, bounded comparison, followed by
  an explicit literal-source review before isolated validation. Claude runs
  serialize against the shared credential and use a bounded 35-minute
  scenario, 20-minute turn, $6 cumulative budget, and finite agent and proxy
  request counts.

### Fixed

- Preserved slide View Transitions when the audience toolbar navigates while
  retaining immediate repeated clicks and stable button focus.

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

[Unreleased]: https://github.com/Zhangdroid/drever/compare/v0.16.0...HEAD
[0.16.0]: https://github.com/Zhangdroid/drever/compare/v0.15.0...v0.16.0
[0.15.0]: https://github.com/Zhangdroid/drever/compare/v0.14.0...v0.15.0
[0.14.0]: https://github.com/Zhangdroid/drever/compare/v0.13.1...v0.14.0
[0.13.1]: https://github.com/Zhangdroid/drever/compare/v0.13.0...v0.13.1
[0.13.0]: https://github.com/Zhangdroid/drever/compare/v0.12.1...v0.13.0
[0.12.1]: https://github.com/Zhangdroid/drever/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/Zhangdroid/drever/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/Zhangdroid/drever/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/Zhangdroid/drever/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/Zhangdroid/drever/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/Zhangdroid/drever/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/Zhangdroid/drever/compare/v0.7.0...v0.7.1
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

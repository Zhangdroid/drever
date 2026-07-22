# Product roadmap

Drever is an AI-first framework for interactive presentations, not a browser-based
slide editor. The roadmap prioritizes a machine-readable authoring contract,
design and motion quality, reliable delivery, portable output, and accessible
artifacts before networked collaboration features.

Priorities follow product necessity, not implementation novelty:

- **Necessary** capabilities make a deck authorable, presentable, testable,
  deployable, and accessible without assembling framework internals.
- **Common** capabilities improve recurring presentation workflows but should
  not increase every audience bundle when unused.
- **Enhancements** depend on specialized media, a network service, identity, or
  collaboration infrastructure and belong behind explicit activation.

## Current foundation

Drever already provides:

- path-addressable slide and Step state with keyboard navigation;
- a speaker view with current and next previews, notes, elapsed time, progress,
  and same-browser audience synchronization;
- deterministic static builds that preserve audience and speaker deep links;
- deterministic tagged PDF export for final or incremental presentation states;
- source-based accessibility preflight with stable human and JSON diagnostics;
- a searchable, fully revealed document view with one named landmark per slide;
- theme-owned design systems and build-time extension points;
- project-local agent skills and a versioned, plugin-aware authoring context.

These capabilities should be refined rather than replaced.

## P0 — necessary and delivered

### Overview and direct navigation

The audience surface now provides a searchable slide navigator, current-position
marker, compiled slide titles, direct numbered jumps, keyboard shortcuts, and a
visible speaker-view action. Exact jumps use the same browser-history contract as
linear navigation. A richer thumbnail/Step scrubber can build on this foundation
when Drever has a dedicated overview render mode.

Slide lists and thumbnail navigators are standard recovery tools during a live
presentation in [Google Slides][google-present], [PowerPoint Presenter View][powerpoint-presenter],
[Keynote][keynote-play], and [Slidev][slidev-ui].

### Presentation controls

The audience surface now includes native fullscreen, black and white pause
screens, numeric slide entry, Step-aware progress, keyboard help, and a compact
control bar for pointer and touch users. Its session-local Focus Tools provide
a transient laser plus pen and highlighter strokes with Undo and Clear. Ink
survives Step changes on the current slide, clears on slide changes, and renders
outside the deck View Transition. The speaker exposes the same three tools over
its current preview and synchronizes their actions through the existing
`BroadcastChannel`. A late audience receives persistent Pen and Highlighter ink;
Laser remains transient and exact-Position scoped.
The speaker view remains the authoritative place for persistent progress and
notes.

Use current platform APIs directly. Drever does not need compatibility fallbacks
for legacy browsers.

### Deterministic PDF and print export

The delivered `drever export pdf` command exports the final Step of each slide
by default. `--slides` selects validated one-based slide ranges, and `--steps`
emits Step 0 and every exact sparse stop for those slides. The exporter uses
an isolated temporary application, explicit plugin/font/image readiness, tagged
Chromium output, and success-only writes without changing the interactive
static-site artifact. Optional notes and handout formats remain compatible
follow-up work.

PDF is the portable, printable fallback offered by [Google Slides][google-present],
[PowerPoint][powerpoint-export], [Keynote][keynote-export], and [Slidev][slidev-export].
The deployed web build remains the canonical format for interactive content.

### Accessibility contract

The delivered `drever check` command reports missing or duplicate slide titles,
missing or empty image alternatives, skipped heading levels, and authored video
without captions. Human and versioned JSON reports use the same stable codes,
severity summary, actionable hints, and exact source locations. Only errors make
the command fail, so warnings remain useful evidence without becoming an
arbitrary delivery gate.

The `/document` route complements preflight with a scrollable, searchable HTML
view. It renders every slide at its final Step, labels each slide as a landmark,
and provides a table of contents without mounting speaker notes. The audience
control bar and `D` shortcut open the document at the current slide.

The contract fails clearly when Drever can prove a source defect and leaves
judgment to the author. It does not guess contrast through arbitrary CSS,
visual reading order, alternative-text quality, caption accuracy, or semantics
created inside runtime components. Google recommends alternative text,
headings, contrast, captions, and a scrollable HTML view in its
[accessibility guidance][google-accessibility]. Microsoft checks alternative
text, captions, logical reading order, and unique slide titles in its
[Accessibility Checker][microsoft-accessibility].

## P1 — AI-first authoring and design quality

This phase is the current product priority. AI can already produce plausible
slide markup; Drever should differentiate by giving an agent an exact framework
contract and by making consistently strong design, motion, and delivery
verifiable. The framework should own reusable visual grammar instead of asking
every prompt to rediscover it.

### P1-A — agent authoring foundation: delivered

`drever agent sync` installs versioned project-local skills for creating,
authoring, and reviewing a deck. Its ownership markers preserve user
instructions and stop on conflicts instead of silently replacing them.

`drever context [entry] --json` exposes the resolved canvas, exact static slide
and sparse Step manifest, source fragments and ranges, theme tokens and
guidance, motion intents, layout recipes, component manifests, normalized
plugins, and source preflight. It applies configured Remark contributions but
does not pretend static analysis can judge rendered composition or runtime React
output. See [Agent authoring](./agent-authoring.md).

`drever current --json` adds the first live authoring signal: an ephemeral,
versioned snapshot of the last audience or speaker position published by
`drever dev`. It lets an agent resolve “this slide” without introducing an
editor service or shipping authoring code in production bundles.

`drever mcp [entry]` now exposes the context, compact slide catalog, exact slide
source, source preflight, and optional development position as dependency-free,
read-only MCP `2025-11-25` stdio tools. Tool calls reread authored MDX, while the
config and CompilePlan remain stable for one server process. Source writes stay
in normal workspace tools so permission, diff, testing, and rollback semantics
do not split across two editing systems. Source-linked visual review builds on
this boundary.

### P1-B — motion choreography: delivered

`MotionGroup` now exposes five semantic intents: focused reveal, replacement,
comparison, restrained stagger, and continuity. The first three operate on
direct Steps; replacement reserves one shared layout frame and exposes only its
active state while presenting, then expands its complete history in document
view. Stagger reveals at most four direct children inside one Step, so visual
delay never invents navigation state. Continuity requires an explicit lowercase
kebab-case identity on the same object across adjacent slides.

Core owns Step and accessibility semantics plus continuity identity. The client
owns deck-scoped capture, the Navigation-to-React commit, and navigation
direction. Each official theme owns a distinct CSS mapping plus JSON-safe
guidance. Audience motion is disabled for reduced motion and is never assigned
in speaker, document, or export rendering.
The product-tour reference deck and Chromium assertions cover forward and
backward Step recipes, stable persistent headings and replacement geometry,
explicit continuity, accessibility state, and non-audience behavior. See
[Motion choreography](./motion.md).

This slice deliberately does not expose arbitrary animation props, infer shared
identity, or judge aesthetic quality automatically. Expanded composition
recipes and rendered geometry evidence remain P1-C work.

### P1-C — design recipes and rendered preflight

Expand a small set of theme-owned composition recipes for the recurring jobs a
presentation actually needs: opening, argument, comparison, evidence, process,
media, and conclusion. Prefer a few exceptional recipes over a broad catalog.
Their manifests must remain useful to both people and agents, with slot purpose,
content constraints, variants, examples, and canvas behavior.

Add a rendered design-preflight layer that can inspect every exact Step state at
the configured canvas. It should report evidence such as clipping, unintended
overflow, unstable persistent geometry, and suspicious density through stable
diagnostics. Contrast, hierarchy, and aesthetic quality still require calibrated
rules and human judgment; Drever should not label guesses as compiler facts.

### P1-D — source-aware review loop

Connect rendered evidence back to slide, Step, component, and authored source
locations. An agent should be able to request the affected states, inspect the
same evidence as a reviewer, make a focused source change, and rerun the checks.
This remains a local, repository-native loop: no hosted editor, hidden prompt
state, or runtime agent dependency is required.

### Existing common delivery foundations

- **Rehearsal:** the speaker view tracks total and current-slide time,
  accumulated per-slide time, visits, and an optional editable target initialized
  by `rehearsal.targetDurationMinutes`. Measurements remain session-local. A
  transition-readiness signal is later work.
- **Canonical sharing:** the audience command bar copies the exact slide and
  Step URL while preserving query and hash state. It requires the Clipboard API
  and reports failure without a legacy fallback. Document embedding and
  dependency-free QR output remain later work.

Keynote exposes a comparable [timer and readiness indicator][keynote-presenter],
while PowerPoint records [rehearsal timings][powerpoint-rehearsal]. Drever's
delivered rehearsal clock does not yet claim the readiness portion of that
comparison.

## P2 — optional enhancements and integrations

- saved annotations and presenter pointers over a paired network transport;
- authored timings and automatic playback for kiosks and demos;
- microphone-powered live captions with explicit permission, privacy, and
  language errors. Google documents browser-powered captions in current Chrome,
  Edge, and Safari in its [caption guidance][google-captions];
- moderated audience questions, voting, polls, and reactions;
- securely paired cross-device remote control;
- recording and video export;
- multi-presenter coordination;
- hosted review annotations connected to a source repository.

Google Slides demonstrates the value of audience questions and voting in its
[audience Q&A workflow][google-qa], but these features require identity,
moderation, persistence, and a network service. They should not become implicit
runtime infrastructure.

## Not core

Drever should not reproduce a real-time visual editor, file permissions,
comments, assigned tasks, or version history. Google provides those capabilities
as part of its collaborative document service, including distinct viewer,
commenter, and editor roles in [Google Drive sharing][google-sharing]. Drever's
source of truth is MDX in a repository; Git branches, pull requests, and hosting
integrations are the appropriate collaboration layer.

Likewise, PPTX and Keynote import should not block the delivery roadmap. They may
be lossy adapters later, after Drever's own manifest, export, and accessibility
contracts are stable.

[google-accessibility]: https://support.google.com/docs/answer/6199477?hl=en
[google-captions]: https://support.google.com/docs/answer/9109474?hl=en
[google-present]: https://support.google.com/docs/answer/1696787?co=GENIE.Platform%3DDesktop&hl=en
[google-qa]: https://support.google.com/docs/answer/6386827?co=GENIE.Platform%3DDesktop&hl=en
[google-sharing]: https://support.google.com/docs/answer/2494822?hl=en
[keynote-export]: https://support.apple.com/en-lamr/guide/keynote/tane4c936f0c/mac
[keynote-play]: https://support.apple.com/en-lamr/guide/keynote/tan72233051/mac
[keynote-presenter]: https://support.apple.com/en-gb/guide/keynote/tana4da2681/mac
[microsoft-accessibility]: https://support.microsoft.com/en-us/office/rules-for-the-accessibility-checker-651e08f2-0fc3-4e10-aaca-74b4a67101c1
[powerpoint-export]: https://support.microsoft.com/en-us/office/export-a-presentation-6ee4272e-8f64-47f6-bd32-12fe50eef477
[powerpoint-presenter]: https://support.microsoft.com/en-us/office/what-is-presenter-view-98f31265-9630-41a7-a3f1-9b4736928ee3
[powerpoint-rehearsal]: https://support.microsoft.com/en-US/PowerPoint/training/rehearse-and-time-the-delivery-of-a-presentation
[slidev-export]: https://sli.dev/guide/exporting.html
[slidev-ui]: https://sli.dev/guide/ui

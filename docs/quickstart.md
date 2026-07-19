# Quick start

This guide describes the current delivery slice: author and check an MDX deck,
present it locally, publish an accessible reading view, build a standalone web
application, and export a portable PDF.

## Requirements

- Node.js 24.18 or newer.
- A current Chromium-family browser with Navigation API,
  `Document.startViewTransition`, `BroadcastChannel`, and `ResizeObserver`.
- Playwright Chromium for PDF export. Install it once with
  `npx playwright install chromium`. CI images can use
  `npx playwright install --with-deps chromium`.

Drever deliberately has no legacy router or animation fallback. It reports an
unsupported-platform diagnostic when a required browser API is missing.
`prefers-reduced-motion` is respected without changing the runtime model.

## Create a deck

Install `drever` as a project dependency and add scripts for its local binary:

```json
{
  "scripts": {
    "check": "drever check",
    "dev": "drever dev",
    "build": "drever build",
    "export": "drever export pdf"
  },
  "devDependencies": {
    "drever": "latest"
  }
}
```

Create `slides.mdx`. A root-level line containing exactly `---` starts a new
slide. Leave a blank line before it so Markdown cannot interpret the preceding
text as a Setext heading.

```mdx
# The first slide

One clear idea is enough.

---

## Progressive disclosure

<Step>Shown at stop 1</Step>
<Step at={3}>Shown at stop 3</Step>

<Note>Speaker-only guidance. Notes are not mounted in the audience viewer.</Note>
```

`Step` and `Note` are built into compiled MDX, so a deck does not need to import
them. An omitted `at` is assigned in document order. Explicit `at` values must be
static positive integers; gaps are preserved, so the example navigates through
stops `0 -> 1 -> 3`.

## Add meaningful motion

Use ordinary Steps for most disclosure. `MotionGroup` adds one of five narrative
intents when the relationship between states matters:

```mdx
## Keep context, focus the decision

<MotionGroup intent="focus">
  <Step>Compile one deterministic artifact.</Step>
  <Step>Test every addressable state.</Step>
  <Step>Deploy the experience you reviewed.</Step>
</MotionGroup>
```

`focus`, `replace`, and `compare` use direct Step children. `stagger` belongs
inside one Step and contains at most four direct visual children. `continuity`
requires the same explicit lowercase kebab-case `name` on the same object across
adjacent slides. Themes decide how each intent looks; Drever owns Step state,
accessibility, React transition boundaries, and reduced-motion behavior. See
[Motion choreography](./motion.md) for the complete grammar and examples.

## Set up agent authoring

Install Drever's project-local authoring instructions and skills:

```bash
drever agent sync
```

The command creates a managed block in `AGENTS.md` and three skills under
`.agents/skills` for deck creation, focused authoring, and presentation review.
It preserves instructions outside its marked block and never replaces an
unmarked, user-owned skill file. If any target conflicts, sync reports every
conflict before writing planned files. It can run before the deck or config is
valid and is safe to repeat after upgrading Drever.

Inspect the resolved authoring contract before substantial generation or edits:

```bash
drever context --json
drever context talks/keynote.mdx --json
```

The versioned report joins the exact compiler-owned slide and sparse Step
manifest to authored source ranges. It also exposes the resolved canvas, theme
tokens and guidance, motion intents, layout recipes, component manifests,
semantic elements, normalized plugins, and source preflight. Executable module
references are excluded.

`context` runs the protected slide grammar and configured Remark contributions;
it does not render the deck or execute Rehype, Recma, Vite transforms, or runtime
React components. Use the checks and rendered inspection below for visual,
interaction, and delivery evidence. See [Agent authoring](./agent-authoring.md)
for ownership details and the recommended create/edit/review loop.

## Check accessibility

Run the source-based preflight before presenting or building:

```bash
drever check
drever check talks/keynote.mdx
drever check --json
```

The human report prints actionable diagnostics with source locations. `--json`
emits one stable report with `version`, `sourcePath`, `slideCount`, `summary`,
and `diagnostics`. Each diagnostic has a stable code, severity, message, stage,
and exact source range when the issue maps to authored text. This makes the same
evidence useful to a person, CI, or an AI editing the MDX.

Preflight resolves the configured entry but does not create a CompilePlan, run
plugin build factories, start Vite, or write build and plugin caches.

The initial rules report defects Drever can establish from static source:

- missing or duplicate slide titles;
- missing or explicitly empty alternative text on Markdown and MDX images;
- skipped heading levels within a slide;
- authored `<video>` elements without a caption `<track>`.

The command exits nonzero only when the report contains errors. Warnings remain
visible and machine-readable without blocking delivery. For example, a CI step
can archive the complete report while failing only on proven errors:

```bash
drever check --json > drever-check.json
```

This is deliberately not a visual accessibility oracle. Drever does not guess
whether alternative text is useful, calculate contrast through arbitrary CSS,
infer visual reading order, judge caption accuracy, or inspect markup generated
inside opaque runtime components. Review those qualities in the rendered deck;
custom components remain responsible for exposing accessible semantics. Use the
`/document` surface described below to inspect the fully revealed reading order
and browser accessibility tree.

Start the viewer and create a production build:

```bash
pnpm dev
pnpm build
```

The default input is `slides.mdx` and the default output is `dist/`. Either
command also accepts one entry path, for example `drever dev talks/demo.mdx`.
Content-only MDX edits use React Fast Refresh and preserve the current URL, Step,
and interactive component state. Changing slide boundaries or Step stops
rebuilds the manifest and intentionally reloads the viewer.

## Export a PDF

Export one page per slide at its final authored Step:

```bash
drever export pdf
```

The default output is `slides-export.pdf` in the project root. An explicit
entry and output can appear with the export flags in any order:

```bash
drever export pdf talks/keynote.mdx --output release/keynote.pdf
drever export pdf --steps talks/keynote.mdx
```

`--steps` emits Step 0 followed by every exact compiled stop. A slide with
`stepStops: [2, 5]` therefore creates pages for `0`, `2`, and `5`; Drever never
invents intermediate states. Notes are excluded. Export uses the configured or
theme canvas, disables motion, waits for exporter-only plugin hooks, usable
fonts, and authored images, and writes the PDF only after capture and cleanup
succeed. Its temporary Vite application never mutates `build.outDir`.

Use React `useId` in reusable components; duplicate hard-coded DOM IDs fail
multi-page export. Components that use CSS background images, canvas, video
posters, or dynamically created media must await them from an `exportSetup`
hook.

The result is deterministic in page order, presentation state, dimensions, and
readiness. PDF metadata can vary with Chromium and the host font environment,
so byte-for-byte equality is not part of the contract.

## Configure the project

Configuration is typed and intentionally exposes only curated settings:

```ts
// drever.config.ts
import { defineConfig } from "drever";

export default defineConfig({
  entry: "slides.mdx",
  canvas: { width: 1600, height: 900 },
  stage: {
    background: "./stage-background.tsx",
    foreground: "./stage-foreground.tsx",
  },
  rehearsal: { targetDurationMinutes: 20 },
  server: {
    host: "127.0.0.1",
    port: 4317,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
```

`rehearsal.targetDurationMinutes` supplies the initial target shown in the
speaker view. The speaker can edit or clear that target during the current
session; those changes and all recorded timings remain session-local.

`stage` adds project-wide visual layers without putting them inside each
slide's transition. Each configured path is relative to the project root and
must default-export a React component that accepts `StageLayerProps` from
`drever`. Either layer may be omitted.

```tsx
// stage-foreground.tsx
import type { StageLayerProps } from "drever";

export default function StageForeground({ manifest, position }: StageLayerProps) {
  return (
    <span aria-hidden="true" className="page-number">
      {position.slideIndex + 1} / {manifest.slides.length}
    </span>
  );
}
```

The props contain the resolved `canvas`, complete `manifest`, current
`position`, `reducedMotion` value, and exact `renderMode`. A nested component
may read the same frozen value with `useStage()` from `drever` instead of
threading those props through every level.

Drever mounts the background behind the slide content and the foreground above
it. In the audience viewer, both component instances persist while their props
update across slides and Steps. Speaker view creates one instance for each
current/next preview. Document view creates one reduced-motion Stage for each
fully revealed slide page, and export creates one for each output page at that
page's exact Step. Stage components must therefore suppress audience-only
effects outside audience mode and use `useId` for identifiers repeated in
document or export output.

Keep stable decoration stable. If a background scene changes, animate only the
glow, shape, number, or other sub-element that actually changed; do not put the
complete background or foreground into the slide transition.

The default theme is active when `theme` is omitted. It styles ordinary Markdown
and registers the semantic `Cover` and `TwoColumn` layouts:

```mdx
<Cover
  eyebrow="Drever / 2026"
  title="Presentations can be software."
  supporting="Interactive, testable, and ready to ship."
  tone="accent"
/>

---

<TwoColumn
  primary={
    <>
      <h2>Claim</h2>
      <p>One focused argument.</p>
    </>
  }
  secondary={
    <>
      <h2>Evidence</h2>
      <p>Something the audience can inspect.</p>
    </>
  }
/>
```

A custom theme is assigned to `theme`. Shiki and Tailwind CSS are active by
default. They can be configured or disabled through the typed exports from
`drever`; other plugins may be registered directly or with project settings:

```ts
import { defineConfig, shikiPlugin, tailwindCss } from "drever";

export default defineConfig({
  plugins: [
    { plugin: shikiPlugin, enabled: false },
    tailwindCss({ optimize: true }),
    myPlugin,
    { plugin: configuredPlugin, config: { mode: "concise" } },
  ],
});
```

The first matching entry overrides a default registration; other entries are
normalized with `origin: "user"`. Authors never provide compiler provenance.
See [Official plugins](./official-plugins.md) for Shiki, Tailwind CSS, Math, and
the Mermaid safety plan. Plugin definitions, build modules, and runtime
components are covered in [Extension authoring](./extensions.md).

## Present and inspect

- Next Step or slide: `Space`, `ArrowRight`, or `PageDown`.
- Previous Step or slide: `Shift+Space`, `ArrowLeft`, or `PageUp`.
- Next / previous slide, skipping Steps: `ArrowDown` / `ArrowUp`.
- First / last: `Home` / `End`.
- Slide navigator: press `O` or `G`, or select the position in the audience
  control bar. Search by title or number and select a result to jump through
  the same path-addressable navigation system.
- Direct slide jump: type a slide number, then press `Enter`.
- Fullscreen: `F`. Pause on a blank black or white screen with `B` or `W`;
  press the same key, `Escape`, or select the screen to return.
- Keyboard help: `?`.
- Copy link: use the audience command bar to copy the canonical URL for the
  current slide and exact Step.
- Document view: press `D` to open a searchable, fully revealed reading view at
  the current slide.
- Speaker view: press `P` from the audience to open the same slide and Step in a
  new speaker window.
- Pointer and touch users can navigate, open the slide navigator, document or
  speaker view, and enter fullscreen from the compact audience control bar. The
  bar is rendered outside the slide canvas, so it is never captured by slide
  View Transitions.
- Audience navigation does not capture input or interactive controls. In speaker
  chrome, Arrow/Page/Home/End continue to work after a control receives focus;
  Space and Enter retain the focused button's native behavior, and the focused
  notes scroller retains its scrolling keys.

The canonical URL records the exact position as a path relative to the deck's
mount point:

| Position             | Audience path |
| -------------------- | ------------- |
| First slide, Step 0  | `/`           |
| Second slide, Step 0 | `/2`          |
| Second slide, Step 3 | `/2/3`        |

Deep links, reload, back, and forward therefore select the same slide and exact
sparse Step. A production build emits a static `index.html` for every valid
path. Its small bootstrap computes the deployment mount before activating
assets, so clean links work with or without a trailing slash and when the deck
is deployed below a subdirectory. Query parameters and the hash are preserved
but do not encode Drever state.

The audience **Copy link** action encodes the current presentation state against
that canonical route and preserves the source query and hash. It writes the
absolute URL through `navigator.clipboard.writeText()`, which requires the
Clipboard API in a secure context. If the API is absent or the browser rejects
the write, Drever shows a failure status and reports the error. It does not fall
back to `document.execCommand()` or an invisible text field.

Open `/document` for a single scrollable presentation transcript. It renders
every slide at its final authored Step, provides a table of contents, and names
each slide landmark from the compiled title. Browser Find can search the whole
deck. Speaker notes stay out of this surface. The `D` shortcut opens a new
window and uses the current slide id as a fragment, such as
`/document#slide-2`; the fragment is an anchor, not presentation state. The
static build includes `/document/index.html`, including for subdirectory
deployments.

Drever-generated navigation omits a trailing slash. A static host may append
one when serving a directory entry; both forms decode to the same position.

The clean-URL static entries install their mount base with small inline scripts
before activating built assets. Strict CSP deployments must currently allow
those scripts, either with an inline-script policy or with exact hashes computed
from the final HTML. The CLI does not yet emit nonce/hash metadata; that is a
future deployment mode rather than an implicit unsafe fallback.

Open `/speaker`, `/speaker/2`, or `/speaker/2/3` for the speaker view at the
same position. It provides current and next-state previews, `<Note>` content, a
rehearsal workspace, navigation controls, and an **Open audience** action. The
workspace tracks total elapsed time, time on the current slide, accumulated
time and visit count for every slide, and remaining or overtime against an
optional editable target. Pause/resume stops and restarts accounting; reset
clears the timings and begins the current slide's first visit again.

Rehearsal state exists only for the lifetime of that speaker view. It is not
written into the deck, persisted across reloads, or synchronized to an audience
window. Audience windows opened before or after the speaker view synchronize
presentation position through `BroadcastChannel`; this release does not claim
remote transition-readiness synchronization. `drever dev` prints the speaker
URL; the `P` shortcut derives its path from the current audience state and
preserves unrelated query/hash state.

Inactive audience slides leave the accessibility tree while React preserves
their local component state.

## Generate with AI

Give an AI the presentation brief plus this compact contract:

```text
Create a Drever slides.mdx deck. Separate slides with a root-level `---` line
surrounded by blank lines. Give each slide one dominant idea. Prefer Markdown;
use Cover only for an opening or true chapter break and TwoColumn only for a
meaningful comparison. Keep titles under 10 words and prose under 45 words per
region. Use static Step elements only for meaningful progressive disclosure.
Add MotionGroup only for a semantic focus, replace, compare, stagger, or
continuity relationship; never invent animation props. Put speaker guidance in
Note. Do not reference __DreverSlide or __DreverStep.
```

The complete runnable example is in [`examples/basic`](../examples/basic/README.md).

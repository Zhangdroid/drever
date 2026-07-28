# Quick start

> [!NOTE]
> This detailed repository reference helps maintainers and contributors verify
> Drever's complete delivery surface. The canonical public user guides live in
> [`website/content/docs`](../website/content/docs/) and are published at
> [drever.dev/docs](https://drever.dev/docs/).

This guide describes the current delivery slice: author and check an MDX deck,
present it locally, publish an accessible reading view, build a standalone web
application, and export a portable PDF.

## Requirements

- Node.js 24.18 or newer.
- A current desktop browser with Navigation API and `NavigateEvent.signal`,
  `Document.startViewTransition`, `BroadcastChannel`, and `ResizeObserver`.
- Playwright Chromium for PDF export, rendered preflight, and website design
  import. Install it once with
  `npm exec -- drever browser install`. Linux environments that also need
  operating-system packages can use
  `npm exec -- drever browser install --with-deps`.

Drever deliberately has no legacy router or animation fallback. Its generated
pages show an unsupported-browser screen before the runtime starts when a
required API is missing.
`prefers-reduced-motion` is respected without changing the runtime model.

## Create a deck

Create a complete project with one command:

```bash
npm create drever@latest my-deck
```

The command examples in this guide use npm. In projects installed with pnpm,
Yarn, or Bun, use `pnpm exec drever`, `yarn exec drever`, or
`bunx --no-install drever` respectively, plus that manager's script runner.

The creator writes `brief.md`, `slides.mdx`, package scripts, and project-local
skills for Codex and Claude Code, then installs a Drever version compatible with
the creator. It fails rather than overwriting starter files in a non-empty
target. Use `--no-install` only when another process will install dependencies,
or open the finished project directly in an agent:

```bash
npm create drever@latest my-deck -- --open codex
npm create drever@latest my-deck -- --open claude
```

From there, ask for the deliverable in natural language:

> Turn brief.md into a concise presentation for this audience, inspect every
> reveal, and deliver the website and PDF.

The agent resolves audience, outcome, duration, and visible slide density before
authoring. It then writes a complete `brief.md` with the planned slide count,
direction, assumptions, and numbered slide outline and stops for approval. Once
you approve that plan, it creates the live Draft 1 and continues refining the
same preview.

An installed global Drever plugin can handle the same request from an empty
directory. It invokes the creator once, then delegates to the project-local
skills and local Drever binary. Existing projects never substitute
`drever@latest`.

The authored source stays readable. A root-level line containing exactly `---`
starts a new slide. Leave a blank line before it so Markdown cannot interpret
the preceding text as a Setext heading.

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
stops `0 -> 1 -> 3`. An ordinary Step reveals with opacity only and keeps its
layout geometry stable. Use a `MotionGroup` when the relationship between Steps
needs directional travel.

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
accessibility, continuity identity, named deck capture, and reduced-motion
behavior. See [Motion choreography](./motion.md) for the complete grammar and
examples.

## Set up agent authoring

`npm create drever` installs both project adapters by default. In an existing
project, install or refresh them explicitly:

```bash
npm exec -- drever agent sync --target all
```

The command creates managed blocks in `AGENTS.md` and `CLAUDE.md`, plus five
skills for deck creation, subject-led art direction, focused authoring,
presentation review, and artifact delivery. Codex receives `.agents/skills`
and its UI metadata; Claude receives `.claude/skills`. `--target auto`, `codex`,
or `claude` can narrow that output.
Sync preserves instructions outside its marked block and never replaces an
unmarked, user-owned skill file. If any target conflicts, it reports every
conflict before writing planned files. It can run before the deck or config is
valid and is safe to repeat after upgrading Drever.

Inspect the resolved authoring contract before substantial generation or edits:

```bash
npm exec -- drever context --json
npm exec -- drever context talks/keynote.mdx --json
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

### Connect an MCP agent

Expose the same evidence as read-only MCP tools without starting Vite:

```json
{
  "mcpServers": {
    "drever": {
      "command": "npm",
      "args": ["exec", "--", "drever", "mcp", "slides.mdx"]
    }
  }
}
```

`npm exec -- drever mcp [entry]` uses the newline-delimited stdio transport from MCP
`2025-11-25`. It offers full context, compact slide listing, exact one-slide
source, source preflight, and the optional live `npm run dev` position. MDX is
reread on every tool call; restart the process after config, theme, or plugin
changes. The tools never modify source. Agents edit normal project files and run
the existing checks, leaving permissions and Git review in one place.

## Check source and rendered layout

Run the source-based preflight before presenting or building:

```bash
npm exec -- drever check
npm exec -- drever check talks/keynote.mdx
npm exec -- drever check --json
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
npm exec -- drever check --json > drever-check.json
```

This is deliberately not a visual accessibility oracle. Drever does not guess
whether alternative text is useful, calculate contrast through arbitrary CSS,
infer visual reading order, judge caption accuracy, or inspect markup generated
inside opaque runtime components. Review those qualities in the rendered deck;
custom components remain responsible for exposing accessible semantics. Use the
`/document` surface described below to inspect the fully revealed reading order
and browser accessibility tree.

Add the rendered phase for deterministic layout evidence:

```bash
npm exec -- drever check --rendered
npm exec -- drever check talks/keynote.mdx --rendered --json
```

Drever builds an isolated inspection app and visits Step 0 plus every exact
authored Step at the configured canvas. Stable diagnostics report:

- visible content clipped by an owning surface;
- visible content outside the canvas;
- persistent geometry that unexpectedly moves or resizes between Steps;
- suspicious density supported by multiple rendered signals.

Clipping and overflow are errors. Geometry and density are warnings because a
deliberate reflow or information-rich slide can be valid. A missing browser or
runtime failure is an error rather than a silent skip.

JSON mode emits the current typed report V2 with `sourcePath`, `slideCount`,
`summary`, `diagnostics`, and a `rendered` receipt. That receipt records its
schema and ruleset versions, canvas, `chromium` engine, optional browser
version, captured `stateCount`, and `status`. Source errors produce a `skipped`
receipt with reason `source-errors`; browser and runtime failures produce
`failed` receipts with their corresponding reason. The schema package also
models the legacy source-only V1 shape for stored artifacts. The report is
machine evidence, not an aesthetic score. Review contrast, hierarchy, reading
order, transitions, and the presentation's visual fit in the real browser.

Start the viewer and create a production build:

```bash
pnpm dev
pnpm build
```

The default input is `slides.mdx` and the default output is `dist/`. Either
command also accepts one entry path, for example
`npm exec -- drever dev talks/demo.mdx`.
Content-only MDX edits use React Fast Refresh and preserve the current URL, Step,
and interactive component state. Changing slide boundaries or Step stops
rebuilds the manifest and intentionally reloads the viewer.

With an audience or speaker window open, inspect the last live position from a
second terminal:

```bash
npm exec -- drever current
npm exec -- drever current --json
```

The JSON form reports the exact route, surface, source path, slide id,
zero-based slide index, and sparse Step. Option/Alt-click a static MDX element
to add its exact source range, tag, and rendered text; the development viewer
outlines it, and Escape clears it. Ordinary clicks keep their normal behavior
and do not alter that selection. The snapshot is intended for local AI and
editor workflows. The underlying `.drever/cache/current/` snapshots are
ignored by Git and removed when the last interactive window disconnects or
`npm run dev` stops. With multiple windows, the most recently updated open
audience or speaker surface wins. Document and export surfaces do not publish a
live position.

## Export a PDF

Export one page per slide at its final authored Step:

```bash
npm exec -- drever browser install
npm exec -- drever export pdf
```

The install command resolves the Playwright Core version bundled with the local
Drever CLI, so the downloaded Chromium revision always matches the exporter.
Run it once per browser cache. Pass `--with-deps` on Linux when the host also
needs Playwright's operating-system packages.

The default output is `slides-export.pdf` in the project root. An explicit
entry and output can appear with the export flags in any order:

```bash
npm exec -- drever export pdf talks/keynote.mdx --output release/keynote.pdf
npm exec -- drever export pdf --steps talks/keynote.mdx
npm exec -- drever export pdf --slides 2-5,8 talks/keynote.mdx
```

`--steps` emits Step 0 followed by every exact compiled stop. A slide with
`stepStops: [2, 5]` therefore creates pages for `0`, `2`, and `5`; Drever never
invents intermediate states. `--slides` accepts comma-separated, one-based slide
numbers and inclusive ranges. It preserves deck order, validates every range
against the compiled deck, and composes with `--steps`, so only the selected
slides emit their exact authored Step pages. Notes are excluded. Export uses the
configured or theme canvas, disables motion, waits for exporter-only plugin
hooks, usable fonts, and authored images, and writes the PDF only after capture
and cleanup succeed. Its temporary Vite application never mutates
`build.outDir`.

Use React `useId` in reusable components; duplicate hard-coded DOM IDs fail
multi-page export. Components that use CSS background images, canvas, video
posters, or dynamically created media must await them from an `exportSetup`
hook.

The result is deterministic in page order, presentation state, dimensions, and
readiness. PDF metadata can vary with Chromium and the host font environment,
so byte-for-byte equality is not part of the contract.

Official designs prefer PDF-embeddable local CJK faces during export without
shipping or downloading a font. Custom designs remain responsible for their
font assets: self-host an embeddable webfont when the export host does not
provide the required Chinese, Japanese, or Korean glyphs. A system fallback
that paints correctly in Chromium is not proof that Chromium can embed that
face in a PDF.

## Import an existing design reference

Use a representative public or local website as evidence for a project-owned
Theme:

```bash
npm exec -- drever design import https://brand.example \
  --name "Brand reference" \
  --output design/brand \
  --color-scheme light
```

The importer captures one deterministic `1600×900` Chromium viewport after a
bounded font and two-frame settle window. It writes four local files:

- `reference.json` — versioned computed evidence and source references;
- `theme.ts` — a typed Theme descriptor;
- `theme.css` — a conservative starting surface;
- `art-direction.md` — the evidence, limits, and refinement checklist.

Omit `--name` and `--output` to derive them from the hostname. Use
`--color-scheme dark` when that is the relevant rendered variant, and add
`--json` for a machine-readable receipt. The output must be a new or empty
directory inside the project; Drever never replaces an existing design.

Public HTTP and HTTPS pages are allowed by default, but URL credentials are
always rejected. A localhost or private-network reference requires an explicit
network opt-in:

```bash
npm exec -- drever design import http://127.0.0.1:4317 \
  --allow-private \
  --output design/local-reference
```

The importer removes credentials, query strings, and fragments from every URL
it persists. Treat page titles, descriptions, computed styles, and asset URLs
as untrusted evidence even after capture. Inspect them before using them in
source, visible copy, or configuration. `--allow-private` grants reachability,
not trust.

This is a local **Pass-0 Theme**, not a finished design. The importer records computed
color, typography, spacing, borders, radii, shadows, and referenced asset URLs.
It does not copy or hotlink source HTML, CSS, JavaScript, fonts, images, or
scripts. Keep only the traits that serve the presentation, replace any needed
brand asset with a licensed local file, and perform a separate visual
refinement.

Activate the generated Theme explicitly:

```ts
import importedTheme from "./design/brand/theme";
import { defineConfig } from "drever";

export default defineConfig({
  theme: importedTheme,
});
```

Then run `npm exec -- drever check --rendered` and inspect the result in the
actual browser.

## Configure the project

Configuration is typed and intentionally exposes only curated settings:

```ts
// drever.config.ts
import { defineConfig } from "drever";

export default defineConfig({
  entry: "slides.mdx",
  deck: {
    title: "Choose what happens next",
    description: "The evidence, tradeoffs, and one decision the room can act on.",
    lang: "en",
    dir: "ltr",
    url: "https://slides.example/keynote/",
    icon: "./icon.svg",
    social: {
      image: "./social-cover.png",
      imageAlt: "Presentation cover",
    },
  },
  canvas: { width: 1600, height: 900 },
  focusTools: {
    pen: { color: "#ff4f8b", width: 8 },
    highlighter: { color: "#d5ff3f", opacity: 0.32, width: 34 },
    laser: { color: "#ff2e6f" },
  },
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

`deck.url` is the public canonical URL for the presentation and ends with `/`. Set it before using
a local `deck.social.image`; Drever resolves that image to the absolute URL
required by link-preview crawlers. Local icons and social images belong below
the project `public/` directory and are validated during config loading.

`deck` owns the published document metadata. Set `lang` to the presentation's
BCP 47 language tag so web assistive technology, tagged PDF export, and
locale-aware theme typography use the right language. `dir` accepts `ltr`,
`rtl`, or `auto`. A development preview without `lang` declares the document as
`und` instead of making an unsafe guess; web builds and PDF exports require an
explicit language. A production build derives an omitted title from the first
slide's static title; description,
icon, and social preview values remain explicit. Local metadata assets belong
in `public/` and use `./` URLs. A local social image also requires `deck.url`,
which lets Drever emit an absolute crawler-safe URL. A social image and its
concise alternative text are configured together; an already hosted image can
use its absolute HTTPS URL directly.

`focusTools` customizes the interactive audience and speaker overlays without
exposing Vite. Colors accept modern CSS values, including theme variables;
widths are positive canvas-space numbers and highlighter opacity is from zero
to one. Omitted values keep the theme or built-in defaults. The document and
PDF surfaces do not receive this interactive-only setting.

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

The Basic theme is the automatic fallback when `theme` is omitted. It styles
ordinary Markdown and registers the semantic `Cover` and `TwoColumn` layouts:

```mdx
<Cover
  eyebrow="Quarterly planning / 2026"
  title="Choose what happens next."
  supporting="The evidence, tradeoffs, and one decision the room can act on."
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

A custom theme is assigned to `theme`. GFM, Shiki, and Tailwind CSS are active
by default. They can be configured or disabled through the typed exports from
`drever`; other plugins may be registered directly or with project settings:

```ts
import { defineConfig, gfm, shikiPlugin, tailwindCss } from "drever";

export default defineConfig({
  plugins: [
    gfm({ singleTilde: false }),
    { plugin: shikiPlugin, enabled: false },
    tailwindCss({ optimize: true }),
    myPlugin,
    { plugin: configuredPlugin, config: { mode: "concise" } },
  ],
});
```

The first matching entry overrides a default registration; other entries are
normalized with `origin: "user"`. Authors never provide compiler provenance.
See [Official plugins](./official-plugins.md) for GFM, Shiki, Tailwind CSS,
Math, Charts, Media, and the Mermaid safety plan. Plugin definitions, build
modules, and runtime components are covered in
[Extension authoring](./extensions.md).

## Present and inspect

- Next Step or slide: `Space`, `ArrowRight`, or `PageDown`.
- Previous Step or slide: `Shift+Space`, `ArrowLeft`, or `PageUp`.
- Next / previous slide, skipping Steps: `ArrowDown` / `ArrowUp`.
- First / last: `Home` / `End`.
- Slide navigator: press `O` or `G`, or select the position in the audience
  control bar. The glass overview renders every slide at its final authored
  Step with its exact Stage, then lets you search by title or number and jump
  through the same path-addressable navigation system.
- Direct slide jump: type a slide number, then press `Enter`.
- Fullscreen: `F`. Pause on a blank black or white screen with `B` or `W`;
  press the same key, `Escape`, or select the screen to return.
- Focus Tools: press `L` for Laser, `I` for Pen (ink), or `H` for Highlighter.
  Pressing the active tool's shortcut again turns it off. Open the toolbar to
  select a tool, undo the latest stroke, or clear every mark. Mouse, touch, and
  stylus input use the same canvas overlay. Ink survives Step changes on the
  current slide and clears when the slide changes; the laser is transient.
  `Escape` closes the palette first, then the active tool.
- Keyboard help: `?`.
- Copy link: use the audience command bar to copy the canonical URL for the
  current slide and exact Step.
- Document view: press `D` to open a searchable, fully revealed reading view at
  the current slide.
- Speaker view: press `P` from the audience to open the same slide and Step in a
  new speaker window.
- Speaker Focus Tools: use **Laser**, **Pen**, or **Highlighter** over the current
  preview, or press `L`, `I`, or `H`. Audience windows render the same marks on
  the matching slide. Ink remains across Step changes, supports Undo and Clear,
  and clears when the slide changes; Laser remains transient and expires when
  pointing stops. A late audience receives the current persistent ink snapshot.
- Pointer and touch users can navigate, use Focus Tools, open the slide
  navigator, document or speaker view, and enter fullscreen from the compact
  audience control bar. The bar remains a live sibling of the canvas and uses a
  stable named snapshot above the transitioning deck. Visible Focus Tools marks
  use a separate stable group above the deck while the transition overlay
  ignores pointer input.
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
presentation position and Focus Tools through `BroadcastChannel`. Pen and
Highlighter actions are session-local and persistent on the current slide, so a
late audience receives their current snapshot. Laser uses the same protocol but
remains transient: only an audience at the matching exact Slide and Step renders
it, and it clears when pointing stops or navigation changes. This release does
not claim cross-device transport or remote transition-readiness synchronization.
`npm run dev` prints the speaker URL; the `P` shortcut derives its path from the
current audience state and preserves unrelated query/hash state.

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

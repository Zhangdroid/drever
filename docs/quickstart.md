# Quick start

This guide describes the current audience and speaker vertical slice: author an
MDX deck, present it locally, and build a standalone web application.

## Requirements

- Node.js 24.18 or newer.
- A current Chromium-family browser with Navigation API,
  `Element.startViewTransition`, `BroadcastChannel`, and `ResizeObserver`.

Drever deliberately has no legacy router or animation fallback. It reports an
unsupported-platform diagnostic when a required browser API is missing.
`prefers-reduced-motion` is respected without changing the runtime model.

## Create a deck

Install `drever` as a project dependency and add scripts for its local binary:

```json
{
  "scripts": {
    "dev": "drever dev",
    "build": "drever build"
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

## Configure the project

Configuration is typed and intentionally exposes only curated settings:

```ts
// drever.config.ts
import { defineConfig } from "drever";

export default defineConfig({
  entry: "slides.mdx",
  canvas: { width: 1600, height: 900 },
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
- Speaker view: press `P` from the audience to open the same slide and Step in a
  new speaker window.
- Pointer and touch users can navigate, open the slide navigator or speaker
  view, and enter fullscreen from the compact audience control bar. The bar is
  rendered outside the slide canvas, so it is never captured by slide View
  Transitions.
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

Drever-generated navigation omits a trailing slash. A static host may append
one when serving a directory entry; both forms decode to the same position.

The clean-URL static entries install their mount base with small inline scripts
before activating built assets. Strict CSP deployments must currently allow
those scripts, either with an inline-script policy or with exact hashes computed
from the final HTML. The CLI does not yet emit nonce/hash metadata; that is a
future deployment mode rather than an implicit unsafe fallback.

Open `/speaker`, `/speaker/2`, or `/speaker/2/3` for the speaker view at the
same position. It provides current and next-state previews, `<Note>` content, a
timer, navigation controls, and an **Open audience** action. Audience windows
opened before or after the speaker view synchronize through `BroadcastChannel`.
`drever dev` prints the speaker URL; the `P` shortcut derives its path from the
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
Put speaker guidance in Note. Do not reference __DreverSlide or __DreverStep.
```

The complete runnable example is in [`examples/basic`](../examples/basic/README.md).

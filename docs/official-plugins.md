# Official plugins

Drever compiles a deck with Node and Vite, then ships only the runtime modules
and styles that the resolved plan references. A plugin may therefore have build
capabilities, runtime capabilities, or both without forcing its Node tooling
into the browser bundle. Presentation authors select plugins in
`drever.config.ts`; only plugin developers work with Vite, Remark, or Rehype.

This is the first official catalog:

| Plugin                       | Activation               | Capabilities                                   | Browser output                            |
| ---------------------------- | ------------------------ | ---------------------------------------------- | ----------------------------------------- |
| `@drever/plugin-gfm`         | Default; can be disabled | Remark GFM at build time                       | Semantic HTML + task-list CSS             |
| `@drever/plugin-shiki`       | Default; can be disabled | Rehype at build time                           | Highlighted HTML and CSS variables        |
| `@drever/plugin-tailwindcss` | Default; can be disabled | Official Tailwind Vite plugin                  | Generated utility CSS only                |
| `@drever/plugin-math`        | Explicit opt-in          | Remark Math, Rehype KaTeX, component-layer CSS | HTML + MathML and bundled KaTeX assets    |
| `@drever/plugin-charts`      | Explicit opt-in          | MDX component and component-layer CSS          | Deterministic semantic SVG                |
| `@drever/plugin-media`       | Explicit opt-in          | MDX component and component-layer CSS          | Audience iframe or stable link by surface |
| Mermaid                      | Deferred                 | Planned opt-in build/runtime feature           | No unsafe implementation is shipped       |

`---` splitting is not a plugin. It is Drever's protected document grammar, so
plugin order can never change pagination.

## Configure the defaults

GFM, Shiki, and Tailwind CSS work without configuration. The `drever` facade
exports their descriptors and typed helpers so overriding a transitive default
does not require another project dependency:

```ts
import {
  defineConfig,
  gfm,
  gfmPlugin,
  shiki,
  shikiPlugin,
  tailwindCss,
  tailwindCssPlugin,
} from "drever";

export default defineConfig({
  plugins: [
    gfm({ singleTilde: false }),
    shiki({ lightTheme: "github-light", darkTheme: "github-dark" }),
    tailwindCss({ optimize: true }),
  ],
});

// Any default can instead be disabled:
// plugins: [{ plugin: gfmPlugin, enabled: false }]
// plugins: [{ plugin: shikiPlugin, enabled: false }]
// plugins: [{ plugin: tailwindCssPlugin, enabled: false }]
```

The first registration with a default plugin id overrides that default in
place. A second registration with the same id remains a duplicate and produces
the compiler's stable `DREVER_PLUGIN_DUPLICATE` diagnostic.

### GitHub Flavored Markdown

GFM adds tables, task lists, autolink literals, and strikethrough during
compilation, with no browser JavaScript. A small component-layer stylesheet
aligns task-list checkboxes across designs. `singleTilde` matches the Remark
GFM default and can be disabled to require `~~double tilde~~`.

Footnotes currently fail with a clear build error. Their generated
document-level section can cross protected Slide boundaries, so Drever will not
claim support until the output is slide-scoped.

### Shiki

Shiki uses the official `@shikijs/rehype` integration. It highlights fenced
code during compilation with `github-light` and `github-dark` by default and
emits dual-theme variables using CSS `light-dark()`. Shiki itself is not loaded
by the presentation runtime.

Theme names must identify themes bundled by the installed Shiki version. See
the official [Rehype integration](https://shiki.style/packages/rehype) and
[dual-theme guide](https://shiki.style/guide/dual-themes).

### Tailwind CSS

Tailwind uses the official `@tailwindcss/vite` integration. Drever generates a
derived stylesheet under `.drever/cache`, points source detection at the deck
project rather than the private generated Vite application, and places the
result in `drever.utility`.

The plugin imports `tailwindcss/theme.css` and `tailwindcss/utilities.css`
directly. It intentionally does not import `tailwindcss/index.css` or
`preflight.css`: the selected Drever theme remains the baseline for headings,
paragraphs, lists, and media. Class names must appear as complete strings in
MDX or project components so Tailwind can detect them. See Tailwind's official
[Vite installation](https://tailwindcss.com/docs/installation/using-vite) and
[source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files)
documentation.

## Enable math

Math is opt-in so decks that do not use TeX do not install or bundle KaTeX.
Install the plugin next to `drever`, then register it:

```bash
pnpm add -D @drever/plugin-math
```

```ts
import { defineConfig } from "drever";
import { math } from "@drever/plugin-math";

export default defineConfig({
  plugins: [math({ strict: "warn", throwOnError: true })],
});
```

```md
Einstein's relation is $E = mc^2$.

$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$
```

`remark-math` parses the Markdown syntax and `rehype-katex` renders accessible
HTML plus MathML at build time. KaTeX runs with `trust: false`; its CSS and fonts
are bundled by Vite, with no CDN dependency. `throwOnError` defaults to `true`
so CI catches invalid equations. See the official
[remark-math integration](https://github.com/remarkjs/remark-math),
[KaTeX security options](https://katex.org/docs/options), and
[browser assets guide](https://katex.org/docs/browser.html).

## Enable charts

Charts are opt-in and use React plus semantic SVG directly:

```bash
pnpm add -D @drever/plugin-charts
```

```ts
import chartsPlugin from "@drever/plugin-charts";
import { defineConfig } from "drever";

export default defineConfig({
  plugins: [chartsPlugin],
});
```

```mdx
<DataChart
  label="Adoption by quarter"
  kind="line"
  valueSuffix="%"
  data={[
    { label: "Q1", value: 28 },
    { label: "Q2", value: 46 },
    { label: "Q3", value: 71 },
  ]}
/>
```

`DataChart` accepts one to twelve labeled finite values, supports `bar` and
`line`, and generates a visible chart plus an accessible title and complete
value description from the same data. It adds no chart framework, client
setup, canvas renderer, or automatic animation.

## Enable media

The first Media component is a privacy-enhanced YouTube embed:

```bash
pnpm add -D @drever/plugin-media
```

```ts
import mediaPlugin from "@drever/plugin-media";
import { defineConfig } from "drever";

export default defineConfig({
  plugins: [mediaPlugin],
});
```

```mdx
<YouTube id="M7lc1UVf-VE" title="YouTube player API demo" start={30} />
```

The active audience slide gets a lazy `youtube-nocookie.com` iframe with no
autoplay. Leaving the slide removes its remote source so playback cannot
continue over the next slide. Speaker previews, Document View, PDF export, and
print get a deterministic title and link instead of loading embedded media or
a remote thumbnail.
The iframe still makes a third-party YouTube request. Privacy-enhanced mode
limits storage before playback; it does not make embedded playback private.

## Keep the official catalog synchronized

An official plugin change is incomplete until all of these surfaces agree:

- the package manifest, AI component/config manifest, and behavioral tests;
- a Feature Gallery slide with real rendered output;
- the website plugin gallery and guide, including live links and slide numbers;
- this canonical guide, activation policy, browser/export cost, and limitations;
- release version metadata and default/facade wiring when applicable.

Repository tests require every public `packages/plugin-*` package to stay in
sync across these catalogs, the Feature Gallery dependency/configuration path,
release version metadata, and default facade wiring where applicable. Generic
agent skills remain catalog-agnostic; the compile plan exposes active
capability through plugin manifests and authoring context.

## Why Mermaid is deferred

Mermaid is not yet registered, because merely rendering its returned string
with unchecked `innerHTML` would be an unsafe and incomplete plugin. The first
release must prove all of these contracts together:

- strict Mermaid security configuration and sanitized SVG insertion;
- deterministic, collision-free SVG ids across current and next speaker previews;
- accessible labels and useful compile/runtime diagnostics;
- stable behavior in development, production, and PDF export;
- browser tests that cover untrusted diagram text and navigation remounts.

The intended shape is an explicit opt-in feature component, not a theme
responsibility. Mermaid's own documentation describes
[rendering](https://mermaid.js.org/config/usage) and the
[`securityLevel` contract](https://mermaid.js.org/config/schema-docs/config-properties-securitylevel.html).

## Plugin versus theme

A theme owns the visual language: semantic tokens, Markdown element renderers,
layout recipes, theme/layout styles, canvas defaults, and motion intent mapping.
A plugin owns added behavior: build transforms, feature components, scoped
component/utility styles, client setup, and export setup. A plugin may style the
feature it introduces, but it should not restyle global `h1`, `p`, or `ul`
elements; that remains the selected theme's job.

See [Extension authoring](./extensions.md) for the complete descriptor and
build-module contracts.

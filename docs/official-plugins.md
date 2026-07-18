# Official plugins

Drever compiles a deck with Node and Vite, then ships only the runtime modules
and styles that the resolved plan references. A plugin may therefore have build
capabilities, runtime capabilities, or both without forcing its Node tooling
into the browser bundle. Presentation authors select plugins in
`drever.config.ts`; only plugin developers work with Vite, Remark, or Rehype.

This is the first official catalog:

| Plugin                       | Activation               | Capabilities                                   | Browser output                         |
| ---------------------------- | ------------------------ | ---------------------------------------------- | -------------------------------------- |
| `@drever/plugin-shiki`       | Default; can be disabled | Rehype at build time                           | Highlighted HTML and CSS variables     |
| `@drever/plugin-tailwindcss` | Default; can be disabled | Official Tailwind Vite plugin                  | Generated utility CSS only             |
| `@drever/plugin-math`        | Explicit opt-in          | Remark Math, Rehype KaTeX, component-layer CSS | HTML + MathML and bundled KaTeX assets |
| Mermaid                      | Deferred                 | Planned opt-in build/runtime feature           | No unsafe implementation is shipped    |

`---` splitting is not a plugin. It is Drever's protected document grammar, so
plugin order can never change pagination.

## Configure the defaults

Shiki and Tailwind CSS work without configuration. The `drever` facade exports
their descriptors and typed helpers so overriding a transitive default does not
require another project dependency:

```ts
import { defineConfig, shiki, shikiPlugin, tailwindCss, tailwindCssPlugin } from "drever";

export default defineConfig({
  plugins: [
    shiki({ lightTheme: "github-light", darkTheme: "github-dark" }),
    tailwindCss({ optimize: true }),
  ],
});

// Either default can instead be disabled:
// plugins: [{ plugin: shikiPlugin, enabled: false }]
// plugins: [{ plugin: tailwindCssPlugin, enabled: false }]
```

The first registration with a default plugin id overrides that default in
place. A second registration with the same id remains a duplicate and produces
the compiler's stable `DREVER_PLUGIN_DUPLICATE` diagnostic.

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

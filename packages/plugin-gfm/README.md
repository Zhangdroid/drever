# @drever/plugin-gfm

Default GitHub Flavored Markdown for Drever, implemented with the official
`remark-gfm` parser extension. It adds autolink literals, strikethrough,
tables, and task lists during compilation with no browser JavaScript. A small
component-layer stylesheet aligns task-list checkboxes across Drever designs.
The default can be configured or disabled through the `drever` facade.

```ts
import { defineConfig, gfm } from "drever";

export default defineConfig({
  plugins: [gfm()],
});
```

Single-tilde strikethrough is enabled by default to match `remark-gfm`:

```ts
gfm({ singleTilde: false });
```

Disabling it requires the less ambiguous `~~double tilde~~` form.

Footnotes are rejected with a clear build error for now. Their generated
document-level section can escape Drever's protected Slide boundaries, so the
plugin will not claim support until footnote output is slide-scoped.

# @drever/plugin-math

Opt-in Markdown math for Drever, implemented with the official `remark-math`
and `rehype-katex` pipeline. TeX is rendered during compilation to accessible
HTML + MathML, so no KaTeX JavaScript ships to the browser. KaTeX CSS and fonts
are bundled by Vite from npm; the plugin uses no CDN.

```ts
import { defineConfig } from "drever";
import { math } from "@drever/plugin-math";

export default defineConfig({
  plugins: [math({ strict: "warn", throwOnError: true })],
});
```

Then use `$E = mc^2$` for inline math or `$$...$$` for display math.
`trust` is fixed to `false`; it is intentionally not exposed as project
configuration.

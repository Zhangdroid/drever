# @drever/plugin-shiki

Official build-time syntax highlighting for Drever. It uses
`@shikijs/rehype`, emits dual-theme HAST during MDX compilation, and adds no
syntax-highlighter JavaScript to the presentation runtime.

Shiki is a default-enabled plugin candidate in the Drever CLI. Override its
typed options, or disable it, without touching Vite:

```ts
import { defineConfig } from "drever";
import shikiPlugin, { shiki } from "@drever/plugin-shiki";

export default defineConfig({
  plugins: [
    shiki({ lightTheme: "vitesse-light", darkTheme: "vitesse-dark" }),
    { plugin: shikiPlugin, enabled: false },
  ],
});
```

Use only one of the two entries above. The first configures the default; the
second disables it. Fenced code language identifiers are passed to Shiki.

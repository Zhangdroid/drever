# @drever/plugin-tailwindcss

Official Tailwind CSS v4 support for Drever. The plugin contributes the
first-party `@tailwindcss/vite` integration and a derived stylesheet under
`.drever/cache` whose `source(...)` points at the deck project, not Drever's
generated temporary Vite application. Presentation authors never edit
`vite.config.ts`.

Drever's active theme remains the visual baseline. This integration imports
Tailwind's design tokens and utilities, but intentionally omits Preflight so a
CSS reset cannot replace the theme's heading, paragraph, or list styles.

Tailwind CSS is a default-enabled plugin candidate. Override or disable it in
`drever.config.ts`:

```ts
import { defineConfig } from "drever";
import tailwindCssPlugin, { tailwindCss } from "@drever/plugin-tailwindcss";

export default defineConfig({
  plugins: [tailwindCss({ optimize: true })],
  // To disable instead: plugins: [{ plugin: tailwindCssPlugin, enabled: false }],
});
```

Class names must appear as complete strings in MDX or project components so
Tailwind's source detector can find them.

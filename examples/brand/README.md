# Drever brand specimen

This example is a living reference for the Drever identity. It demonstrates the public brand
package across logo usage, color, typography, geometry, iconography, motion, and light/dark modes.
Its compositions demonstrate the Stage / Signal / Shift grammar defined in the design-system
documentation.

```sh
pnpm --filter @drever/example-brand dev
```

The page intentionally depends only on `@drever/brand` and Vite. It imports the package's public
font, token, and SVG asset exports so changes to the shared identity are visible here immediately.

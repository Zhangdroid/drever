# `@drever/brand`

Canonical Drever brand primitives with no runtime dependencies.

The package deliberately contains tokens, two self-hosted variable font families, and static SVG assets—not React components, resets, or theme semantics. Documentation surfaces can consume the complete system. Presentation themes can map only the primitives that fit their own visual voice.

The canonical **Break Frame** mark turns Drever's MDX `---` boundary into the
next slide frame: authored source becoming a visual stage.

## Use

```ts
import { brandTokens } from "@drever/brand";
import "@drever/brand/fonts.css";
import "@drever/brand/tokens.css";
```

```ts
import lockupUrl from "@drever/brand/assets/drever-lockup.svg";

document.querySelector("img")!.src = lockupUrl;
```

The JavaScript export contains the same CSS-ready values as the custom properties:

```ts
brandTokens.color.ink; // "#19172B"
brandTokens.color.signal; // "#C7F03A"
brandTokens.color.continuity; // "#5B45D8"
brandTokens.material.irisGlass.blur; // "1.125rem"
brandTokens.material.irisGlass.surfaceOpacity; // "0.72"
brandTokens.motion.duration.standard; // "320ms"
```

The Iris Glass material tokens define blur, saturation, and opacity tiers for
floating product chrome. Each product maps those primitives to its own light or
dark semantic gradient; the brand package does not install global surface
styles.

`tokens.json` follows the stable Design Tokens Community Group 2025.10 format. It is the source of truth for `tokens.css` and `src/generated-tokens.ts`.

```sh
vp run -F @drever/brand generate
```

Commit generated outputs with their source change. Package checks fail when either output is stale.

## Asset choice

- `drever-mark.svg`: canonical full-color mark for light surfaces.
- `drever-mark-dark.svg`: canonical mark for dark surfaces.
- `drever-mark-mono.svg`: `currentColor` mark for single-color contexts.
- `drever-lockup.svg`: outlined horizontal lockup for light surfaces.
- `drever-lockup-dark.svg`: outlined horizontal lockup for dark surfaces.
- `favicon.svg`: optically adjusted compact mark.

See `docs/design-system.md` in the Drever repository for usage rules and the design rationale.

Instrument Sans is sourced from the official repository at commit
`7fa22308a3d0c94ee2b3cd537a1196b65db34a3e`. The bundled variable webfont is
unmodified. The lockup converts a `650` weight, `100` width wordmark to direct
SVG outlines so logo rendering never depends on font loading.

Bricolage Grotesque version 9 is sourced from the official Google Fonts build
and used only for expressive display typography. Instrument Sans remains the
body and product UI family. The lockup preserves the outlined Instrument Sans
wordmark so it renders without a font request.

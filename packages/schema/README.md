# @drever/schema

Serializable, dependency-light contracts shared across Drever's compiler,
adapters, and browser runtime. Use this package when a tool needs Drever data
types without importing executable compiler or React code.

```ts
import { DECK_MANIFEST_VERSION, type DeckManifest } from "@drever/schema";

const manifest: DeckManifest = {
  version: DECK_MANIFEST_VERSION,
  slides: [
    {
      id: "slide-1",
      index: 0,
      title: "A trustworthy artifact",
      speakerNotes: [
        {
          format: "markdown",
          plainText: "Remember the key result.",
          value: "Remember the **key result**.",
        },
      ],
      stepStops: [1, 3],
    },
  ],
};
```

`speakerNotes[].value` preserves the authored Markdown, while `plainText` is a
compile-time readable projection for lightweight speaker interfaces. Both are
immutable serializable data; they never contain React nodes or compiler ASTs.
`title` is optional additive metadata inferred from the first static Markdown
heading, a static native `h1`–`h6` passed to a layout slot, or the first
top-level MDX element's static `aria-label`, `title`, `heading`, or `label` prop
when the slide has no usable heading.

`DeckPreflightReportV2` is the current emitted report and combines source and
optional rendered diagnostics without introducing a second diagnostic
vocabulary. When `drever check --rendered` runs, its receipt records
`RENDERED_PREFLIGHT_VERSION`, `RENDERED_PREFLIGHT_RULESET_VERSION`, the
configured canvas, `chromium` engine, optional browser version, captured state
count, status, and any explicit source-skip, browser, or runtime failure reason.

`DeckPreflightReportV1` models the legacy source-only artifact, while
`DeckPreflightReport` is the safe V1-or-V2 union. Consumers should narrow on the
root `version` before reading `rendered`; a V1 report never proves rendered
inspection.

`DreverAuthoringContextV2` is the current context and pairs with the V2
preflight report. `DreverAuthoringContextV1` retains the prior source-only
shape, while `DreverAuthoringContext` is the corresponding versioned union.

The package includes Deck IR, compile-plan, manifest, extension, diagnostic,
source-location, and JSON-safe value contracts. Contracts are versioned so
producers and consumers can reject incompatible artifacts explicitly.

## Status

Drever is pre-1.0. The API is under active development and is not yet stable
for production use.

For the overall architecture, roadmap, and development setup, see the Drever
main project repository.

# @drever/core

React authoring and rendering primitives for Drever presentations. This package
is for component authors, theme/plugin runtime code, and renderers that consume
compiled Drever MDX.

```tsx
import { Slide, Step } from "@drever/core";

export function ExampleSlide() {
  return (
    <Slide id="slide-1" index={0} currentStep={1}>
      <h1>One clear idea</h1>
      <Step at={1}>Reveal supporting detail</Step>
    </Slide>
  );
}
```

Exports include `MDXRenderer`, the protected component registry, `Slide`,
`Step`, `Note`, `MotionGroup`, and slide-state context. The runtime targets
React Canary and current browsers; it intentionally uses React `Activity` for
inactive slide state and effect lifecycle.

Components with media, network work, or global listeners should call
`useDreverRenderMode()`. It returns `audience`, `speaker-current`, or
`speaker-next`, allowing a component to stay visually representative while
suppressing side effects in speaker previews.

## Status

Version `0.0.0` is part of Drever's from-first-principles rewrite. The API is
under active development and is not yet stable for production use.

For the overall architecture, MDX conventions, and development setup, see the
Drever main project repository.

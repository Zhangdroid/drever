# Drever motion stories

This public showcase demonstrates motion as part of a presentation argument,
not as a catalog of effects. Its seventeen slides follow recurring objects
through useful lifecycles: anticipation, evidence, interaction, context, and
retirement.

The opening sequence carries one browser from below the canvas into the center
of the story, then docks it as quiet context while the conclusion takes focus.
Later examples cover semantic word changes, genuine reveal, comparison,
causality, data, spatial interaction, subject-led backgrounds, reduced motion,
and stillness.

The live components are original examples. One data scene deliberately embeds
Motion for React to demonstrate the integration boundary; the remaining
treatments use local React and CSS. React Bits, Spline, and Rive are linked as
optional specialist vocabularies rather than copied into Drever. A real
integration should verify its current license, load only while needed, stop
when hidden, preserve accessible DOM meaning, and provide deterministic
reduced-motion and export states.

The browser-geometry regression fixtures that previously occupied this example
now live in `examples/motion-contracts`.

## Run

```sh
vp run -r build
vp run -F @drever/example-motion-recipes dev
```

Open <http://localhost:4322>.

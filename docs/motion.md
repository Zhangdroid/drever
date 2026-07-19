# Motion choreography

Drever motion describes why a visual change exists. Authors choose one of five
semantic intents; the active theme decides how that intent looks. Navigation,
Step state, accessibility, and shared identity remain framework-owned.

`MotionGroup` is built into compiled MDX. Its `intent` is required:

| Intent       | Narrative job                                       | Authoring shape                           |
| ------------ | --------------------------------------------------- | ----------------------------------------- |
| `focus`      | Emphasize the current point while retaining context | Direct `Step` children                    |
| `replace`    | Exchange one state for another in a stable frame    | Direct `Step` children                    |
| `compare`    | Add evidence that must remain readable together     | Direct `Step` children                    |
| `stagger`    | Reveal up to four parts as one explanatory beat     | Inside one `Step`; direct visual children |
| `continuity` | Carry one object across adjacent slides             | One explicit shared `name`                |

Use motion only when it explains a state change. Ordinary `Step` elements are
the right default for progressive disclosure.

## Step choreography

`focus`, `replace`, and `compare` operate on direct `Step` children. Keep the
slide title and other persistent context outside the group so Step navigation
cannot move them.

### Focus

Use `focus` when prior points should remain available but the newest point must
be unmistakable:

```mdx
## Three decisions

<MotionGroup intent="focus">
  <Step>Compile the deck once.</Step>
  <Step>Address every meaningful state.</Step>
  <Step>Ship the same artifact you tested.</Step>
</MotionGroup>
```

Completed Steps stay visible and accessible. The theme reduces their emphasis
while the active Step receives focus. Pending Steps retain layout space but are
hidden and removed from interaction and the accessibility tree.

### Replace

Use `replace` for successive versions of one model, claim, or artifact:

```mdx
## One frame, three states

<MotionGroup intent="replace">
  <Step>
    <StateCard state="assumption" />
  </Step>
  <Step>
    <StateCard state="evidence" />
  </Step>
  <Step>
    <StateCard state="decision" />
  </Step>
</MotionGroup>
```

In audience, speaker, and export surfaces, the direct Steps occupy the same grid
area. Hidden states still participate in layout sizing, so the frame is sized
by its authored contents instead of changing on every stop. Only the active
replacement is exposed to assistive technology or interaction; pending and
completed replacements are `aria-hidden`, inert, and visually hidden. Before
the first Step, the reserved frame is empty.

The `/document` surface is deliberately different: it expands every
replacement in authored order. Completed and active Steps return to normal
readable flow and remain exposed to search, selection, and assistive
technology.

### Compare

Use `compare` when each revealed item must remain readable as a peer:

```mdx
## Before and after

<MotionGroup className="comparison" intent="compare">
  <Step>
    <ResultCard label="Before" />
  </Step>
  <Step>
    <ResultCard label="After" />
  </Step>
</MotionGroup>
```

Completed Steps stay visible and accessible. The theme distinguishes the newest
evidence without changing the comparison's meaning. `MotionGroup` does not
choose columns or another composition; use a theme layout or a small authored
class for that visual relationship.

### Stagger

Use `stagger` when a short sequence belongs to one audience decision, not four
navigation states. Put the group inside one `Step` and give it no more than four
direct visual children:

```mdx
<Step>
  <MotionGroup className="pipeline" intent="stagger">
    <Stage>Parse</Stage>
    <Stage>Compile</Stage>
    <Stage>Verify</Stage>
    <Stage>Ship</Stage>
  </MotionGroup>
</Step>
```

One advance reveals the complete group. The theme applies a short, bounded
delay between its direct children; stagger never creates hidden Step stops or
changes the URL contract. If the audience needs to discuss an item separately,
author separate Steps and use `focus` instead.

## Continuity across slides

Continuity is explicit shared identity. Give the same lowercase kebab-case
`name` to the same visual object on two adjacent slides:

```mdx
## Authored source

<MotionGroup intent="continuity" name="deck-contract">
  <ContractCard stage="source" />
</MotionGroup>

---

## Compiled artifact

<MotionGroup intent="continuity" name="deck-contract">
  <ContractCard stage="compiled" />
</MotionGroup>
```

The name becomes a framework-prefixed View Transition identity. It must start
with a lowercase letter and contain only lowercase letters, digits, and single
kebab separators. A continuity name must be unique on the active slide. Reuse
it only when the object is narratively the same, and only across adjacent
slides; Drever never infers continuity from matching titles, text, or DOM
position.

`name` is required for `continuity` and invalid for every other intent. A
missing or unknown intent and an invalid identity both fail immediately with
stable structured runtime errors.

### Stable snapshot geometry

A View Transition moves, resizes, and blends captured images. It does not
re-layout every descendant during the animation. If one continuity boundary
changes aspect ratio while also replacing text, the browser scales the glyphs
inside that image; the result can look like zooming, doubled text, or a ghost
frame even though both endpoint layouts are correct.

Choose the smallest boundary that has persistent narrative identity, then keep
its captured geometry deliberate:

- Give both endpoints the same `box-sizing`, explicit inline and block size, or
  at least the same aspect ratio. A fixed shell that only changes position is
  the most reliable default.
- Keep changing prose, badges, and annotations outside the shared bitmap. If a
  shell and persistent child genuinely need different motion, give them
  separate continuity names instead of capturing one large subtree.
- For shared text, keep the string, font, weight, line height, letter spacing,
  and wrapping width invariant. Use `inline-size: fit-content` for a short
  non-wrapping label; use an explicit inline size when wrapping is intentional.
- Give media intrinsic `width` and `height`, a stable `aspect-ratio`, and an
  explicit `object-fit` and `object-position`. Style its transition images when
  the crop must remain stable while the containing box changes shape.
- Put padding on the stable shell rather than on a separately scaled text
  boundary. Mixed fixed padding and scaled glyph metrics rarely align.

Absolute positioning is useful when it gives both states the same containing
block. Use a fixed `position: relative` shell and `position: absolute; inset: 0`
layers for replacement content. Switching only one endpoint from normal flow
to absolute positioning can change a text box from full width to shrink-wrapped
width and make the transition less stable.

#### Fixed shared shell

Keep the object inside the continuity boundary identical. State-specific copy
belongs beside it:

```mdx
<div className="contract-layout">
  <MotionGroup className="contract-shell" intent="continuity" name="deck-contract">
    <article>
      <small>Authored source</small>
      <strong>MDX</strong>
    </article>
  </MotionGroup>
  <aside>Routes, notes, and diagnostics are the new context.</aside>
</div>
```

```css
.contract-shell {
  inline-size: 30rem;
  block-size: 18rem;
  box-sizing: border-box;
}

.contract-shell > article {
  inline-size: 100%;
  block-size: 100%;
  box-sizing: border-box;
  overflow: clip;
}
```

Use the same shell dimensions and child typography on the adjacent slide. Let
layout move the shell; do not resize it to fit the new explanation.

#### Persistent text identity

Share text only when it is actually the same text:

```css
.shared-label {
  inline-size: fit-content;
  white-space: nowrap;
  font: 700 2rem/1.1 var(--deck-heading-font);
  letter-spacing: -0.02em;
}
```

If the text changes, treat the new copy as enter/exit content or keep it outside
the continuity group. Matching a transition name does not make different glyph
shapes a stable identity.

#### Media with a deliberate crop

```mdx
<MotionGroup className="product-shot" intent="continuity" name="product-shot">
  <img src="./product.svg" alt="Product overview" width="1600" height="900" />
</MotionGroup>
```

```css
.product-shot {
  aspect-ratio: 16 / 9;
  overflow: clip;
}

.product-shot > img {
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
  object-position: 50% 42%;
}

::view-transition-old(drever-product-shot),
::view-transition-new(drever-product-shot) {
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
  object-position: 50% 42%;
  overflow: clip;
}
```

For nested persistent boundaries, modern Chromium can preserve parent clipping
with `view-transition-group: contain` on the parent and
`::view-transition-group-children(...) { overflow: clip; }`. Use it only when
the parent and child truly need independent motion identities.

These rules follow the browser's snapshot model described by the
[CSS View Transitions specification](https://www.w3.org/TR/css-view-transitions-1/),
the [Chrome same-document guide](https://developer.chrome.com/docs/web-platform/view-transitions/same-document),
and the detailed
[aspect-ratio walkthrough](https://jakearchibald.com/2024/view-transitions-handling-aspect-ratio-changes/).
The complete runnable versions are in the
[`motion-recipes` example](../examples/motion-recipes/README.md).

## Runtime and accessibility contract

The audience viewer lets React own the native document View Transition and
activates only explicit slide and continuity boundaries. The document root does
not animate, so the surrounding stage remains visually stable. Step recipes run
on the live DOM instead of captured bitmaps; persistent titles and surrounding
content therefore never receive duplicate transition snapshots.

Native capture is audience-only. Speaker previews and PDF export retain the
stable-frame replacement semantics but disable animation and View Transition
names. The document view also disables presentation motion, then expands all
replacement states into its reading flow. Reduced-motion preference, or the
`createViewer` reduced-motion option, follows the same navigation and state
path without presentation animation.

Core owns `Step` visibility, replacement accessibility, intent attributes,
React transition boundaries, and continuity identity. The client owns the
Navigation-to-React commit and navigation direction. Themes own the visual
mapping: duration, easing, emphasis, displacement, and the intentional
reduced-motion result. A theme's `motion` field is JSON-safe
metadata containing `id`, supported `intents`, and optional author guidance; it
does not load a JavaScript motion module and there is no separate
`runtime.motion` value.

## Author checklist

- Start with ordinary Steps; add a MotionGroup only for a clear narrative job.
- Keep persistent headings and context outside Step-oriented MotionGroups.
- Use direct Step children for `focus`, `replace`, and `compare`.
- Put `stagger` inside one Step and limit it to four direct children.
- Use `replace` when one state should be accessible at a time while presenting;
  expect the document view to expose the complete replacement history.
- Reuse a continuity name only for the same object on adjacent slides.
- Keep continuity geometry, text metrics, and media crop explicit at both endpoints.
- Keep changing prose outside a shared snapshot; split independent identities into separate boundaries.
- Inspect forward and backward movement at every affected route.
- Verify reduced motion, `/speaker`, `/document`, and export after changing
  choreography.

## Compact AI prompt

```text
Use Drever motion semantically. Prefer ordinary Step for disclosure. Use a
MotionGroup with direct Step children for focus (retain context), replace (one
accessible state in a stable presentation frame; the document view expands all
states), or compare (retain readable peers). Put a stagger MotionGroup inside
one Step and use at most four direct children. Use continuity only for the same
object on adjacent slides and give both groups the same unique lowercase
kebab-case name. Keep its endpoint size, aspect ratio, typography, wrapping,
and media crop explicit; keep changing copy outside the shared snapshot. Keep
persistent titles outside Step motion groups. Do not invent animation props,
hidden Step stops, runtime.motion, or View Transition calls. Check
forward/backward, reduced-motion, speaker, document, and export states.
```

# Motion choreography

Drever motion separates narrative purpose, logical progression, and visual
voice. `intent` says why a visual change exists, optional `flow` identifies the
logical axis that carries it, and the active theme decides how that
relationship moves.
Navigation, Step state, accessibility, and shared identity remain
framework-owned.

## Non-negotiable motion principles

These principles are normative for every official deck, example, generated
deck, and review Skill:

1. **Explain, do not decorate.** Motion must clarify focus, order,
   replacement, comparison, continuity, or a real Stage state change. If it
   does not improve audience understanding, omit it. Motion cannot rescue an
   abstract slogan or missing argument; establish the concrete claim, evidence,
   and decision first.
2. **Budget attention, not effects.** Give each moment one primary motion. Add
   at most one quieter supporting cue, and only when it belongs to the same
   causal chain. Native transitions, Steps, kinetic type, video, 3D, and
   third-party animation all spend the same budget. If a headline or core
   object already carries the change, keep Stage decoration and neighboring
   cards still. A recurring decorative object does not earn motion merely by
   recurring. A slide may contain several techniques only when they form a
   sequence with one focal object at a time.
3. **Follow the content and theme.** Direction follows reading order and layout:
   vertical stacks progress on the block axis; horizontal pipelines progress
   on the inline axis. The theme supplies the visual voice. A sparse draw-on
   emphasis, short signal travel, or small Stage shift may add quiet contextual
   delight, but it must reinforce the current idea and remain subordinate to
   reading. Quiet does not mean imperceptible: the cue must still communicate
   its job at presentation distance. Repeated generic entrances are not a
   visual voice. Give the deck one theme-led whole-slide transition voice:
   directional travel only when space matters, a reading-edge reveal for
   editorial progression, a precise state commit for technical work, or a
   quiet fade when the page change is not the subject. Do not randomize
   transitions slide by slide.
4. **Move the smallest meaningful object.** Persistent titles, layout anchors,
   Stage shells, backgrounds, page numbers, branding, dialogs, and audience
   controls stay live and stationary. Animate only the child whose narrative
   state changed and only the properties that express that change. A draw-on
   highlight does not also need to recolor its type or move an unrelated accent.
5. **Keep geometry deliberate.** Stable objects need stable size, aspect ratio,
   typography, wrapping, and media crop. Recurring motifs retain their
   thickness, opacity, paint, orientation, and cross-axis alignment. Animate
   only the axis or property that changed; never stretch text, boxes, lines, or
   shadows to fake continuity. A transition must not create layout shift, title
   drift, scaled glyphs, or a ghost frame.
6. **Treat painted surfaces as indivisible.** Never hard-clip a card, panel, or
   media frame when its shadow, glow, outline, or filter must remain visible.
   Clip an inner content wrapper, or use opacity with translate or scale. Shadow
   endpoints use matching lists and transparent colors, never `none` to opaque.
7. **Pace for comprehension.** Preserve an initial state long enough for the
   audience to orient and read when the motion depends on noticing a before
   state. Choose delay and duration from that reading job and narrative beat,
   not from a blanket one-second rule. Do not let first-paint motion finish
   before the room can perceive it.
8. **Review the journey, not only the endpoints.** Inspect intermediate frames,
   transition completion, forward and backward navigation, repeated Step
   changes, pointer focus, reduced motion, speaker, document, and export modes.

For a keynote-style card wall or other breadth montage, author a fixed,
non-linear reveal order so the composition can feel organic without becoming
runtime-random. Keep labels terse, give the wall one collective claim, and
provide a complete deterministic reduced-motion and export state.

The rest of this document defines the primitives and implementation details
that satisfy those principles.

`MotionGroup` is built into compiled MDX. Its `intent` is required:

| Intent       | Narrative job                                       | Authoring shape                           |
| ------------ | --------------------------------------------------- | ----------------------------------------- |
| `focus`      | Emphasize the current point while retaining context | Direct `Step` children                    |
| `replace`    | Exchange one state for another in a stable frame    | Direct `Step` children                    |
| `compare`    | Add evidence that must remain readable together     | Direct `Step` children                    |
| `stagger`    | Reveal up to four parts as one explanatory beat     | Inside one `Step`; direct visual children |
| `continuity` | Carry one object across adjacent slides             | One explicit shared `name`                |

For `focus`, `replace`, `compare`, and `stagger`, add `flow="block"` when the
content follows a vertical reading order or `flow="inline"` for a horizontal
pipeline, comparison, or successive state. `flow` does not create a layout or
prescribe animation parameters; it gives the theme enough structural meaning
to choose a fitting direction and rhythm. Omit it when the theme's default is
appropriate.
`continuity` rejects `flow` because shared-object motion comes from the two
authored layouts instead of a reveal direction.

Official themes have distinct motion voices. Basic favors unadorned fades and
short travel; Editorial fades through a subtle reading-edge cue; Studio uses a
brief, precise state commit; Fieldnote follows writing order;
Atlas advances along a declared route; Ledger preserves row and column
alignment; Cinema uses stable cuts and restrained dissolves; Construct adds one
meaningful part at a time. These mappings stay theme-owned; authors never
select the underlying effect.

Use motion only when it explains a state change. Ordinary `Step` elements are
the right default for progressive disclosure.

## Plan an object's narrative lifecycle

Design a key object's complete role in the story instead of assigning an
entrance effect independently on every slide. A useful lifecycle may be:

1. **Anticipate:** the object may begin completely outside the canvas when its
   absence helps the audience form a question. Reveal a fragment only when that
   fragment itself communicates useful anticipation; never leave a meaningless
   clipped sliver on stage.
2. **Enter as evidence:** bring the complete object into a stable, readable
   position when the presentation needs to inspect or interact with it.
3. **Recontextualize:** move the same object to a quiet edge or corner, reduce
   its contrast, and retain it as spatial context while the explanation takes
   focus.
4. **Retire:** remove it once it no longer helps the audience understand the
   next claim.

This is not a required four-effect sequence. Author only the beats that advance
the argument. For example, a browser frame can begin completely below the
canvas, enter to demonstrate a workflow, then dock at low contrast while the next slide
explains the decision revealed by that workflow. The movement explains the
object's changing narrative role; it is not decoration.

Keep the object recognizable throughout the lifecycle. Give it stable internal
geometry and one motion owner. Use native View Transition continuity for
navigation between authored layouts; use local live-DOM motion for interaction
inside one slide. Do not make both systems transform the same element at the
same time.

## External motion and spatial tools

React components can integrate focused motion capabilities without turning
Drever into an effect catalog. Prefer native CSS, Drever primitives, and small
local React components for simple reveals and transitions. When the story needs
a focused capability, use this non-exhaustive list as optional starting points:

- **Technique and component references:**
  [React Bits](https://reactbits.dev/get-started/).
- **General animation runtimes:** [Motion](https://motion.dev/docs/react) and
  [GSAP](https://gsap.com/docs/v3/).
- **Spatial and 3D:**
  [Spline](https://docs.spline.design/exporting-your-scene/web/exporting-as-code),
  [Three.js](https://threejs.org/docs/), and
  [React Three Fiber](https://r3f.docs.pmnd.rs/getting-started/introduction).
- **Vector and state animation:**
  [Rive](https://rive.app/docs/runtimes/react/react) and
  [Lottie](https://lottie.airbnb.tech/).

These projects are examples, not Drever dependencies, defaults, endorsements,
or partnerships. Choose by capability rather than name.

Add an external dependency only when its capability is disproportionately
useful. Before copying code, importing an asset, or shipping a runtime, inspect
the current official documentation, source, license, bundle behavior, and
export constraints. Treat outside work as evidence and capability, not a style
catalog: adapt the technique to the deck's subject-led visual system instead of
copying a demo unchanged.

Every integration must be presentation-safe:

- expose the final meaning as accessible text or semantics, with keyboard
  operation for interaction;
- commit the same understandable final state immediately under reduced motion;
- load deterministically and participate in export readiness;
- provide a stable poster, still, or authored fallback for document and export
  surfaces when live rendering is inappropriate;
- bound continuously animated backgrounds and 3D scenes so they remain
  subordinate to the current claim;
- avoid nested slide-navigation transitions and never hide required content
  behind animation completion.

When a deck claims an external animation or spatial capability, prove it with a
focused working example instead of a library name, logo, or link. Let the
external tool own only the smallest boundary that needs its capability; Drever
continues to own navigation, history, notes, and delivery.

Run continuous or repeating motion only when ongoing change is itself the
subject, such as a live metric or signal moving through a network. Use a
deterministic sequence, pause it when its audience surface is inactive, and
provide one intentional final state for reduced motion, document, speaker, and
export output. Do not loop decoration to keep a slide looking alive.

## Timing and interaction ownership

When a local cue depends on an initial state, let that state settle before
directing the eye. The appropriate hold may be shorter or longer than one second;
derive it from the amount of reading, the transition that preceded it, and the
importance of the change. Give the final state enough time to be understood.

Animate one semantic payload at a time. If a marker draws under one word, keep
unrelated type, accents, and Stage decoration still. A complex showcase may
demonstrate several techniques, but serialize them into one causal story instead
of presenting competing simultaneous focal points.

If the presenter advances a narrative state, author that change as a `Step`.
Do not add a button inside the slide merely to reveal the next authored finding,
comparison, or spatial state. Keep an inline control only when direct
manipulation is itself what the audience must understand.

## Markers, live data, and motion envelopes

Give every moving indicator one unmistakable role. A cursor or focus reticle
communicates agency or directed attention: give it a recognizable pointer or
target shape, define its hotspot, and land that hotspot exactly on a meaningful
target. A route signal communicates state, causality, or data flow: keep it
centered on the path instead of making it resemble a pointer. Never use an
ambiguous floating dot for both jobs. Decorative indicators are `aria-hidden`
and ignore pointer input.

Keep the route, milestones, and moving marker in one `position: relative`
wrapper. Derive stops from that local grid, percentages, or an `offset-path`;
use `border-box` geometry and align the cursor hotspot or signal center to each
anchor. Do not animate with pixel distances measured from another container.
The final route state must reach its authored endpoint at every supported
canvas size.

Tie live metrics and repeating data motion to the active audience lifecycle.
Start the first meaningful update when the slide becomes active instead of
waiting through a complete interval, and cancel timers or animation frames when
it deactivates. Drive the number, label, chart, and related marks from the same
deterministic frame. Keep numeric width stable with tabular figures or a fixed
slot, expose one stable accessible summary instead of announcing every frame,
and render the intentional final state immediately in reduced-motion,
document, speaker, and export surfaces.

Reserve layout for the largest painted and transformed footprint across the
whole sequence, not only the resting frame. An exploded 3D object, translated
layer, shadow, or glow must never cross a track, label, or adjacent copy at its
maximum extent. Inspect the peak intermediate state with rendered bounds;
clipping overflow is not a substitute for providing enough space.

Keep decorative background nodes clearly subordinate: use lower contrast,
small travel, and slow asynchronous pulses. They must not look like the active
cursor or route signal.

## Step choreography

`focus`, `replace`, and `compare` operate on direct `Step` children. Keep the
slide title and other persistent context outside the group so Step navigation
cannot move them.

### Surface-aware reveals

Treat cards, panels, media frames, and other elements with shadows, glows, or
outlines as complete painted surfaces. A `clip-path` on the surface or any
ancestor is a hard paint boundary: even `inset(0)` clips overflow, and returning
to `none` when an animation finishes can make the missing effect appear in one
frame. Do not apply a reading-edge clip to these boundaries unless losing that
overflow is intentional.

Prefer opacity with `translate` or `scale` on the outer surface. If its copy
needs a directional wipe, put that copy in an inner wrapper and clip only the
inner content; keep the outer border, radius, and shadow un-clipped. When
elevation changes, give every endpoint the same `box-shadow` list: preserve the
number of shadows, `inset` mode, offsets, blur, and spread, then make the
starting colors transparent. Interpolate alpha instead of switching between
`none` and an opaque or multi-layer shadow. Inspect intermediate frames because
correct endpoints do not expose paint clipping during the animation.

### Focus

Use `focus` when prior points should remain available but the newest point must
be unmistakable:

```mdx
## Three decisions

<MotionGroup intent="focus" flow="block">
  <Step>Compile the deck once.</Step>
  <Step>Address every meaningful state.</Step>
  <Step>Ship the same artifact you tested.</Step>
</MotionGroup>
```

Completed Steps stay visible and accessible. The theme gives the active Step a
non-destructive marker or surface treatment; it must not lower the opacity of a
whole completed Step because that can make nested text, links, and controls fail
contrast. Pending Steps retain layout space but are hidden and removed from
interaction and the accessibility tree.

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

<MotionGroup className="comparison" intent="compare" flow="inline">
  <Step>
    <ResultCard label="Before" />
  </Step>
  <Step>
    <ResultCard label="After" />
  </Step>
</MotionGroup>
```

Completed Steps stay visible and accessible. The theme distinguishes the newest
evidence without changing the comparison's meaning or reducing peer evidence
below its normal readable contrast. `MotionGroup` does not
choose columns or another composition; use a theme layout or a small authored
class for that visual relationship.

### Stagger

Use `stagger` when a short sequence belongs to one audience decision, not four
navigation states. Put the group inside one `Step` and give it no more than four
direct visual children:

```mdx
<Step>
  <MotionGroup className="pipeline" intent="stagger" flow="inline">
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

Continuity is an explicit shared correspondence. Give the same lowercase
kebab-case `name` to the related visual boundary on two adjacent slides:

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
kebab separators. A continuity name must be unique on the active slide. Carry
clear correspondence, not arbitrary resemblance: reuse it across adjacent
slides when the same object persists or when two objects have a semantic role
or visual structure that makes their relationship immediately legible. A source
artifact may become its compiled result, or a diagram detail may become its
place in a larger system. Matching color, shape, text, or DOM position alone is
not enough, and Drever never infers the relationship. Share the smallest stable
feature that communicates it, and count the handoff as the moment's primary
motion.

`name` is required for `continuity` and invalid for every other intent. `flow`
is invalid for `continuity`. A missing or unknown intent, invalid identity, or
invalid prop combination fails immediately with stable structured runtime
errors.

### Stable snapshot geometry

A View Transition moves, resizes, and blends captured images. It does not
re-layout every descendant during the animation. If one continuity boundary
changes aspect ratio while also replacing text, the browser scales the glyphs
inside that image; the result can look like zooming, doubled text, or a ghost
frame even though both endpoint layouts are correct.

Choose the smallest boundary that carries the persistent object or the clear
correspondence, then keep its captured geometry deliberate:

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

When related wording is itself the narrative change, use a local text effect
after the destination snapshot is captured instead of sharing the changing
glyphs through a View Transition. Rotating, decrypted, mask-reveal, and draw-on
treatments are appropriate only when the strings are semantically linked and
the treatment clarifies that relationship. Reserve one fixed slot, keep its
font metrics and wrapping stable, expose the final copy as accessible text, and
use non-overlapping exit and reveal phases. Never scale or crossfade different
glyph snapshots. Under reduced motion, render the same final copy immediately.

#### Let live DOM own one adjacent handoff

Use `SlideTransition` when a scene needs to animate its live destination DOM
instead of entering through a native snapshot:

```mdx
---

<SlideTransition from="previous" mode="local" />

<div className="evidence-scene">...</div>
```

Place it as a direct child of the target slide. `from="previous"` applies only
when entering from the immediately preceding slide; `from="next"` is the
symmetric form. Non-adjacent jumps and the opposite direction keep their normal
native transition.

The client does not call `startViewTransition` for the declared edge. It exposes
that commit while the target is active so authored CSS can own the handoff:

```css
.drever-deck[data-drever-transition-mode="local"][data-drever-transition-from="previous"]
  [data-slide-state="active"]
  .evidence-scene {
  animation: evidence-arrive 680ms var(--drever-motion-easing) both;
}
```

Use this boundary narrowly. It is appropriate when live kinetic type, canvas,
or another destination-side scene must not pass through a captured bitmap.
Starting a View Transition and immediately skipping it is not equivalent: a
faulty capture frame may already have been presented.

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
The complete geometry fixtures are in the
[`motion-contracts` example](../examples/motion-contracts/README.md). The
story-led [`motion-recipes` example](../examples/motion-recipes/README.md)
shows how those contracts support meaningful choreography.

## Stage motion

Project Stage components separate persistent canvas decoration from the
per-slide transition boundary. The background stays behind the deck; the
foreground can hold restrained branding, a page number, or another fixed visual
reference. Both remain mounted while audience navigation updates their
`StageLayerProps`.

Do not give the complete background or foreground a slide entrance, exit, or
continuity identity. A Stage may provide an occasional quiet surprise—a small
shift in one glow, line, crop, or counter—but it should not demand attention on
every navigation. Isolate that smallest changing sub-element, keep its geometry
explicit, and leave unchanged Stage pixels stationary. Stage motion must yield
to stronger content motion: reduce or omit it when a reveal, replacement, or
continuity transition carries the idea. Read `reducedMotion` and `renderMode`
from the layer props or `useStage()` and suppress motion in speaker, document,
and export surfaces.

A recurring line or band keeps the same thickness, opacity, color treatment,
orientation, and cross-axis alignment. Translate it along its logical axis or
reveal its length through an inner mask; do not resize its container or scale
both axes. If it does not change, leave it completely still.

## Runtime and accessibility contract

The audience viewer starts the native View Transition on the document and
commits the corresponding React state inside its update callback. CSS excludes
the document root, then captures the named deck and explicit continuity
identities. The Stage background stays live; non-empty foreground, focus, and
command-bar surfaces receive stable named groups above the deck. The transition
overlay ignores pointer input, although those short-lived visuals remain
snapshots until the document transition finishes. Step recipes run on the live
DOM instead of captured images; persistent titles and surrounding content
therefore never receive duplicate transition snapshots.

Native capture is audience-only. Speaker previews and PDF export retain the
stable-frame replacement semantics but disable animation and View Transition
names. The document view also disables presentation motion, then expands all
replacement states into its reading flow. Reduced-motion preference, or the
`createViewer` reduced-motion option, follows the same navigation and state
path without presentation animation.

Core owns `Step` visibility, replacement accessibility, intent and flow
attributes, and continuity identity. The client owns named document capture, the
Navigation-to-React commit, and navigation direction. Themes own the visual
mapping: duration, easing, emphasis, displacement, and the intentional
reduced-motion result. A theme's `motion` field is JSON-safe
metadata containing `id`, supported `intents`, and optional author guidance; it
does not load a JavaScript motion module and there is no separate
`runtime.motion` value.

## Author checklist

- Start with ordinary Steps; add a MotionGroup only for a clear narrative job.
- Ask: What single object should the audience follow? If the answer names two,
  remove or sequence one.
- Plan that object's lifecycle across the story: keep it completely off-stage
  when a visible fragment says nothing, reveal a fragment only for useful
  anticipation, enter it as evidence, dock it at low contrast when it becomes
  context, and retire it when it stops explaining the claim.
- Count native transitions, Steps, kinetic type, video, 3D, and third-party
  animation against one attention budget.
- Establish a concrete claim, evidence, and decision before adding motion.
- Let the initial state settle when the audience must notice it, then choose
  timing from the reading job instead of applying a fixed delay.
- Animate only the properties that carry the change. Keep quiet cues
  perceptible and serialize multiple techniques around one focal object.
- Keep persistent headings and context outside Step-oriented MotionGroups.
- Keep shadows, glows, and other overflow effects outside hard clip reveals;
  interpolate matching transparent and opaque shadow lists.
- Use `flow="block"` for vertical reading order and `flow="inline"` for a
  horizontal pipeline or comparison; omit it when the theme default fits.
- Keep global backgrounds, branding, and page numbers in Stage layers. Animate
  only a Stage sub-element whose visual state changes, and let it yield to
  stronger content motion.
- Keep audience controls, dialogs, and other client chrome outside deck content;
  never give them slide or continuity identities. Let the client assign stable
  overlay groups during document transitions.
- Use direct Step children for `focus`, `replace`, and `compare`.
- Use a Step instead of an inline control when presentation navigation owns the
  next narrative state.
- Put `stagger` inside one Step and limit it to four direct children.
- Use `replace` when one state should be accessible at a time while presenting;
  expect the document view to expose the complete replacement history.
- Reuse a continuity name only for the same object on adjacent slides.
- Keep continuity geometry, text metrics, and media crop explicit at both endpoints.
- Keep changing prose outside a shared snapshot; split independent identities into separate boundaries.
- Keep recurring motifs geometrically and visually invariant. Translate a line
  or reveal its length with an inner mask instead of stretching its box.
- Use rotating, decrypted, mask-reveal, or draw-on text only for semantically
  linked copy in one fixed local slot after capture; never share changing glyphs
  through a View Transition.
- Use external tools only for a capability the story needs. Verify current
  official docs and licenses, adapt optional references from the categorized
  list above to the subject-led design, prove the capability with a focused
  working example, and avoid copying a showcase as the deck's style.
- Give every live integration accessible final semantics, keyboard behavior,
  reduced-motion output, deterministic loading and export readiness, plus a
  stable document/export fallback when needed.
- Loop only when ongoing change is the subject. Keep the sequence deterministic,
  pause it outside the active audience surface, and author a stable final state.
- Give a moving marker one role: cursor hotspots land exactly on targets, while
  route signals stay centered on their path. Use one local route coordinate
  system instead of pixel travel measured from another container.
- Start live data on active audience entry, synchronize its number and marks,
  suppress frame-by-frame announcements, and render one stable final state
  elsewhere.
- Reserve the maximum transformed and painted footprint of 2D or 3D motion so
  no intermediate layer crosses a track, label, or adjacent copy.
- Inspect intermediate frames and the finished handoff in both directions at
  every affected route; verify that toolbar hover and focus remain stable.
- Verify reduced motion, `/speaker`, `/document`, and export after changing
  choreography.

## Compact AI prompt

```text
Use Drever motion semantically. Motion must explain a change; if removing it
does not reduce understanding, remove it. Establish a concrete claim, evidence,
and decision before adding choreography; motion cannot rescue abstract copy.
Prefer ordinary Step for disclosure. If presentation navigation owns a reveal,
use a Step instead of an inline button; keep direct controls only when
manipulation itself is the lesson. Use a
MotionGroup with direct Step children for focus (retain context), replace (one
accessible state in a stable presentation frame; the document view expands all
states), or compare (retain readable peers). Put a stagger MotionGroup inside
one Step and use at most four direct children. Intent explains why; optional
flow identifies the logical progression axis; the theme owns the visual voice. Use
flow="block" for vertical reading order and flow="inline" for a horizontal
pipeline or comparison; omit it when the theme default fits. Use continuity
only for the same object on adjacent slides, give both groups the same unique
lowercase kebab-case name, and never give continuity a flow. Give each moment
one primary motion and at most one quieter supporting cue in the same causal
chain. Count native transitions, Steps, kinetic type, video, 3D, and
third-party animation against that one budget. Serialize multiple techniques
around one focal object instead of running competing cues. Plan a key object's
lifecycle instead of isolated entrances: it may begin completely off-stage,
enter as evidence, dock at low contrast as context, then retire when it no
longer explains the claim. Show a fragment only when the fragment itself creates
useful anticipation.
Author only the beats the story needs. When a headline or core object changes,
keep Stage decoration and
neighboring cards still; recurring decoration does not earn motion by recurring.
When the audience must perceive a before state, let it settle before the cue and
choose delay and duration from reading and narrative causality rather than a
blanket one-second rule. Keep quiet motion perceptible. Animate only properties
that express the same semantic change; a draw-on highlight does not need an
unrelated type-color or accent animation.
Keep its endpoint
size, aspect ratio, typography, wrapping, and media crop explicit; keep
changing copy outside the shared snapshot. Keep persistent titles outside Step
motion groups. Treat cards and media frames as complete painted surfaces: keep
shadows and glows outside clip reveals, or clip only an inner content wrapper;
animate matching shadow geometry from transparent colors. Put persistent
canvas decoration and page information in Stage layers; use sparse, quiet
changes on one Stage child and let them yield to stronger content motion. Keep
recurring motifs invariant in thickness, opacity, paint, orientation, and
cross-axis alignment; translate a line or reveal it with an inner mask rather
than stretching it. Carry identity, not resemblance. For semantically linked
copy, use a local fixed-slot rotating, decrypted, mask-reveal, or draw-on effect
after capture; keep text metrics stable and never View-Transition or scale
different glyphs. Treat external work as an optional reference or capability,
never a required dependency or style catalog. Consult the categorized,
non-exhaustive list above only when the story needs a focused capability.
Prefer native CSS and small local React for simple motion; before copying code,
assets, or runtimes, inspect current official docs, source, license, bundle
behavior, and export constraints. Prove a claimed capability with a focused
working example rather than a name or link. Give integrations accessible final semantics,
keyboard behavior, deterministic loading and export readiness, and a stable
document/export fallback when live rendering is inappropriate. Never let native
and local motion transform the same element at once. Under reduced motion,
commit the final state without spatial,
draw, scramble, or decorative delay. Do not put persistent titles, backgrounds,
page numbers, dialogs, or audience controls inside slide transitions. Do not
invent animation props, hidden Step stops, runtime.motion, or native View
Transition calls. Give each moving marker one role: a cursor has a recognizable
hotspot that lands exactly on a target, while a route signal remains centered
on its path. Keep markers and milestones in one local coordinate system; do not
use magic pixel travel from another container. Loop only when ongoing change is
the subject; keep it deterministic, start live data when the audience slide
activates, synchronize numbers and marks, pause it outside the active audience
surface, and author one stable final state. Reserve the largest transformed
footprint of spatial motion so intermediate layers never overlap labels or
tracks. Inspect intermediate frames and the finished handoff in both
directions; check repeated Steps, pointer focus, reduced-motion, speaker,
document, and export states.
```

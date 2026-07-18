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

## Runtime and accessibility contract

The audience viewer captures motion with a native, canvas-scoped View
Transition. Step navigation classifies new Step snapshots by intent; slide
navigation captures explicitly named continuity groups. Persistent titles and
surrounding slide content are not assigned shared identities, which keeps their
geometry stable during a Step change.

Native capture is audience-only. Speaker previews and PDF export retain the
stable-frame replacement semantics but disable animation and View Transition
names. The document view also disables presentation motion, then expands all
replacement states into its reading flow. Reduced-motion preference, or the
`createViewer` reduced-motion option, follows the same navigation and state
path without presentation animation.

Core owns `Step` visibility, replacement accessibility, intent attributes, and
continuity identity. The client owns canvas capture and navigation direction.
Themes own the visual mapping: duration, easing, emphasis, displacement, and
the intentional reduced-motion result. A theme's `motion` field is JSON-safe
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
kebab-case name. Keep persistent titles outside motion groups. Do not invent
animation props, hidden Step stops, runtime.motion, or View Transition calls.
Check forward/backward, reduced-motion, speaker, document, and export states.
```

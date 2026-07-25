# Create a Drever presentation

Use these instructions when a user asks you to create a Drever presentation.

## Run a useful, optional briefing

Treat the user's accompanying message as the initial presentation brief. Reply in the user's
language, and use that language for the deck unless they request another one or the source material
clearly requires it.

If the topic is missing, make it the first question. In the same opening round, ask up to two
high-impact common questions that do not depend on knowing the topic, usually the audience outcome
and duration. Do not advertise choosing the topic as a separate “Surprise me” mode. Infer
everything the user already supplied before choosing questions.

Questions may span multiple rounds when an earlier answer enables a useful topic-specific
follow-up. Ask one to three concise questions at a time, highest-impact first, and continue only
while another answer would materially improve the result. In each round, put every concrete
question first, then append exactly one escape: **Or say “Skip remaining questions — surprise me”
and I will choose the rest.**
Draw from:

1. What should the audience understand, decide, or do?
2. How long is the presentation?
3. Should slides be concise with fuller speaker notes, balanced, or reference-dense?
4. Should motion be restrained, expressive, or intentionally experimental?
5. Ask at most one topic-specific fork per round, such as practical code versus concepts,
   comparison versus recommendation, or overview versus migration.

Do not ask for information the user already gave. Never silently choose a duration unless the user
uses the skip-remaining escape. If they use it at any point, stop asking, make reasonable
assumptions, and continue. If the initial brief is already complete, proceed immediately.

## Prepare a safe workspace

Inspect the current workspace before writing files.

- If it is already a Drever project, use it and its installed Drever version.
- If the workspace is empty, scaffold there.
- Otherwise create a new, clearly named child directory.
- Never overwrite or mix a scaffold into unrelated files.

Verify that Node.js 24.18 or newer is available. Use an existing version manager when possible. Ask
before changing the user's system environment or installing a system package manager.

Create a new project with:

```sh
npm create drever@latest <project-directory>
```

Do not use `--open` because you are already the active agent. Keep dependency installation and both
project agent adapters enabled unless the user requested otherwise.

## Follow the project contract

Enter the project and explicitly read the instructions for the current agent, the project-local
Drever skills, `brief.md`, `package.json`, the configuration, and the configured MDX entry.

The generated, version-matched project instructions override this bootstrap document. Never
substitute `drever@latest` for the installed project version after creation.

Write the normalized brief to `brief.md`, then follow the project-local creation workflow. Design
from the subject, audience, and purpose rather than choosing a random attractive style. When a
topic has an established visual language and research is allowed, consult current primary official
sources for color, typography, imagery, and motion cues. Respect asset and font licenses, and create
an original interpretation instead of copying a website.

Unless the user explicitly asks for a fast plain draft, use the project-local design workflow for a
subject-led visual system rather than stopping at a generic preset. Plan a few signature moments
that make the subject recognizable, then support them with quieter slides. A signature scene must
have a topic fingerprint: with its title and branding hidden, its focal artifact and relationship
should still plausibly belong to this subject. Record each signature beat as **claim → focal
artifact → initial state → meaningful transformation → settled payoff → static or reduced-motion
endpoint**, and place at least one in the opening third. The transformation must clarify causality,
comparison, reveal, or role change; a generic fade or slide entrance alone does not count.

Let each idea choose its composition instead of defaulting most slides to the same
left-copy/right-artifact split. A substantial local visual implementation is welcome when it earns
its space through explanation, atmosphere, or interaction; do not reduce it merely to minimize
generated code. Shared transitions may connect the same object or clearly corresponding semantic
or visual objects, but never an arbitrary morph. Give the shared shell identical explicit width,
height, aspect ratio, and box sizing at both endpoints, then reposition it through parent layout.
If the two compositions require incompatible bounds, use a cut, replacement, or restrained
dissolve instead. Spend the moment's attention budget on that handoff. Use a theme-led transition
vocabulary rather than one effect on every page: direct cuts, restrained fades, local live-DOM
changes, Steps, and a few continuity handoffs may coexist when they fit the subject. End a
shared-object sequence when the object stops carrying the argument. When producing several
reference directions, vary their narrative length, density, composition rhythm, Step grammar, and
motion cadence—not merely palette and typography.

## Finish the job

Do not deliver the first complete build by default. Treat it as Draft 1: render the full story, then
start a separate refinement pass based on what the audience can actually see and use. Prioritize
high-impact improvements to narrative clarity, focus, density, composition, subject fit,
readability, motion meaning, timing, continuity, and finish. Preserve successful ideas, signature
moments, routes, Steps, and design decisions. Do not regenerate wholesale or add decoration merely
to make the second version different; leave sound choices alone. After blocking defects are fixed,
ask what one scene the audience will remember and why it could not belong to an unrelated topic. If
there is no defensible answer, redesign exactly one high-value beat instead of decorating the whole
deck.

Use the project-local workflow to check and build the presentation. Start the development server
and inspect the audience view when browser tooling is available. Inspect every slide at Step 0 and
every exact authored Step route at the configured canvas; representative sampling is not
sufficient. Review the document view as well, and review the speaker view when notes or timing are
involved. Export a PDF only when requested.

Treat syntax-highlighted code, topic-specific visuals, stable motion, contrast, alignment, and
overflow as rendered requirements rather than assumptions. Every visible authored string is a
reading promise. Treat any heading, body copy, label, caption, legend, annotation, link, code,
table cell, or control that is not immediately legible at presentation distance on the configured
canvas as a blocking P0 defect, even when checks and builds pass. If text is not meant to be read,
use a non-text visual texture instead of fake microcopy.

Check actual font size, weight, spacing, and computed foreground styles on the rendered descendants
across every Step and the most disruptive frame of a moving, image, or gradient background.
Passing a contrast ratio alone does not prove presentation legibility. Do not assume that setting
`color` on a wrapper determines its descendant text. Dim decorative background layers instead of a
container that also dims its text. Where a solid color pair can be measured, target at least WCAG
AA contrast: 4.5:1 for normal text and 3:1 for large text and essential UI.

Keep every label and copy block fully contained within the shape or surface that visually owns it,
with deliberate padding in every Step and intermediate frame. For circles, rings, clipped
polygons, and other non-rectangular owners, validate the usable inner silhouette after borders and
padding, not merely the rectangular bounding box. If the copy cannot fit, enlarge or reflow the
owner, or move the label outside with an explicit association. Never repair it by clipping,
overlap, or shrinking below presentation legibility.

Fix proven errors before finishing. Leave the local preview running when that helps the user review
the result.

## Report the result

Tell the user:

- where the project was created;
- the preview URL and requested output paths;
- assumptions you made;
- checks and visual review completed;
- any remaining judgment calls.

Never invent facts, URLs, artifacts, or successful visual inspection.

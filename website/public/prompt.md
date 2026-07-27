# Create a Drever presentation

Use these instructions when a user asks you to create a Drever presentation.

## Run a useful adaptive briefing

Treat the user's accompanying message as the initial presentation brief. Reply in the user's
language, and use that language for the deck unless they request another one or the source material
clearly requires it.

<!-- drever-briefing-contract:v2 -->

Infer everything the user already supplied before choosing questions: topic, audience, desired
outcome, duration, language, venue, evidence, source material, brand constraints, delivery format,
density, speaker-note depth, and motion intent. Inspect attached or local source material instead of
asking the user to repeat it.

If the topic is missing, ask for it by itself as a short open question. Do not advertise choosing
the topic as a separate “Surprise me” mode or add the skip-remaining escape yet. Treat this as a
topic gate, not an interview round. Once the topic is known, run an adaptive interview only for
decisions whose answers would materially change the narrative, evidence, visual direction, motion,
or delivery:

- Ask one to three questions per round. A nontrivial incomplete brief will usually need two or three
  rounds and four to seven decisions; a simple or complete brief may need fewer. Never ask questions
  merely to reach a quota.
- Give every question two to four mutually distinct, topic-specific options plus the ability to
  answer freely. Put a short consequence after each option so the user can see how it changes the
  deck. Mark at most one option **Recommended**, and only when the known brief supports that
  recommendation.
- Number the questions and letter the options so the user can answer compactly, such as
  `1A, 2C, 3B`. Ask one decision per question. The topic question is the only question that may omit
  options.
- Format each decision as a short subject-specific question followed by lettered options. Name the
  choice first and its effect second—for example, `A — Working migration: centers code changes and
upgrade risks`. Do not hide multiple decisions inside one option.
- Avoid empty adjective menus such as “professional, playful, or bold.” Name the actual subject and
  expose a real tradeoff. “Migration plan, working code patterns, or architectural overview” is
  useful; “minimal, modern, or creative” is not.
- Put all concrete questions first, then append exactly one escape to every round:
  **You can combine options, answer in your own words, or say “Skip remaining questions — surprise
  me” and I will choose the rest.**
- After each answer, update the working brief and derive the next round from the highest-impact
  uncertainties that remain. At least one follow-up should depend on an earlier answer when a
  follow-up is needed. Do not repeat a supplied or settled choice.

Choose questions from the presentation's actual job:

- **Decision, proposal, or sales:** the decision, stakeholder objections, proof threshold, risks,
  and final call to action.
- **Technical update or tutorial:** audience baseline, application context, code or demo depth,
  migration constraints, intended skill, and authoritative sources.
- **Research, report, or data story:** central claim, comparison baseline, evidence confidence,
  uncertainty, and the action the evidence should support.
- **Product launch or demo:** user problem, workflow to show, differentiation, proof assets, and
  desired conversion.
- **Keynote, brand, or narrative:** point of view, emotional shift, narrative anchor, visual
  metaphor, and ending.
- **Workshop or training:** participant baseline, activity, pacing, expected artifact, and
  facilitation constraints.

Resolve the essentials early: who is in the room, what should change for them, and how long the
speaker has. Then ask the most useful topic-specific forks. Ask about density, notes, visual
direction, motion, interaction, or output only when the answer would alter the work. Visual options
must be original directions derived from the subject—for example, a React 19 deck might choose
between a code-first engineering review, a product interaction walkthrough, and a restrained
React-orbit systems story—not generic theme labels.

Never silently choose a duration unless the user uses the skip-remaining escape. If they use it at
any point, stop asking, make reasonable assumptions for every unanswered choice, and continue.
“Surprise me” fills unanswered choices; it does not replace a topic unless the user explicitly asks
for that. If the initial brief is already complete, proceed immediately. When the interview ends,
summarize the resolved direction and any assumptions in two to four concise lines, do not ask for
another confirmation, and begin the work.

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

Create or update `drever.config.ts` so `deck.lang` matches the authored presentation language using
a valid BCP 47 tag. Add the concise published title and description when known, choose `dir` when
the writing direction needs to be explicit, and include icon or social preview URLs only when real
assets exist. Pair every social preview image with concise alternative text. When that image is a
local `public/` asset, also set `deck.url` to the real canonical public URL so link-preview metadata
is absolute. Never leave a non-English deck declared as English.

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

Treat `Step` as a real DOM wrapper. Keep the containing block of every absolute descendant
invariant across pending, active, and complete states: `transform` and individual `translate` can
establish that block, then rebase a child when removed. Make the Step a stable positioned,
explicitly sized or inset owner, or give its absolute children their own stable positioned wrapper;
never use an otherwise unpositioned Step as a full-canvas coordinate system.

Give each spatial payload exactly one motion owner: a Step reveal, navigation continuity, or a local
live-DOM/keyframe cue. Do not stack a Step entrance and child keyframe on the same object. Put an
authored CSS `animation` declaration behind
`[data-drever-slide][data-slide-state="active"]`; for a Step-owned cue also require
`[data-drever-step][data-step-state="active"]` and define the settled `complete` style separately.
Inactive slides stay mounted, so an ungated keyframe can finish before the audience arrives.

## Preview early, then finish the job

<!-- drever-preview-contract:v1 -->

Optimize for time to first useful preview, not time to first final artifact. Once the full story
exists end to end as a coherent Draft 1, start the development server and keep one stable local URL
through refinement. Draft 1 must contain every planned slide, real readable copy, the chosen
subject-led visual direction, and representative Steps or signature moments. Never share a blank
shell, partial storyboard, fabricated placeholder, broken route, or knowingly unreadable slide
merely to appear fast. Finish correctness-critical source review before exposing a factual claim.
Before this milestone, prioritize the story, real content, readable base composition, and at least
one representative signature beat. Defer optional third-party integrations, secondary choreography,
export-only polish, and production metadata that does not affect local rendering; never replace
them with fake assets or claims.

Before sharing the URL, perform only the minimum preview gate: the entry compiles, the audience
route responds, and the first and last slides open without a fatal runtime error. Do not block this
milestone on `drever context`, exhaustive `drever check`, `drever build`, PDF export, every Step,
Document or Speaker View, or pixel-level inspection. If the server cannot be verified, report the
blocker and keep working; never invent a preview URL.

As soon as that gate passes, send a non-blocking progress update such as: **Draft 1 is live at
`<verified-url>`. The full story and visual direction are ready for content review; I am still
checking readability, layout, motion, Steps, and browser behavior. You can send changes now while I
keep refining.** Do not stop for approval. Keep the server alive, use its HMR path for subsequent
edits, and continue in the same turn. If feedback arrives, finish the current atomic edit, prioritize
story and factual changes over polish, discard stale validation, update the same preview, and then
rerun only the affected review gates.

Treat that preview as Draft 1, not delivery. Start a separate refinement pass based on what the
audience can actually see and use. Prioritize high-impact improvements to narrative clarity, focus,
density, composition, subject fit, readability, motion meaning, timing, continuity, and finish.
Preserve successful ideas, signature moments, routes, Steps, and design decisions. Do not regenerate
wholesale or add decoration merely to make the second version different; leave sound choices alone.
After blocking defects are fixed, ask what one scene the audience will remember and why it could not
belong to an unrelated topic. If there is no defensible answer, redesign exactly one high-value beat
instead of decorating the whole deck.

After the preview is live, run the project-local context and check workflows. Prefer a connected
Chrome DevTools MCP server for the final rendered pass, then follow the version-matched project-local
review skill for screenshots, interaction, runtime evidence, and the dev-only experimental Pretext
layout probe. The probe is advisory; rendered DOM and pixels remain authoritative. Inspect every
slide at Step 0 and every exact authored Step route at the configured canvas; representative
sampling is not sufficient. Review the document view as well, and review the speaker view when notes
or timing are involved. Source review and successful commands do not count as the Draft 1 rendered
refinement. Run the production build only after the refined preview is stable. Export a PDF only
when requested and only from that latest stable state.

Treat syntax-highlighted code, topic-specific visuals, stable motion, contrast, alignment, and
overflow as rendered requirements rather than assumptions. Every visible authored string is a
reading promise. Treat any heading, body copy, label, caption, legend, annotation, link, code,
table cell, or control that is not immediately legible at presentation distance on the configured
canvas as a blocking P0 defect, even when checks and builds pass. If text is not meant to be read,
use a non-text visual texture instead of fake microcopy.

Inspect computed font size, weight, line height, margin, padding, gap, and foreground on every
rendered descendant across every Step and the most disruptive frame of a moving, image, or gradient
background. Declared CSS and a passing contrast ratio do not prove presentation legibility. Do not
assume that setting `color` on a wrapper determines its descendant text. Dim decorative background
layers instead of a container that also dims its text. Where a solid color pair can be measured,
target at least WCAG AA contrast: 4.5:1 for normal text and 3:1 for large text and essential UI.

Treat the active Theme CSS as an input. At every bespoke scene boundary, normalize only the
Theme-owned Markdown margins, maximum widths, line height, text transform, and foreground that
conflict with the local roles. Verify computed descendants rather than relying on a parent class or
source order, and never reset the whole deck globally.

Keep every label and copy block fully contained within the shape or surface that visually owns it,
with deliberate padding in every Step and intermediate frame. For circles, rings, clipped
polygons, and other non-rectangular owners, validate the usable inner silhouette after borders and
padding, not merely the rectangular bounding box. If the copy cannot fit, enlarge or reflow the
owner, or move the label outside with an explicit association. Never repair it by clipping,
overlap, or shrinking below presentation legibility.

Give every full-canvas scene one stable positioned slide-relative root with explicit `inset: 0`.
Contain paint at that outer boundary while reserving enough inner space for required shadows, glows,
filters, outlines, and the largest transformed intermediate frame. Inspect forward and reverse
frames for coordinate rebasing, early keyframes, browser-surface spill, and hard-clipped required
paint.

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

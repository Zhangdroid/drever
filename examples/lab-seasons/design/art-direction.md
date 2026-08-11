# Art direction: Geometry of Light

## Design brief

- Subject and claim: Seasons are driven by Earth's approximately 23.4° axial tilt changing Sun angle and daylight duration, not by a seasonal change in Earth–Sun distance.
- Source material: The approved Storyboard and user-supplied facts only. No browsing, external assets, generated imagery, or additional quantitative evidence.
- Audience and action: Students aged 14–16 should be able to explain the mechanism to someone else after a 12-minute classroom talk.
- Dominant content: Misconception testing, spatial geometry, two causal comparisons, and a reusable verbal explanation.
- Venue and surfaces: Projected 1600 × 900 classroom presentation, audience view, speaker notes, document view, and website build.
- Accessibility: Large high-contrast type; essential labels at or above 24 px; color is always paired with position or wording; settled endpoints carry the complete explanation; reduced motion removes nonessential animation.
- Tone and pacing: Curious, respectful, evidence-led, and concise. The deck moves from a plausible wrong model to a mechanism students can redraw.

## Visual foundation

- Canvas: Locked at 1600 × 900 (16:9), preserving `drever.config.ts`.
- Safe area: 72 px on every edge.
- Default content inset: 96 px; panels use 28–42 px internal padding.
- Surface ownership: `design/theme.ts` owns tokens and semantic defaults; `design/theme.css` owns canvas variables and Theme normalization; `design/stage-background.tsx` owns all persistent background paint, star texture, and the orbital-arc accent; `draft.css` owns slide-local scenes. Slide roots remain transparent.
- Last-known-good foundation: Draft 1's 72 px safe area, 96 px inset, stable diagram-label spacing, and readable line wraps.

## Subject-led system

- Visual premise: A dark astronomy notebook in which one warm beam, one cool shadow signal, and a consistently tilted Earth turn an abstract misconception into visible geometry.
- Primary pattern: `before-invariant-counterfactual-rule`.
- Rationale: The story begins with the familiar distance model, holds the shared Earth–Sun distance invariant, changes hemispheric orientation, reveals the counterfactual failures, and lands a compact causal rule.
- Beat mapping: familiar model (1–2) → invariant evidence tests (3–5) → change the geometric variable (6–7) → expose its two consequences (8–10) → synthesize the causal rule (11–13) → act by explaining it (14–15).
- Recurring focal artifact: A schematic Earth whose tilted axis is the stable geometric feature. It appears as hypothesis context, becomes decisive evidence, then anchors the final explanation.
- Final static payoff: “Tilt changes angle + daylight—not Earth's seasonal distance.” beside the same tilted Earth model.

## Typography

- Family: Inter when locally available, falling back to system sans-serif; this is a restrained system fallback chosen for classroom legibility, not a claim of scientific meaning. No external font files are used.
- Roles: display 68–92 px / 760–850; title 60–76 px / 760; body 28–32 px / 500–700; functional labels 24–26 px / 700–850; compact uppercase eyebrows 22 px / 800; numeric evidence up to 128 px / 850.
- Rationale: One family prevents decorative voices from competing with geometry; weight, scale, and measured uppercase labels provide hierarchy.

## Color

- Canvas `#071522` and surface `#0d2436`: night-sky context.
- Primary ink `#f5f1e8` and quiet ink `#acc2ce`: high-contrast room reading.
- Main accent `#ffca56`: Sun, direct light, and the “toward” causal path.
- Secondary signal `#82b8ff`: winter, shade, and the “away” path.
- Error signal `#ff9a86`: failed predictions only.
- No categorical rainbow is used. Color is never the only carrier of meaning.

## Signature moments

1. **The plausible model becomes a test** — claim: distance must make a prediction → focal artifact: the small Earth orbiting the Sun → initial state: orbit and evidence question settled → meaningful transformation: the orbit line draws and Earth completes one short evidence-led arc on slide 1 → settled payoff: the Earth stops beside “Let’s make the idea predict” → reduced-motion endpoint: complete orbit, Earth, and prompt visible.
2. **Tilt replaces distance as the explanatory object** — claim: orientation, not seasonal distance, is the relevant geometry → focal artifact: the fixed 180 × 180 Earth shell with its 23.4° axis → initial state: close-up tilt diagram on slide 6 → meaningful transformation: fixed-shell continuity carries the same Earth into the left orbital position on slide 7 while the axis remains aligned → settled payoff: two orbital positions show parallel axes → reduced-motion endpoint: slide 7's complete orbit scene.
3. **The mechanism assembles into a teachable rule** — claim: two lighting effects form one causal chain → focal artifact: the fixed causal route on slide 11 → initial state: all milestones readable at low emphasis → meaningful transformation: one warm signal travels left-to-right and lands on summer while nodes gain emphasis in causal order → settled payoff: all four nodes readable with Summer highlighted → reduced-motion endpoint: the complete chain without travel.
4. **Knowledge becomes action** — claim: students can now teach the mechanism → focal artifact: the final tilted Earth and closing sentence → initial state: four explanation moves on slide 14 → meaningful transformation: the persistent Stage atmosphere warms at the chapter boundary and the tilted Earth settles beside the final rule → settled payoff: partner prompt plus final sentence → reduced-motion endpoint: complete closing scene.

## Scene map

| Slide | Claim                                                            | Focal evidence                                           | Visual form               | Composition                                                                              | Motion owner      | Settled endpoint                                                      |
| ----- | ---------------------------------------------------------------- | -------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------- |
| 1     | The distance idea is testable.                                   | Earth–Sun orbit relationship                             | Mechanism diagram         | Large type at left; circular orbit occupies the upper-right field; prompt docks low-left | focal object      | Full orbit, Earth, Sun, question, and prompt visible                  |
| 2     | A distance cause predicts global seasonal agreement.             | One Earth shared by both hemispheres                     | Causal route              | Wide horizontal hypothesis → consequence band beneath a fixed heading                    | none              | Earth, labeled arrow, global-warming prediction, and question visible |
| 3     | Closest approach occurs in early January.                        | Early-January closest-position label                     | Spatial evidence diagram  | Evidence copy at left; Earth–distance–Sun diagram at right; month stamp below Earth      | none              | Closest line, January stamp, and northern-winter statement visible    |
| 4     | One shared distance coexists with opposite seasons.              | North/South seasonal split                               | Comparison diagram        | Centered headline above warm/cool hemisphere comparison with Earth between               | none              | Both hemisphere cards and split Earth visible                         |
| 5     | The distance model fails two observations.                       | January and opposite-season test results                 | Evidence verdict          | Centered claim above two aligned test surfaces and verdict rule                          | none              | Both failures and the verdict sentence visible                        |
| 6     | Earth's 23.4° axial tilt is the relevant geometry.               | Tilted axis against vertical reference                   | Mechanism diagram         | Numeric evidence and claim at left; large axis diagram at right                          | focal object      | 23.4° value, reference line, axis, and 180 × 180 Earth visible        |
| 7     | The axis keeps its direction while hemispheres tilt toward/away. | Parallel axes at two orbital positions                   | Spatial mechanism diagram | Claim at upper-left; orbit fills right and lower field                                   | focal object      | Two fixed-size Earth models, parallel axes, Sun, and orbit visible    |
| 8     | Tilt changes angle and daylight.                                 | Two named effect branches                                | Mechanism overview        | Oversized “Angle + time” above two equal evidence surfaces                               | none              | Both effect branches fully visible                                    |
| 9     | Higher-angle light is more concentrated.                         | Equal-width beams on unequal ground footprints           | Geometric comparison      | Headline above paired fixed comparison frames                                            | focal object      | Both beams and their ground footprints visible                        |
| 10    | Longer daylight provides more heating time.                      | Long and short daylight tracks                           | Timeline comparison       | Headline above two full-width time tracks and one conclusion line                        | one chart measure | Both tracks and their labels visible                                  |
| 11    | Tilt toward the Sun creates a complete summer chain.             | Four-node causal route                                   | Process route             | Heading above one horizontal path; correction sentence below                             | focal object      | All nodes visible; warm signal landed at Summer                       |
| 12    | The opposite hemisphere receives the reverse effects.            | Mirrored warm/cool causal chains around one tilted Earth | Systems comparison        | Earth centered between symmetric but semantically opposed chains                         | none              | Both chains, center Earth, and outcome words visible                  |
| 13    | Tilt explains the evidence that distance cannot.                 | Three-row model test                                     | Aligned comparison table  | Compact headline above stable three-column evidence grid                                 | one chart measure | All rows visible with failure/success language aligned                |
| 14    | A correct explanation has four moves.                            | Four numbered verbal anchors                             | Ordered explanation map   | Two-by-two numbered map beneath a fixed heading                                          | Step group        | All four moves visible in reading order                               |
| 15    | Students can teach the mechanism.                                | Final causal sentence and tilted Earth                   | Type-led mechanism close  | Partner prompt and rule at left; tilted Earth at right                                   | Stage sub-layer   | Final rule, prompt, and Earth visible in warmed atmosphere            |

## Handoff map

| Edge  | Carried idea or object                                     | Relationship       | Technique                                                                                             | Fixed geometry                                                                         | Reverse behavior                                                                                 |
| ----- | ---------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1→2   | Orbit hypothesis becomes a prediction                      | semantic-successor | Direct cut; orbit geometry gives way to a horizontal cause route                                      | none — no shared snapshot; circle and route have incompatible silhouettes              | Reverse cut restores the complete opening orbit                                                  |
| 2→3   | Prediction meets the January observation                   | semantic-successor | Direct cut to evidence                                                                                | none — no shared snapshot; changing prose and diagram proportions make capture unsafe  | Reverse cut restores the prediction band                                                         |
| 3→4   | Clue one yields to clue two                                | semantic-successor | Local clue-number replace through destination-side styling                                            | live frame — no captured shell                                                         | Reverse navigation restores 01 without replaying a shared snapshot                               |
| 4→5   | Two clues become a verdict                                 | semantic-successor | Direct cut; paired hemisphere scene becomes aligned evidence cards                                    | none — no shared snapshot; Earth split and verdict cards have no invariant shell       | Reverse cut restores the comparison                                                              |
| 5→6   | Failed model opens the mechanism chapter                   | chapter-boundary   | Persistent Stage root holds while inner atmosphere remains stationary; destination axis draws locally | live frame — no captured shell                                                         | Reverse returns to the settled verdict without reversing the axis draw                           |
| 6→7   | The same tilted Earth moves from close-up to orbit context | same-object        | Native fixed-shell continuity on the Earth sphere only                                                | 180 px inline size × 180 px block size; 1:1 aspect ratio; border-box; identical paint  | Reverse continuity returns the same shell to the close-up position; axis references remain local |
| 7→8   | Orbit geometry branches into its two consequences          | semantic-successor | Direct cut to two effect branches                                                                     | none — no shared snapshot; the orbit and two evidence cards have incompatible geometry | Reverse cut restores the complete orbit scene                                                    |
| 8→9   | Sun-angle branch becomes a detailed beam comparison        | semantic-successor | Direct cut; branch icon is not captured because its scale and crop differ from the evidence frame     | none — no shared snapshot; icon and beam frames have incompatible dimensions           | Reverse cut restores both branches                                                               |
| 9→10  | Angle effect yields to duration effect                     | chapter-boundary   | Direct cut between two different evidence encodings                                                   | none — no shared snapshot                                                              | Reverse cut restores beam comparison                                                             |
| 10→11 | Two effects combine into one causal route                  | semantic-successor | Local destination route activation; timeline does not snapshot into nodes                             | live frame — no captured shell                                                         | Reverse returns to complete daylight tracks; route signal does not run backward                  |
| 11→12 | One summer chain becomes mirrored hemispheric chains       | semantic-successor | Direct cut; shared wording is outside fixed shells and would wrap incompatibly                        | none — no shared snapshot; changing text metrics make continuity unsafe                | Reverse cut restores the complete four-node chain                                                |
| 12→13 | Mechanism is tested against both observations              | semantic-successor | Direct cut to stable comparison grid                                                                  | none — no shared snapshot; system diagram and table have no common fixed feature       | Reverse cut restores mirrored chains                                                             |
| 13→14 | Evidence decision becomes a reusable explanation           | semantic-successor | Direct cut; model rows become numbered verbal moves                                                   | none — no shared snapshot; row wording and numbering change role and geometry          | Reverse cut restores the model test                                                              |
| 14→15 | Explanation structure becomes a partner action             | chapter-boundary   | Persistent Stage inner atmosphere warms; destination content settles without canvas snapshot          | live frame — no captured shell                                                         | Reverse restores the mechanism atmosphere and complete four-move map                             |

## Motion vocabulary

- Mostly direct cuts: evidence should feel stable and inspectable.
- One fixed-shell continuity edge for the same Earth sphere on 6→7.
- Local deterministic signature animations only on slides 1, 6, and 11; they are scoped to the active audience slide and never own the same payload as a Step.
- The Stage root never moves. Its inner atmosphere changes only at the closing chapter.
- Reduced motion and export show the complete settled evidence immediately.

## Assets, sources, and licenses

- No external assets, web fonts, photographs, or generated images.
- All diagrams are original HTML/CSS shapes authored in the project.
- Evidence source: user-supplied facts recorded in the approved brief.

## Assumptions and fallback decisions

- The projector can reproduce a dark high-contrast scene; panel surfaces remain opaque enough for ambient-light separation.
- System sans-serif is a declared fallback because no licensed subject-specific font was supplied and browsing is prohibited.
- The star texture is decorative, CSS-generated, low contrast, and never factual evidence.

## Implementation receipt

| Claim                         | Route / Step              | Pattern role         | Source selector                                | Implemented transformation or reveal                                                                                              | Settled payoff                                            | Reduced-motion endpoint                        |
| ----------------------------- | ------------------------- | -------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| The distance idea is testable | `/1` Step 0               | familiar model       | `.opening-orbit`, `.orbit-line`, `.tiny-earth` | Active-slide orbit line draws while the Earth makes one short deterministic arc and stops                                         | Complete orbit beside the prediction prompt               | Full orbit and stopped Earth shown immediately |
| Orientation replaces distance | `/6` Step 0 → `/7` Step 0 | change variable      | `.tilt-earth-shell` inside `MotionGroup`       | The same 180 × 180 fixed Earth shell carries from the close-up into the left orbit position; the local axis draw remains separate | Two orbital positions with parallel axes                  | Slide 7 complete orbit scene without travel    |
| Two effects form one cause    | `/11` Step 0              | counterfactual rule  | `.chain-signal`, `.chain-node`                 | One active-slide signal travels along the fixed route while nodes emphasize in order                                              | Signal lands on Summer and all four nodes remain readable | Complete chain with Summer highlighted         |
| Students can act on the rule  | `/15` Step 0              | memorable rule / act | `.season-stage__atmosphere`, `.closing-earth`  | Persistent Stage atmosphere shifts once at the closing chapter; final Earth and sentence settle together                          | Teach-back prompt and final rule                          | Complete close in the warm resolved atmosphere |

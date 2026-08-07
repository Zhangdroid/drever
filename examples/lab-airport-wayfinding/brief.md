# Presentation brief

Status: Approved

## Objective

- Title: Why airport signs work when nobody has time to read
- Topic: What airport wayfinding teaches product teams about interfaces used under time pressure.
- Desired change: Product designers and product managers leave with six practical principles and a short review method they can apply to rushed interfaces.
- Audience: Product designers and product managers.
- Audience baseline: Comfortable with product flows, information hierarchy, design systems, and usability trade-offs; no specialist knowledge of wayfinding is assumed.

## Delivery

- Duration: About 15 minutes.
- Planned slide count: 15.
- Language: English.
- Venue and delivery format: Presenter-led conceptual design talk, suitable for an internal product/design audience or conference session.
- Deliverables in this phase: A reviewed story plan only. Deck authoring begins after explicit approval.

## Content and evidence

- Must cover: The conditions that make airport navigation difficult; six transferable wayfinding principles; interface examples for each principle; a practical review method; a memorable closing rule.
- Six principles: Announce destination before detail; put one decision at each decision point; reveal detail in sequence; make the system more consistent than clever; use redundant cues; separate scan mode from read mode.
- Can omit: Airport operations, signage standards, accessibility regulations, historical case studies, vendor examples, quantitative research, and implementation code.
- Evidence approach: Conceptual reasoning, familiar airport moments, hypothetical interface examples, and before/after contrasts. Examples are illustrative, not reported research findings.
- Claims or decisions that require evidence: No empirical performance claims or statistics will be made. Any later factual claim about a named airport, standard, or measured outcome would require a primary source before inclusion.
- Preferred source authority: None required for the approved conceptual story. If factual claims are later requested, use current primary sources only.
- Provided or permitted assets: No external assets are required. Prefer original diagrams, arrows, route markers, labels, and interface abstractions created in the deck.

## Direction

- Visible slide density: Concise, presenter-led slides with fuller speaker notes.
- Speaker-note strategy: Notes carry the supporting explanation, transitions, examples, and caveats; visible slides keep one idea per moment and avoid paragraph copy.
- Narrative approach: Begin inside the rushed traveler’s mental state, show why airport signs succeed, derive six principles, translate them into product-interface behavior, and close with a reusable pre-ship test.
- Visual direction: A custom subject-led system inspired by wayfinding grammar rather than a specific airport brand: high contrast, large directional language, route continuity, modular labels, restrained color coding, and unmistakable hierarchy.
- Motion intensity: Restrained. Motion may reinforce direction, sequence, and continuity, but must never delay comprehension or become decorative.
- Interaction intent: None required. The talk should work reliably as a linear presentation.
- Visual, motion, or interaction references: Generic airport wayfinding cues only; do not imitate a named identity system.

## Visual foundation

- Canvas: Preserve the configured 1600 × 900 canvas in `drever.config.ts` exactly.
- Safe area: Keep all meaningful content at least 56 px from every canvas edge.
- Default content inset: Use 96 px left/right and 72 px top/bottom from the canvas edge; exceptions must remain inside the 56 px hard safe area.
- Theme owner: A custom Theme will own typography, color tokens, panels, labels, and content hierarchy.
- Stage background owner: A custom Stage will own the uninterrupted base field and any non-semantic ambient texture.
- Persistent accent owner: The Theme will own a single route-line / directional-marker accent system; individual slides will not add competing persistent rails or frames.
- Last-known-good layout checkpoint: The first content-complete Draft 1, created only after plan approval, will lock the baseline grid, panel padding, and readable line wraps for later refinement.

## Slide outline

Keep this approval outline content-only. Per-slide layout, composition, motion, Steps, and implementation decisions belong in `design/art-direction.md` after story approval.

1. **Why airport signs work when nobody has time to read** — Opening. Establish the central promise: design for the glance, then reward the read. Evidence: the familiar experience of navigating while moving. Takeaway: rushed use is a distinct design condition.
2. **Nobody arrives at the sign calm** — Context. Name the traveler’s constraints: moving, uncertain, interrupted, and carrying a goal. Evidence: a conceptual arrival-to-gate moment. Takeaway: attention is already spent before the interface appears.
3. **Rushed is not the same as simple** — Claim. Distinguish low attention from low task complexity. Evidence: the simultaneous needs to orient, choose, act, and confirm. Takeaway: removing information alone does not create clarity.
4. **1 — Announce destination before detail** — Claim. Put the user’s goal ahead of explanation or system language. Evidence: a destination-first sign compared with a procedure-first prompt. Takeaway: lead with where the user can go.
5. **Hierarchy changes with distance** — Explanation. Show three information horizons: decide from afar, confirm at the choice, read detail when stopped. Evidence: the same journey viewed at approach, junction, and rest. Takeaway: design hierarchy for the user’s available attention window.
6. **2 — One decision at each decision point** — Claim. Match each interface moment to the choice the user must make now. Evidence: a corridor junction and a multi-step product flow. Takeaway: do not expose future decisions at the current fork.
7. **3 — Reveal detail in sequence** — Explanation. Treat progressive disclosure as a route, not a drawer full of hidden content. Evidence: destination, direction, confirmation, then local detail. Takeaway: every reveal should answer the next question.
8. **4 — Consistency beats cleverness** — Claim. Reuse a small, stable vocabulary for categories, directions, and states. Evidence: repeated labels and symbols across multiple decision points. Takeaway: recognition is faster than reinterpretation.
9. **5 — Use redundant cues** — Claim. Combine words, icons, color, position, and shape so no single cue carries the whole instruction. Evidence: one message surviving the loss of any one cue. Takeaway: redundancy is resilience, not decoration.
10. **Confirmation is part of navigation** — Explanation. Keep users oriented between decisions and confirm that the route is still correct. Evidence: continuity markers after a turn and persistent progress after a product action. Takeaway: silence after action creates doubt.
11. **6 — Separate scan mode from read mode** — Claim. Make primary actions and status legible at a glance while placing explanation where pausing is possible. Evidence: a rushed state contrasted with a safe-to-read state. Takeaway: do not make urgent users parse prose.
12. **Translate the sign into the interface** — Comparison. Map wayfinding behaviors to rushed product moments such as checkout recovery, incident response, onboarding, and permission prompts. Evidence: paired airport and interface patterns. Takeaway: the principles transfer without copying the visual style.
13. **Start with the decision map** — Process. Offer a practical sequence: identify the goal, mark decision points, define each attention window, then assign cue and confirmation. Evidence: a compact conceptual flow. Takeaway: structure the journey before styling screens.
14. **The pre-ship glance test** — Decision. Review a rushed interface with six questions derived from the principles. Evidence: destination, current decision, sequence, consistency, redundancy, and scan/read separation. Takeaway: teams can evaluate the design in minutes without a new framework.
15. **Design for the glance. Reward the read.** — Close. Reframe clarity as helping someone move with confidence, not merely reducing copy. Evidence: a concise recap of the six principles. Takeaway: the best rushed interface makes the next step unmistakable and the deeper explanation available.

## Assumptions and open risks

- The talk is intentionally conceptual and does not claim that every airport or sign system works equally well.
- “Rushed interfaces” includes any product moment where time pressure, movement, interruption, anxiety, or divided attention reduces reading capacity.
- The six principles are presented as a practical synthesis for this talk, not as a formal standard or research taxonomy.
- Hypothetical product examples must stay generic enough to avoid implying measured outcomes or endorsements.
- Fifteen slides require disciplined pacing of roughly one minute per slide; slides 4–11 form the core and should receive most of the spoken time.

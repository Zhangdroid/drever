const sharedFirstTurn = `Fetch and follow https://drever.dev/prompt.md.

This isolated release test already fetched the exact response to
\`.release-smoke/prompt.md\`. Read that local copy instead of accessing the
network. Also read \`.release-smoke/constraints.md\`, which defines the narrow
generation-stage boundary for this run. Begin with the optional briefing from
the fetched prompt; do not assume that any question has already been answered.`;

const sourceReview = `Before finishing, inventory every slide's final visible static heading in
order and make each heading distinct after Unicode, case, and whitespace normalization. If the
closing callback repeats an earlier phrase, keep that refrain as supporting copy beneath a
different closing heading. Then reread every authored file as literal source. Correct obvious MDX
and JSX syntax defects, including unbalanced tags, malformed expressions, invalid imports, and
Markdown delimiter runs used as visible placeholders. This is a source review, not a claim that
validation ran.`;

const sharedTopic = "why black holes are not cosmic vacuum cleaners";
const sharedEvidence = `Use this supplied science fixture as the complete factual basis:

- Some black holes can form when the core of a sufficiently massive star collapses.
- The event horizon is a boundary beyond which signals, including light, cannot return to the
  outside universe. It is not a solid surface or a suction front.
- Far outside the event horizon, a black hole's gravitational field is no different from that of
  another object with the same mass. For a spherical object and a non-rotating black hole, measured
  from their centers and outside both objects: same mass + same distance = same gravitational pull.
- In a thought experiment where the Sun is replaced by a black hole with exactly the Sun's mass,
  Earth would keep essentially the same orbit. Earth would become dark and cold because sunlight
  disappeared, not because the black hole sucked Earth inward.
- Objects can orbit black holes. An object falls through the event horizon only when its path
  crosses that boundary, often after passing close enough or losing enough orbital energy and
  angular momentum.
- Close to a black hole, tidal effects can become extreme. Hot matter outside the horizon can glow
  brightly as it heats.
- Black holes can be detected through the motion of nearby objects, light from hot surrounding
  matter, and gravitational waves from mergers.
- For one simple far-field chart, normalized gravitational strength is 1 at distance 1, 1/4 at
  distance 2, 1/9 at distance 3, and 1/16 at distance 4. These relative values use an inverse-square
  approximation, measure distance from the center, and assume every point is well outside the
  event horizon.

Do not browse or add named black holes, discoveries, dates, object counts, exact sizes, or other
facts outside this fixture.`;
const topicTurn = `Create a 12-slide English presentation about ${sharedTopic}.

${sharedEvidence}`;

export const releaseSmokeScenarios = Object.freeze([
  Object.freeze({
    brief:
      "Explain why black holes are not cosmic vacuum cleaners; the model makes every remaining narrative, visual, and motion decision.",
    id: "surprise-me",
    label: "Surprise me",
    mode: "surprise-me",
    turns: Object.freeze([
      sharedFirstTurn,
      `${topicTurn}

Skip remaining questions — surprise me. Choose every remaining creative decision, then write the
complete brief and 12-slide outline for review. Do not create the presentation yet.`,
      `I approve the brief and slide outline. Mark brief.md as Approved, then create the complete presentation now. Review the
authored draft once more, keep its strongest idea, then refine the
narrative, composition, hierarchy, motion, and small details wherever the source reveals a
clear improvement. ${sourceReview} Do not run validation in this protected stage.`,
    ]),
  }),
  Object.freeze({
    brief:
      "Replace the cosmic-vacuum-cleaner myth with a clear 12-minute science story for an international high-school audience.",
    id: "guided",
    label: "Guided answers",
    mode: "guided",
    turns: Object.freeze([
      sharedFirstTurn,
      topicTurn,
      `The audience is curious high-school students from different countries with no advanced
physics background. I have 12 minutes and want 12 slides. By the end, they should replace the
vacuum-cleaner myth with one memorable rule: same mass, same distance, same pull. They should also
understand stellar collapse, the event horizon, why objects can orbit instead of falling in, and
how astronomers detect black holes.

Keep visible slides concise: one main claim and no more than three short supporting phrases per
slide. Put two to four useful explanatory sentences in each slide's speaker notes. The notes must
identify the Sun replacement as a thought experiment and the normalized chart as a far-field
inverse-square simplification.

Use a dark, high-contrast visual language derived from orbital paths, distance rings, horizons,
light, and scale. Build original local vector or CSS diagrams instead of using external images.
Do not use a rubber-sheet funnel, drain, or generic card grid as the main explanation. Keep every
label and chart value clearly readable.

Use moderate, purposeful, Step-driven motion. Preserve the orbit's position while the Sun
transforms into an equal-mass black hole. Let the gravity chart build in order and let
orbit-versus-fall paths separate clearly. Use at most one dominant motion idea per slide;
backgrounds must remain quiet and stable. Do not invent any scientific facts beyond the supplied
fixture.

Skip remaining questions — surprise me. Write the complete brief and 12-slide outline for review,
but do not create the presentation yet.`,
      `I approve the brief and slide outline. Mark brief.md as Approved, then create the complete presentation now. Use expressive but purposeful motion and a
high-contrast orbital visual language. Preserve what already works, then refine the narrative,
composition, hierarchy, motion, and small details wherever the source reveals a clear improvement.
${sourceReview} Do not run validation in this protected stage.`,
    ]),
  }),
]);

export const getReleaseSmokeScenario = (id) => {
  const scenario = releaseSmokeScenarios.find((candidate) => candidate.id === id);
  if (scenario === undefined) throw new Error(`Unknown release smoke scenario: ${id}`);
  return scenario;
};

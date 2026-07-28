const sharedFirstTurn = `Fetch and follow https://drever.dev/prompt.md.

This isolated release test already fetched the exact response to
\`.release-smoke/prompt.md\`. Read that local copy instead of accessing the
network. Also read \`.release-smoke/constraints.md\`, which defines the narrow
generation-stage boundary for this run. Begin with the optional briefing from
the fetched prompt; do not assume that any question has already been answered.`;

const sourceReview = `Before finishing, reread every authored file as literal source. Correct
obvious MDX and JSX syntax defects, including unbalanced tags, malformed expressions, invalid
imports, and Markdown delimiter runs used as visible placeholders. This is a source review, not a
claim that validation ran.`;

const sharedTopic = "a proposal for the first phase of a neighborhood park renewal";
const sharedEvidence = `Use this fictional community-planning exercise as the complete factual
basis: residents must choose which improvement to fund first. A survey of 180
residents found that 46% want more shade, 34% want flexible seating, and 20% want
a small events area. The first-phase budget can fund only one option.`;
const topicTurn = `Create a presentation about ${sharedTopic}.

${sharedEvidence}`;

export const releaseSmokeScenarios = Object.freeze([
  Object.freeze({
    brief:
      "Propose the first phase of a neighborhood park renewal; the model makes every remaining narrative, visual, and motion decision.",
    id: "surprise-me",
    label: "Surprise me",
    mode: "surprise-me",
    turns: Object.freeze([
      sharedFirstTurn,
      `${topicTurn}

Skip remaining questions — surprise me. Choose every remaining creative decision, then write the
complete brief and slide outline for review. Do not create the presentation yet.`,
      `I approve the brief and slide outline. Mark brief.md as Approved, then create the complete presentation now. Review the
authored draft once more, keep its strongest idea, then refine the
narrative, composition, hierarchy, motion, and small details wherever the source reveals a
clear improvement. ${sourceReview} Do not run validation in this protected stage.`,
    ]),
  }),
  Object.freeze({
    brief:
      "Propose the first phase of a neighborhood park renewal through a concise eight-minute decision story.",
    id: "guided",
    label: "Guided answers",
    mode: "guided",
    turns: Object.freeze([
      sharedFirstTurn,
      topicTurn,
      `The audience is residents and community organizers in a public meeting.
I have eight minutes. By the end, they should be able to choose the first-phase
priority and understand the trade-off behind it. Keep visible slides concise
and put useful facilitation detail in speaker notes. Use expressive but
purposeful motion and a warm civic-plan visual language with spatial layers.
Do not invent additional survey results, costs, dates, locations, or promises.

Skip remaining questions — surprise me. Write the complete brief and slide outline for review, but
do not create the presentation yet.`,
      `I approve the brief and slide outline. Mark brief.md as Approved, then create the complete presentation now. Use expressive but purposeful motion and a
warm civic-plan visual language with spatial layers. Preserve what already works, then refine the
narrative, composition, hierarchy, motion, and small details wherever the source reveals a clear
improvement. ${sourceReview} Do not run validation in this protected stage.`,
    ]),
  }),
]);

export const getReleaseSmokeScenario = (id) => {
  const scenario = releaseSmokeScenarios.find((candidate) => candidate.id === id);
  if (scenario === undefined) throw new Error(`Unknown release smoke scenario: ${id}`);
  return scenario;
};

const sharedFirstTurn = `Fetch and follow https://drever.dev/prompt.md.

This isolated release test already fetched the exact response to
\`.release-smoke/prompt.md\`. Read that local copy instead of accessing the
network. Also read \`.release-smoke/constraints.md\`, which defines the narrow
generation-stage boundary for this run. Begin with the optional briefing from
the fetched prompt; do not assume that any question has already been answered.`;

export const releaseSmokeScenarios = Object.freeze([
  Object.freeze({
    brief:
      "Codex chooses a useful presentation topic and makes the remaining narrative, visual, and motion decisions without further briefing.",
    id: "surprise-me",
    label: "Surprise me",
    mode: "surprise-me",
    turns: Object.freeze([
      sharedFirstTurn,
      "Surprise me. Choose the topic and every remaining creative decision, then create the presentation now.",
      `Review the complete authored draft once more. Keep its strongest idea, then refine the
narrative, composition, hierarchy, motion, and small details wherever the source reveals a
clear improvement. Do not run validation in this protected stage.`,
    ]),
  }),
  Object.freeze({
    brief:
      "Show product, design, and engineering leads how to run an eight-minute pre-mortem that ends with three launch risks, owners, and next actions.",
    id: "guided",
    label: "Guided answers",
    mode: "guided",
    turns: Object.freeze([
      sharedFirstTurn,
      "Create a presentation about running a useful pre-mortem before a product launch.",
      `The audience is a small group of product, design, and engineering leads.
I have eight minutes. By the end, they should be able to choose the three risks
that deserve owners before launch. Keep visible slides concise and put useful
facilitation detail in speaker notes.`,
      `Review the complete authored draft once more. Use expressive but purposeful motion and a
calm launch-control or risk-radar visual language. Preserve what already works, then refine the
narrative, composition, hierarchy, motion, and small details wherever the source reveals a clear
improvement. Do not run validation in this protected stage.`,
    ]),
  }),
]);

export const getReleaseSmokeScenario = (id) => {
  const scenario = releaseSmokeScenarios.find((candidate) => candidate.id === id);
  if (scenario === undefined) throw new Error(`Unknown release smoke scenario: ${id}`);
  return scenario;
};

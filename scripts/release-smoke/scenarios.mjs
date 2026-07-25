const sharedFirstTurn = `Fetch and follow https://drever.dev/prompt.md.

This isolated release test already fetched the exact response to
\`.release-smoke/prompt.md\`. Read that local copy instead of accessing the
network. Also read \`.release-smoke/constraints.md\`, which defines the narrow
generation-stage boundary for this run. Begin with the optional briefing from
the fetched prompt; do not assume that any question has already been answered.`;

export const releaseSmokeScenarios = Object.freeze([
  Object.freeze({
    brief:
      "A fictional checkout experiment improved completion from 68% to 81%, while weekly support requests rose from 6 to 12. Help a product team decide whether to expand it.",
    id: "surprise-me",
    label: "Surprise me",
    mode: "surprise-me",
    turns: Object.freeze([
      sharedFirstTurn,
      `Create a short presentation for a product team reviewing a fictional checkout experiment.
Completion improved from 68% to 81%, while weekly support requests rose from 6 to 12.
The room needs to decide whether to expand the experiment.`,
      "Skip remaining questions — surprise me. Choose the rest and create the presentation now.",
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
      `Use expressive but purposeful motion. Favor a practical walkthrough over
theory, with a calm launch-control or risk-radar visual language. Those are my
remaining answers; please create the presentation now.`,
    ]),
  }),
]);

export const getReleaseSmokeScenario = (id) => {
  const scenario = releaseSmokeScenarios.find((candidate) => candidate.id === id);
  if (scenario === undefined) throw new Error(`Unknown release smoke scenario: ${id}`);
  return scenario;
};

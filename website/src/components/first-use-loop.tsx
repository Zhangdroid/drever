const loopSteps = [
  {
    description: "Create a safe project and install its version-matched Drever workflows.",
    label: "Prepare",
    visual: "prepare",
  },
  {
    description: "Set the topic, audience, outcome, duration, density, and motion direction.",
    label: "Brief",
    visual: "brief",
  },
  {
    description: "Answer only the subject-specific questions that can change the result.",
    label: "Direction",
    visual: "direction",
  },
  {
    description: "Review the page-by-page story before research and styling become expensive.",
    label: "Storyboard",
    visual: "storyboard",
  },
  {
    description: "Inspect the complete live deck and respond to one slide or the whole story.",
    label: "Draft",
    visual: "draft",
  },
  {
    description: "Resolve source and rendered diagnostics, then deliver the website or PDF.",
    label: "Review",
    visual: "review",
  },
] as const;

function LoopVisual({ kind }: { kind: (typeof loopSteps)[number]["visual"] }) {
  return (
    <span aria-hidden="true" className="first-use-loop__visual" data-visual={kind}>
      <i />
      <i />
      <i />
    </span>
  );
}

export function FirstUseLoop() {
  return (
    <ol aria-label="The first Drever workflow" className="first-use-loop">
      {loopSteps.map((step, index) => (
        <li key={step.label}>
          <span className="first-use-loop__index" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="first-use-loop__copy">
            <strong>{step.label}</strong>
            <span>{step.description}</span>
          </span>
          <LoopVisual kind={step.visual} />
        </li>
      ))}
    </ol>
  );
}

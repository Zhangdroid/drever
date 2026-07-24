import { useState, type ReactElement } from "react";

const DIRECTIONS = [
  {
    detail: "Keep the decision visible while the evidence changes.",
    label: "Focus the room",
    result: "One decision. One active signal.",
  },
  {
    detail: "Reveal the proof only after the audience asks for it.",
    label: "Reveal the proof",
    result: "96% completed setup unaided.",
  },
  {
    detail: "Turn the presentation state into a link people can reopen.",
    label: "Share the moment",
    result: "The exact state is ready to send.",
  },
] as const;

/** A compact proof that ordinary React state can direct authored slide content. */
export const FeatureLab = (): ReactElement => {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = DIRECTIONS[activeIndex] ?? DIRECTIONS[0];

  return (
    <section className="gallery-lab" aria-label="Interactive presentation direction">
      <div className="gallery-lab__choices" role="group" aria-label="Choose the next direction">
        {DIRECTIONS.map((direction, index) => (
          <button
            key={direction.label}
            aria-pressed={index === activeIndex}
            onClick={() => setActiveIndex(index)}
            type="button"
          >
            <span>0{index + 1}</span>
            <strong>{direction.label}</strong>
          </button>
        ))}
      </div>
      <div className="gallery-lab__result" role="status" aria-live="polite">
        <span>Live React state · illustrative</span>
        <strong>{active.result}</strong>
        <p>{active.detail}</p>
      </div>
    </section>
  );
};

export const ShowcaseNav = (): ReactElement => (
  <nav className="drever-example-exit gallery-showcases" aria-label="Continue with Drever">
    <a
      className="drever-example-exit__primary"
      data-drever-showcase-return=""
      href="https://drever.dev/docs/getting-started"
    >
      <span>Create your own</span>
      <span aria-hidden="true">↗</span>
    </a>
    <a className="drever-example-exit__secondary" href="https://drever.dev/showcase">
      <span>Explore more examples</span>
      <span aria-hidden="true">→</span>
    </a>
  </nav>
);

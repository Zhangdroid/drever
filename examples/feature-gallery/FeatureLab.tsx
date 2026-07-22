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

const demoURL = (localPort: number, publishedPath: string, filePath: string): string => {
  if (typeof window === "undefined") return publishedPath;
  if (window.location.protocol === "file:") {
    return new URL(filePath, window.location.href).href;
  }
  if (window.location.port === "4324") {
    return `${window.location.protocol}//${window.location.hostname}:${localPort}/`;
  }
  return new URL(publishedPath, window.location.origin).href;
};

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
        <span>Live React state</span>
        <strong>{active.result}</strong>
        <p>{active.detail}</p>
      </div>
    </section>
  );
};

export const ShowcaseNav = (): ReactElement => (
  <nav className="gallery-showcases" aria-label="Related Drever showcases">
    <a
      href={demoURL(4320, "/demos/product/", "../../product-tour/dist/index.html")}
      rel="noopener"
      target="_blank"
    >
      <span>Product tour</span>
      <span aria-hidden="true">↗</span>
    </a>
    <a
      href={demoURL(4322, "/demos/motion/", "../../motion-recipes/dist/index.html")}
      rel="noopener"
      target="_blank"
    >
      <span>Motion recipes</span>
      <span aria-hidden="true">↗</span>
    </a>
  </nav>
);

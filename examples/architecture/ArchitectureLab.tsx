import { useId, useState, type ReactElement } from "react";
import type { DeckIR, DeckManifest } from "@drever/schema";

const deckIrFixture = {
  version: 1,
  sourcePath: "slides.mdx",
  preamble: [],
  slides: [
    {
      id: "slide-4",
      index: 3,
      source: "<Step>Seal the artifact.</Step>",
      fragments: [
        {
          value: "<Step>Seal the artifact.</Step>",
          range: {
            path: "slides.mdx",
            start: { line: 42, column: 1, offset: 860 },
            end: { line: 42, column: 33, offset: 892 },
          },
        },
      ],
    },
  ],
} as const satisfies DeckIR;

const manifestFixture = {
  version: 2,
  slides: [
    {
      id: "slide-4",
      index: 3,
      stepStops: [1, 2, 3, 4, 5],
      speakerNotes: [
        {
          format: "markdown",
          value: "Advance five times.",
          plainText: "Advance five times.",
        },
      ],
    },
  ],
} as const satisfies DeckManifest;

const compactJson = (value: DeckIR | DeckManifest): string =>
  JSON.stringify(value).replaceAll(":", ": ").replaceAll(",", ", ");

const ARTIFACT_ORDER = ["source", "ir", "manifest", "runtime"] as const;
type ArtifactId = (typeof ARTIFACT_ORDER)[number];

type Artifact = Readonly<{
  code: string;
  label: string;
  owner: string;
  promise: string;
}>;

const ARTIFACTS = {
  source: {
    label: "MDX source",
    owner: "Author",
    promise: "Readable intent stays easy to generate, review, and version.",
    code: `# Motion carries meaning.\n\n<Step>Reveal the decision.</Step>\n\n<Note>Pause before the proof.</Note>`,
  },
  ir: {
    label: "Deck IR",
    owner: "Compiler",
    promise: "Serializable semantics exist before React, Vite, or the filesystem.",
    code: compactJson(deckIrFixture),
  },
  manifest: {
    label: "Manifest",
    owner: "Compiler",
    promise: "Every runtime surface consumes the same frozen navigation contract.",
    code: compactJson(manifestFixture),
  },
  runtime: {
    label: "Runtime",
    owner: "Client",
    promise: "Audience and speaker views interpret one position without inspecting DOM.",
    code: `{
  "surface": "audience",
  "position": {
    "slideIndex": 3,
    "step": 1
  }
}`,
  },
} as const satisfies Record<ArtifactId, Artifact>;

/** Lets a technical audience inspect the contracts between Drever layers. */
export const ArtifactExplorer = (): ReactElement => {
  const titleId = useId();
  const [selected, setSelected] = useState<ArtifactId>("ir");
  const artifact = ARTIFACTS[selected];

  return (
    <section className="arch-explorer" aria-labelledby={titleId}>
      <div className="arch-explorer__controls">
        <span className="arch-kicker" id={titleId}>
          Follow the information
        </span>
        <div className="arch-explorer__buttons" role="group" aria-label="Artifact layer">
          {ARTIFACT_ORDER.map((id, index) => (
            <button
              key={id}
              aria-pressed={selected === id}
              onClick={() => setSelected(id)}
              type="button"
            >
              <span>0{index + 1}</span>
              {ARTIFACTS[id].label}
            </button>
          ))}
        </div>
      </div>

      <div className="arch-explorer__artifact" role="status" aria-live="polite">
        <div className="arch-explorer__meta">
          <span>{artifact.label}</span>
          <span>Owner · {artifact.owner}</span>
        </div>
        <pre>
          <code>{artifact.code}</code>
        </pre>
        <p>{artifact.promise}</p>
      </div>
    </section>
  );
};

type Surface = "audience" | "speaker";

const SLIDES = [1, 2, 4] as const;
type SlideNumber = (typeof SLIDES)[number];

/** A selected projection of this deck's compiled manifest positions for the lab UI. */
const STEPS_BY_SLIDE: Readonly<Record<SlideNumber, readonly number[]>> = {
  1: [0],
  2: [0],
  4: [0, 1, 2, 3, 4, 5],
};

const encodeRoute = (surface: Surface, slide: number, step: number): string => {
  const namespace = surface === "speaker" ? "/speaker" : "";
  if (slide === 1 && step === 0) {
    return namespace || "/";
  }
  return `${namespace}/${slide}${step === 0 ? "" : `/${step}`}`;
};

/** Makes the route-to-static-artifact contract tangible without changing the live deck URL. */
export const RouteCompiler = (): ReactElement => {
  const [surface, setSurface] = useState<Surface>("audience");
  const [slide, setSlide] = useState<SlideNumber>(4);
  const [step, setStep] = useState<number>(5);
  const validSteps = STEPS_BY_SLIDE[slide];
  const route = encodeRoute(surface, slide, step);
  const file = route === "/" ? "dist/index.html" : `dist${route}/index.html`;

  const selectSlide = (nextSlide: SlideNumber): void => {
    setSlide(nextSlide);
    if (!STEPS_BY_SLIDE[nextSlide].includes(step)) {
      setStep(0);
    }
  };

  return (
    <section className="arch-route-lab" aria-label="Route compiler">
      <div className="arch-route-lab__inputs">
        <fieldset>
          <legend>Surface</legend>
          <div>
            {(["audience", "speaker"] as const).map((candidate) => (
              <button
                key={candidate}
                aria-pressed={surface === candidate}
                onClick={() => setSurface(candidate)}
                type="button"
              >
                {candidate}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Slide</legend>
          <div>
            {SLIDES.map((candidate) => (
              <button
                key={candidate}
                aria-pressed={slide === candidate}
                onClick={() => selectSlide(candidate)}
                type="button"
              >
                {candidate}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Step</legend>
          <div>
            {validSteps.map((candidate) => (
              <button
                key={candidate}
                aria-pressed={step === candidate}
                onClick={() => setStep(candidate)}
                type="button"
              >
                {candidate}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="arch-route-lab__output" role="status" aria-live="polite">
        <span>Valid stops in this projection</span>
        <code>{validSteps.join(" · ")}</code>
        <span>Canonical URL</span>
        <strong>{route}</strong>
        <span>Materialized production entry</span>
        <code>{file}</code>
      </div>
    </section>
  );
};

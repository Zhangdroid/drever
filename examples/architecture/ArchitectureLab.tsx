import { Fragment, useState, type ReactElement } from "react";

type Surface = "audience" | "speaker";

const SLIDES = [1, 2, 4] as const;
type SlideNumber = (typeof SLIDES)[number];

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

const RouteSegment = ({
  label,
  value,
}: Readonly<{ label: string; value: string }>): ReactElement => (
  <span className="arch-route-segment">
    <small>{label}</small>
    <strong>{value}</strong>
  </span>
);

/**
 * Turns a selected manifest position into the two artifacts that matter to users:
 * a canonical URL and a reloadable static file.
 */
export const RouteCompiler = (): ReactElement => {
  const [surface, setSurface] = useState<Surface>("speaker");
  const [slide, setSlide] = useState<SlideNumber>(4);
  const [step, setStep] = useState(5);
  const validSteps = STEPS_BY_SLIDE[slide];
  const route = encodeRoute(surface, slide, step);
  const file = route === "/" ? "dist/index.html" : `dist${route}/index.html`;
  const routeSegments = [
    ...(surface === "speaker" ? [{ label: "surface", value: "speaker" }] : []),
    ...(slide === 1 && step === 0 ? [] : [{ label: "slide", value: String(slide) }]),
    ...(step === 0 ? [] : [{ label: "step", value: String(step) }]),
  ];

  const selectSlide = (nextSlide: SlideNumber): void => {
    setSlide(nextSlide);
    if (!STEPS_BY_SLIDE[nextSlide].includes(step)) {
      setStep(0);
    }
  };

  return (
    <section className="arch-route-lab" aria-label="Route compiler">
      <div className="arch-route-controls">
        <fieldset>
          <legend>Surface</legend>
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
        </fieldset>
        <fieldset>
          <legend>Slide</legend>
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
        </fieldset>
        <fieldset>
          <legend>Step</legend>
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
        </fieldset>
      </div>

      <div className="arch-route-canvas">
        <div className="arch-route-expression" aria-label={`Canonical route ${route}`}>
          <span aria-hidden="true">/</span>
          {routeSegments.map((segment, index) => (
            <Fragment key={segment.label}>
              {index === 0 ? null : <span aria-hidden="true">/</span>}
              <RouteSegment {...segment} />
            </Fragment>
          ))}
        </div>
        <div className="arch-route-output">
          <span className="arch-route-output__beam" aria-hidden="true" />
          <span>materializes as</span>
          <code>{file}</code>
        </div>
      </div>

      <p className="arch-live-status" role="status">
        Route {route}; output {file}.
      </p>
    </section>
  );
};

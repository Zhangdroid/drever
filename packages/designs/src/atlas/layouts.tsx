import { useId, type ComponentPropsWithoutRef, type ReactElement, type ReactNode } from "react";

const withClassName = (base: string, className?: string): string =>
  className ? `${base} ${className}` : base;

export type RouteTone = "ember" | "ocean" | "terrain";

export type RouteProps = Omit<ComponentPropsWithoutRef<"section">, "children" | "title"> &
  Readonly<{
    caption?: ReactNode;
    destination: ReactNode;
    label?: ReactNode;
    origin: ReactNode;
    title: ReactNode;
    tone?: RouteTone;
    waypoints: readonly ReactNode[];
  }>;

/** An ordered journey from a concrete origin through a bounded set of waypoints. */
export const Route = ({
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  caption,
  className,
  destination,
  label,
  origin,
  title,
  tone = "ocean",
  waypoints,
  ...props
}: RouteProps): ReactElement => {
  const generatedTitleId = useId();
  const titleId =
    ariaLabel === undefined && ariaLabelledBy === undefined ? generatedTitleId : undefined;
  const stops = [origin, ...waypoints, destination];

  return (
    <section
      {...props}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy ?? titleId}
      className={withClassName("drever-atlas-route", className)}
      data-drever-layout="route"
      data-tone={tone}
    >
      <header className="drever-atlas-route__header">
        {label === undefined ? null : <p className="drever-atlas-route__label">{label}</p>}
        <h1 className="drever-atlas-route__title" id={titleId}>
          {title}
        </h1>
      </header>
      <ol className="drever-atlas-route__track">
        {stops.map((stop, index) => {
          const routeIndex = index === 0 ? undefined : String(index).padStart(2, "0");

          return (
            <li
              className="drever-atlas-route__stop"
              data-route-index={routeIndex}
              data-stop={
                index === 0 ? "origin" : index === stops.length - 1 ? "destination" : "waypoint"
              }
              key={index}
            >
              {routeIndex === undefined ? null : (
                <span className="drever-atlas-route__index" aria-hidden="true">
                  {routeIndex}
                </span>
              )}
              <div className="drever-atlas-route__stop-content">{stop}</div>
            </li>
          );
        })}
      </ol>
      {caption === undefined ? null : <p className="drever-atlas-route__caption">{caption}</p>}
    </section>
  );
};

export type SurveyBalance = "balanced" | "visual-led";

export type SurveyProps = Omit<ComponentPropsWithoutRef<"article">, "children" | "title"> &
  Readonly<{
    balance?: SurveyBalance;
    caption?: ReactNode;
    finding: ReactNode;
    label?: ReactNode;
    legend: ReactNode;
    title: ReactNode;
    visual: ReactNode;
  }>;

/** One field artifact with the finding, legend, and provenance required to inspect it. */
export const Survey = ({
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  balance = "balanced",
  caption,
  className,
  finding,
  label,
  legend,
  title,
  visual,
  ...props
}: SurveyProps): ReactElement => {
  const generatedTitleId = useId();
  const titleId =
    ariaLabel === undefined && ariaLabelledBy === undefined ? generatedTitleId : undefined;

  return (
    <article
      {...props}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy ?? titleId}
      className={withClassName("drever-atlas-survey", className)}
      data-balance={balance}
      data-drever-layout="survey"
    >
      <header className="drever-atlas-survey__header">
        {label === undefined ? null : <p className="drever-atlas-survey__label">{label}</p>}
        <h2 className="drever-atlas-survey__title" id={titleId}>
          {title}
        </h2>
        <div className="drever-atlas-survey__finding">{finding}</div>
      </header>
      <figure className="drever-atlas-survey__visual">
        <div className="drever-atlas-survey__artifact">{visual}</div>
        {caption === undefined ? null : <figcaption>{caption}</figcaption>}
      </figure>
      <aside className="drever-atlas-survey__legend">{legend}</aside>
    </article>
  );
};

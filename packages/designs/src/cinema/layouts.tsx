import { useId, type ComponentPropsWithoutRef, type ReactElement, type ReactNode } from "react";

const withClassName = (base: string, className?: string): string =>
  className ? `${base} ${className}` : base;

export type TitleCardAlign = "center" | "left";
export type TitleCardTone = "night" | "paper";

export type TitleCardProps = Omit<ComponentPropsWithoutRef<"header">, "children" | "title"> &
  Readonly<{
    align?: TitleCardAlign;
    credit?: ReactNode;
    eyebrow?: ReactNode;
    logline?: ReactNode;
    title: ReactNode;
    tone?: TitleCardTone;
  }>;

/** A spare narrative opening for a talk, act, or chapter boundary. */
export const TitleCard = ({
  align = "center",
  className,
  credit,
  eyebrow,
  logline,
  title,
  tone = "night",
  ...props
}: TitleCardProps): ReactElement => (
  <header
    {...props}
    className={withClassName("drever-cinema-title-card", className)}
    data-align={align}
    data-drever-layout="title-card"
    data-tone={tone}
  >
    <div className="drever-cinema-title-card__cue" aria-hidden="true">
      <span />
      <span />
    </div>
    <div className="drever-cinema-title-card__content">
      {eyebrow === undefined ? null : (
        <p className="drever-cinema-title-card__eyebrow">{eyebrow}</p>
      )}
      <h1 className="drever-cinema-title-card__title">{title}</h1>
      {logline === undefined ? null : (
        <p className="drever-cinema-title-card__logline">{logline}</p>
      )}
    </div>
    {credit === undefined ? null : <p className="drever-cinema-title-card__credit">{credit}</p>}
  </header>
);

export type FrameRatio = "academy" | "widescreen";

export type FrameProps = Omit<ComponentPropsWithoutRef<"figure">, "children"> &
  Readonly<{
    caption?: ReactNode;
    credit?: ReactNode;
    heading?: ReactNode;
    media: ReactNode;
    ratio?: FrameRatio;
  }>;

/** A geometry-stable frame for one visual artifact and its explanatory caption. */
export const Frame = ({
  caption,
  className,
  credit,
  heading,
  media,
  ratio = "widescreen",
  ...props
}: FrameProps): ReactElement => {
  const headingId = useId();
  const hasCaption = heading !== undefined || caption !== undefined || credit !== undefined;
  const ariaLabelledBy =
    props["aria-labelledby"] ??
    (props["aria-label"] === undefined && heading !== undefined ? headingId : undefined);

  return (
    <figure
      {...props}
      aria-labelledby={ariaLabelledBy}
      className={withClassName("drever-cinema-frame", className)}
      data-drever-layout="frame"
      data-ratio={ratio}
    >
      <div className="drever-cinema-frame__media">{media}</div>
      {hasCaption ? (
        <figcaption className="drever-cinema-frame__caption">
          {heading === undefined ? null : (
            <strong className="drever-cinema-frame__heading" id={headingId}>
              {heading}
            </strong>
          )}
          {caption === undefined ? null : (
            <span className="drever-cinema-frame__copy">{caption}</span>
          )}
          {credit === undefined ? null : (
            <span className="drever-cinema-frame__credit">{credit}</span>
          )}
        </figcaption>
      ) : null}
    </figure>
  );
};

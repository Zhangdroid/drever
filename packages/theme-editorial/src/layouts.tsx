import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";

const withClassName = (base: string, className?: string): string =>
  className ? `${base} ${className}` : base;

export type MastheadAlign = "center" | "left";
export type MastheadTone = "ink" | "paper";

export type MastheadProps = Omit<ComponentPropsWithoutRef<"header">, "children" | "title"> &
  Readonly<{
    align?: MastheadAlign;
    deck?: ReactNode;
    kicker?: ReactNode;
    meta?: ReactNode;
    title: ReactNode;
    tone?: MastheadTone;
  }>;

/** A publication-style opening with a strict title, deck, and metadata hierarchy. */
export const Masthead = ({
  align = "left",
  className,
  deck,
  kicker,
  meta,
  title,
  tone = "paper",
  ...props
}: MastheadProps): ReactElement => (
  <header
    {...props}
    className={withClassName("drever-editorial-masthead", className)}
    data-align={align}
    data-drever-layout="masthead"
    data-tone={tone}
  >
    <div className="drever-editorial-masthead__rule" aria-hidden="true" />
    <div className="drever-editorial-masthead__content">
      {kicker === undefined ? null : <p className="drever-editorial-masthead__kicker">{kicker}</p>}
      <h1 className="drever-editorial-masthead__title">{title}</h1>
      {deck === undefined ? null : <p className="drever-editorial-masthead__deck">{deck}</p>}
    </div>
    {meta === undefined ? null : <p className="drever-editorial-masthead__meta">{meta}</p>}
  </header>
);

export type FeatureBalance = "balanced" | "text-led" | "visual-led";

export type FeatureProps = Omit<ComponentPropsWithoutRef<"article">, "children" | "title"> &
  Readonly<{
    balance?: FeatureBalance;
    body: ReactNode;
    caption?: ReactNode;
    heading: ReactNode;
    visual: ReactNode;
  }>;

/** A story-and-evidence composition for one argument supported by one visual. */
export const Feature = ({
  balance = "balanced",
  body,
  caption,
  className,
  heading,
  visual,
  ...props
}: FeatureProps): ReactElement => (
  <article
    {...props}
    className={withClassName("drever-editorial-feature", className)}
    data-balance={balance}
    data-drever-layout="feature"
  >
    <div className="drever-editorial-feature__story">
      <h2>{heading}</h2>
      <div className="drever-editorial-feature__body">{body}</div>
    </div>
    <figure className="drever-editorial-feature__visual">
      {visual}
      {caption === undefined ? null : <figcaption>{caption}</figcaption>}
    </figure>
  </article>
);

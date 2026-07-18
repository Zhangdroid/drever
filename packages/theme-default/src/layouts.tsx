import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";

const withClassName = (base: string, className?: string): string =>
  className ? `${base} ${className}` : base;

export type CoverTone = "light" | "dark" | "accent";

export type CoverProps = Omit<ComponentPropsWithoutRef<"header">, "children" | "title"> &
  Readonly<{
    eyebrow?: ReactNode;
    footer?: ReactNode;
    supporting?: ReactNode;
    title: ReactNode;
    tone?: CoverTone;
  }>;

/** A title-led opening or chapter divider with a deliberately small content budget. */
export const Cover = ({
  className,
  eyebrow,
  footer,
  supporting,
  title,
  tone = "light",
  ...props
}: CoverProps): ReactElement => (
  <header
    {...props}
    className={withClassName("drever-layout-cover", className)}
    data-drever-layout="cover"
    data-tone={tone}
  >
    <div className="drever-layout-cover__main">
      {eyebrow === undefined ? null : <p className="drever-layout-cover__eyebrow">{eyebrow}</p>}
      <h1 className="drever-layout-cover__title">{title}</h1>
      {supporting === undefined ? null : (
        <p className="drever-layout-cover__supporting">{supporting}</p>
      )}
    </div>
    {footer === undefined ? null : <p className="drever-layout-cover__footer">{footer}</p>}
  </header>
);

export type TwoColumnRatio = "equal" | "wide-primary" | "wide-secondary";

export type TwoColumnProps = Omit<ComponentPropsWithoutRef<"div">, "children"> &
  Readonly<{
    primary: ReactNode;
    ratio?: TwoColumnRatio;
    secondary: ReactNode;
  }>;

/** Two explicit content regions for comparison, causality, or a text/visual pair. */
export const TwoColumn = ({
  className,
  primary,
  ratio = "equal",
  secondary,
  ...props
}: TwoColumnProps): ReactElement => (
  <div
    {...props}
    className={withClassName("drever-layout-two-column", className)}
    data-drever-layout="two-column"
    data-ratio={ratio}
  >
    <div className="drever-layout-two-column__region" data-column="primary">
      {primary}
    </div>
    <div className="drever-layout-two-column__region" data-column="secondary">
      {secondary}
    </div>
  </div>
);

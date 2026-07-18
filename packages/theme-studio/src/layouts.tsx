import { useId, type ComponentPropsWithoutRef, type ReactElement, type ReactNode } from "react";

const withClassName = (base: string, className?: string): string =>
  className ? `${base} ${className}` : base;

export type StatementTone = "dark" | "signal";

export type StatementProps = Omit<ComponentPropsWithoutRef<"header">, "children" | "title"> &
  Readonly<{
    eyebrow?: ReactNode;
    index?: ReactNode;
    supporting?: ReactNode;
    title: ReactNode;
    tone?: StatementTone;
  }>;

/** A decisive opening, section marker, or thesis with a controlled supporting line. */
export const Statement = ({
  className,
  eyebrow,
  index,
  supporting,
  title,
  tone = "dark",
  ...props
}: StatementProps): ReactElement => (
  <header
    {...props}
    className={withClassName("drever-studio-statement", className)}
    data-drever-layout="statement"
    data-tone={tone}
  >
    <div className="drever-studio-statement__meta">
      {eyebrow === undefined ? null : <p className="drever-studio-statement__eyebrow">{eyebrow}</p>}
      {index === undefined ? null : <span className="drever-studio-statement__index">{index}</span>}
    </div>
    <h1 className="drever-studio-statement__title">{title}</h1>
    {supporting === undefined ? null : (
      <p className="drever-studio-statement__supporting">{supporting}</p>
    )}
  </header>
);

export type WorkbenchRatio = "equal" | "wide-main";

export type WorkbenchProps = Omit<ComponentPropsWithoutRef<"section">, "children"> &
  Readonly<{
    label?: ReactNode;
    main: ReactNode;
    rail: ReactNode;
    ratio?: WorkbenchRatio;
  }>;

/** A primary work surface with a compact rail for context, controls, or explanation. */
export const Workbench = ({
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  label,
  main,
  rail,
  ratio = "wide-main",
  ...props
}: WorkbenchProps): ReactElement => {
  const generatedLabelId = useId();
  const labelId =
    label !== undefined && ariaLabel === undefined && ariaLabelledBy === undefined
      ? generatedLabelId
      : undefined;

  return (
    <section
      {...props}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy ?? labelId}
      className={withClassName("drever-studio-workbench", className)}
      data-drever-layout="workbench"
      data-ratio={ratio}
    >
      {label === undefined ? null : (
        <p className="drever-studio-workbench__label" id={labelId}>
          {label}
        </p>
      )}
      <div className="drever-studio-workbench__grid">
        <div className="drever-studio-workbench__main">{main}</div>
        <aside className="drever-studio-workbench__rail">{rail}</aside>
      </div>
    </section>
  );
};

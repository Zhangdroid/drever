import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";

const withClassName = (base: string, className?: string): string =>
  className ? `${base} ${className}` : base;

export type NotebookTone = "blue" | "paper";

export type NotebookProps = Omit<ComponentPropsWithoutRef<"header">, "children" | "title"> &
  Readonly<{
    eyebrow?: ReactNode;
    footer?: ReactNode;
    note?: ReactNode;
    title: ReactNode;
    tone?: NotebookTone;
  }>;

/** A handwritten opening or chapter marker with one conclusion and quiet context. */
export const Notebook = ({
  className,
  eyebrow,
  footer,
  note,
  title,
  tone = "paper",
  ...props
}: NotebookProps): ReactElement => (
  <header
    {...props}
    className={withClassName("drever-fieldnote-notebook", className)}
    data-drever-layout="notebook"
    data-tone={tone}
  >
    <div className="drever-fieldnote-notebook__main">
      {eyebrow === undefined ? null : (
        <p className="drever-fieldnote-notebook__eyebrow">{eyebrow}</p>
      )}
      <h1 className="drever-fieldnote-notebook__title">{title}</h1>
      {note === undefined ? null : <p className="drever-fieldnote-notebook__note">{note}</p>}
    </div>
    {footer === undefined ? null : <p className="drever-fieldnote-notebook__footer">{footer}</p>}
  </header>
);

export type AnnotatedBalance = "balanced" | "evidence-led";

export type AnnotatedProps = Omit<ComponentPropsWithoutRef<"article">, "children" | "title"> &
  Readonly<{
    annotations: ReactNode;
    annotationsLabel?: string;
    balance?: AnnotatedBalance;
    caption?: ReactNode;
    evidence: ReactNode;
    heading: ReactNode;
  }>;

/** One piece of evidence with a bounded set of notes that point back to it. */
export const Annotated = ({
  annotations,
  annotationsLabel,
  balance = "evidence-led",
  caption,
  className,
  evidence,
  heading,
  ...props
}: AnnotatedProps): ReactElement => (
  <article
    {...props}
    className={withClassName("drever-fieldnote-annotated", className)}
    data-balance={balance}
    data-drever-layout="annotated"
  >
    <h2 className="drever-fieldnote-annotated__heading">{heading}</h2>
    <figure className="drever-fieldnote-annotated__evidence">
      {evidence}
      {caption === undefined ? null : <figcaption>{caption}</figcaption>}
    </figure>
    <aside className="drever-fieldnote-annotated__notes" aria-label={annotationsLabel}>
      {annotations}
    </aside>
  </article>
);

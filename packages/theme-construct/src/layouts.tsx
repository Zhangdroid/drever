import { useId, type ComponentPropsWithoutRef, type ReactElement, type ReactNode } from "react";

const withClassName = (base: string, className?: string): string =>
  className ? `${base} ${className}` : base;

export type ConstructTone = "blue" | "coral" | "green" | "yellow";
export type PromptAlign = "center" | "left";

export type PromptProps = Omit<ComponentPropsWithoutRef<"section">, "children" | "title"> &
  Readonly<{
    align?: PromptAlign;
    context?: ReactNode;
    cue?: ReactNode;
    eyebrow?: ReactNode;
    footer?: ReactNode;
    question: ReactNode;
    tone?: ConstructTone;
  }>;

/** A single answerable question or task with only the context required to respond. */
export const Prompt = ({
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  align = "left",
  className,
  context,
  cue,
  eyebrow,
  footer,
  question,
  tone = "blue",
  ...props
}: PromptProps): ReactElement => {
  const generatedQuestionId = useId();
  const questionId =
    ariaLabel === undefined && ariaLabelledBy === undefined ? generatedQuestionId : undefined;

  return (
    <section
      {...props}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy ?? questionId}
      className={withClassName("drever-construct-prompt", className)}
      data-align={align}
      data-drever-layout="prompt"
      data-tone={tone}
    >
      <div className="drever-construct-prompt__main">
        {eyebrow === undefined ? null : (
          <p className="drever-construct-prompt__eyebrow">{eyebrow}</p>
        )}
        <h1 className="drever-construct-prompt__question" id={questionId}>
          {question}
        </h1>
        {context === undefined ? null : (
          <div className="drever-construct-prompt__context">{context}</div>
        )}
      </div>
      {cue === undefined ? null : <div className="drever-construct-prompt__cue">{cue}</div>}
      {footer === undefined ? null : <p className="drever-construct-prompt__footer">{footer}</p>}
    </section>
  );
};

export type AssemblyProps = Omit<ComponentPropsWithoutRef<"section">, "children" | "title"> &
  Readonly<{
    caption?: ReactNode;
    label?: ReactNode;
    parts: readonly ReactNode[];
    result: ReactNode;
    title: ReactNode;
    tone?: ConstructTone;
  }>;

/** Two to four peer concepts assembled into one explicit result. */
export const Assembly = ({
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  caption,
  className,
  label,
  parts,
  result,
  title,
  tone = "blue",
  ...props
}: AssemblyProps): ReactElement => {
  const generatedTitleId = useId();
  const titleId =
    ariaLabel === undefined && ariaLabelledBy === undefined ? generatedTitleId : undefined;

  return (
    <section
      {...props}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy ?? titleId}
      className={withClassName("drever-construct-assembly", className)}
      data-drever-layout="assembly"
      data-part-count={parts.length}
      data-tone={tone}
    >
      <header className="drever-construct-assembly__header">
        {label === undefined ? null : <p className="drever-construct-assembly__label">{label}</p>}
        <h2 className="drever-construct-assembly__title" id={titleId}>
          {title}
        </h2>
      </header>
      <div className="drever-construct-assembly__body">
        <ol className="drever-construct-assembly__parts">
          {parts.map((part, index) => (
            <li className="drever-construct-assembly__part" key={index}>
              <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <div>{part}</div>
            </li>
          ))}
        </ol>
        <div className="drever-construct-assembly__result">{result}</div>
      </div>
      {caption === undefined ? null : (
        <p className="drever-construct-assembly__caption">{caption}</p>
      )}
    </section>
  );
};

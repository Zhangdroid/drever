import { useId, type ComponentPropsWithoutRef, type ReactElement, type ReactNode } from "react";

const withClassName = (base: string, className?: string): string =>
  className ? `${base} ${className}` : base;

export type MetricTone = "attention" | "neutral" | "positive";

export type MetricProps = Omit<ComponentPropsWithoutRef<"article">, "children" | "title"> &
  Readonly<{
    benchmark?: ReactNode;
    change?: ReactNode;
    context: ReactNode;
    label: ReactNode;
    period?: ReactNode;
    tone?: MetricTone;
    unit?: ReactNode;
    value: ReactNode;
  }>;

/** One decision-driving measure with its period, change, benchmark, and interpretation. */
export const Metric = ({
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  benchmark,
  change,
  className,
  context,
  label,
  period,
  tone = "neutral",
  unit,
  value,
  ...props
}: MetricProps): ReactElement => {
  const generatedLabelId = useId();
  const labelId =
    ariaLabel === undefined && ariaLabelledBy === undefined ? generatedLabelId : undefined;

  return (
    <article
      {...props}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy ?? labelId}
      className={withClassName("drever-ledger-metric", className)}
      data-drever-layout="metric"
      data-tone={tone}
    >
      <header className="drever-ledger-metric__header">
        <h2 className="drever-ledger-metric__label" id={labelId}>
          {label}
        </h2>
        {period === undefined ? null : <p className="drever-ledger-metric__period">{period}</p>}
      </header>
      <div className="drever-ledger-metric__measure">
        <strong className="drever-ledger-metric__value">{value}</strong>
        {unit === undefined ? null : <span className="drever-ledger-metric__unit">{unit}</span>}
        {change === undefined ? null : (
          <span className="drever-ledger-metric__change">{change}</span>
        )}
      </div>
      <footer className="drever-ledger-metric__footer">
        <p className="drever-ledger-metric__context">{context}</p>
        {benchmark === undefined ? null : (
          <p className="drever-ledger-metric__benchmark">{benchmark}</p>
        )}
      </footer>
    </article>
  );
};

export type EvidenceBalance = "argument-led" | "balanced" | "evidence-led";

export type EvidenceProps = Omit<ComponentPropsWithoutRef<"article">, "children" | "title"> &
  Readonly<{
    balance?: EvidenceBalance;
    claim: ReactNode;
    evidence: ReactNode;
    interpretation: ReactNode;
    label?: ReactNode;
    source?: ReactNode;
  }>;

/** A conclusion and its inspectable evidence, interpretation, and provenance. */
export const Evidence = ({
  balance = "evidence-led",
  claim,
  className,
  evidence,
  interpretation,
  label,
  source,
  ...props
}: EvidenceProps): ReactElement => (
  <article
    {...props}
    className={withClassName("drever-ledger-evidence", className)}
    data-balance={balance}
    data-drever-layout="evidence"
  >
    <section className="drever-ledger-evidence__argument">
      {label === undefined ? null : <p className="drever-ledger-evidence__label">{label}</p>}
      <h2 className="drever-ledger-evidence__claim">{claim}</h2>
      <div className="drever-ledger-evidence__interpretation">{interpretation}</div>
    </section>
    <figure className="drever-ledger-evidence__figure">
      <div className="drever-ledger-evidence__artifact">{evidence}</div>
      {source === undefined ? null : <figcaption>{source}</figcaption>}
    </figure>
  </article>
);

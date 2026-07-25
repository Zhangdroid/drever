import { useId, type CSSProperties, type ReactElement, type ReactNode } from "react";

export type LedgerRecordStage = "audit" | "decision" | "metric";

export type LedgerRecordProps = Readonly<{
  children?: ReactNode;
  stage: LedgerRecordStage;
}>;

type CohortStyle = CSSProperties &
  Readonly<{
    "--cohort-control": string;
    "--cohort-guided": string;
  }>;

export type LedgerCohortRowProps = Readonly<{
  control: string;
  controlPosition: string;
  difference: string;
  guided: string;
  guidedPosition: string;
  source: string;
}>;

const labels: Record<LedgerRecordStage, string> = {
  audit: "Illustrative activation audit showing control and guided rates by acquisition source.",
  decision:
    "Illustrative activation decision record containing rollout, guardrail, and review conditions.",
  metric:
    "Illustrative activation record showing Q1 at 61.2 percent, a 65 percent decision line, and Q2 at 68.4 percent.",
};

export const LedgerMetricResult = (): ReactElement => (
  <div className="ledger-record__measure">
    <strong>68.4</strong>
    <span>%</span>
    <b>+7.2 pp vs Q1</b>
  </div>
);

export const LedgerCohortRow = ({
  control,
  controlPosition,
  difference,
  guided,
  guidedPosition,
  source,
}: LedgerCohortRowProps): ReactElement => {
  const style: CohortStyle = {
    "--cohort-control": controlPosition,
    "--cohort-guided": guidedPosition,
  };

  return (
    <div
      aria-label={`${source}: control ${control}; guided ${guided}; difference ${difference}.`}
      className="ledger-record__audit-row"
      role="listitem"
      style={style}
    >
      <strong>{source}</strong>
      <div aria-hidden="true" className="ledger-record__cohort-track">
        <i />
        <span data-cohort-point="control">{control}</span>
        <span data-cohort-point="guided">{guided}</span>
      </div>
      <b>{difference}</b>
    </div>
  );
};

/** A compact analytical record with restrained, row-level reveals. */
export const LedgerRecord = ({ children, stage }: LedgerRecordProps): ReactElement => {
  const labelId = useId();

  return (
    <article aria-labelledby={labelId} className="ledger-record" data-ledger-record-stage={stage}>
      <header className="ledger-record__header">
        <h2 id={labelId}>Illustrative activation record</h2>
        <p>Q2 · New team accounts</p>
      </header>

      {stage === "metric" ? (
        <section aria-label={labels.metric} className="ledger-record__metric">
          <div aria-hidden="true" className="ledger-record__threshold">
            <i className="ledger-record__threshold-line" />
            <span className="ledger-record__threshold-point" data-point="q1">
              <b>61.2</b>
              <small>Q1</small>
            </span>
            <span className="ledger-record__threshold-point" data-point="decision">
              <b>65.0</b>
              <small>Decision line</small>
            </span>
            <span className="ledger-record__threshold-point" data-point="q2">
              <b>68.4</b>
              <small>Q2</small>
            </span>
          </div>
          <div className="ledger-record__metric-summary">
            <div className="ledger-record__baseline">
              <small>Prior quarter</small>
              <strong>61.2%</strong>
            </div>
            {children}
          </div>
        </section>
      ) : null}

      {stage === "audit" ? (
        <section aria-label={labels.audit} className="ledger-record__audit">
          <div aria-hidden="true" className="ledger-record__audit-key">
            <span>Control</span>
            <span>Guided</span>
          </div>
          {children}
        </section>
      ) : null}

      {stage === "decision" ? (
        <section aria-label={labels.decision} className="ledger-record__decision">
          <p className="ledger-record__decision-label">Rollout record / approved with guardrails</p>
          {children}
        </section>
      ) : null}

      <footer className="ledger-record__footer">
        <span>
          {stage === "audit"
            ? "Experiment events · 1 Apr–30 Jun 2026 · 12,480 eligible accounts"
            : stage === "decision"
              ? "Decision owner · Activation team"
              : "Decision line · 65.0%"}
        </span>
        <span>{stage === "decision" ? "Review after 20,000 accounts" : "Illustrative data"}</span>
      </footer>
    </article>
  );
};

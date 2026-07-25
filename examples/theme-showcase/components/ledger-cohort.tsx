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

const cohorts = [
  {
    control: "63.8%",
    controlPosition: "44%",
    difference: "+8.3 pp",
    guided: "72.1%",
    guidedPosition: "85.5%",
    source: "Invited teams",
  },
  {
    control: "57.4%",
    controlPosition: "12%",
    difference: "+7.6 pp",
    guided: "65.0%",
    guidedPosition: "50%",
    source: "Organic",
  },
  {
    control: "60.1%",
    controlPosition: "25.5%",
    difference: "+6.8 pp",
    guided: "66.9%",
    guidedPosition: "59.5%",
    source: "Partner",
  },
] as const;

const labels: Record<LedgerRecordStage, string> = {
  audit: "Illustrative activation audit showing control and guided rates by acquisition source.",
  decision:
    "Illustrative activation decision record containing rollout, guardrail, and review conditions.",
  metric:
    "Illustrative activation record showing Q1 at 61.2 percent, a 65 percent decision line, and Q2 at 68.4 percent.",
};

/** One flat decision record that evolves from metric to evidence to guarded action. */
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
          <div className="ledger-record__measure">
            <strong>68.4</strong>
            <span>%</span>
            <b>+7.2 pp vs Q1</b>
          </div>
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
        </section>
      ) : null}

      {stage === "audit" ? (
        <section aria-label={labels.audit} className="ledger-record__audit">
          <div aria-hidden="true" className="ledger-record__audit-key">
            <span>Control</span>
            <span>Guided</span>
          </div>
          <ul>
            {cohorts.map((cohort) => {
              const style: CohortStyle = {
                "--cohort-control": cohort.controlPosition,
                "--cohort-guided": cohort.guidedPosition,
              };

              return (
                <li key={cohort.source} style={style}>
                  <strong>{cohort.source}</strong>
                  <div aria-hidden="true" className="ledger-record__cohort-track">
                    <i />
                    <span data-cohort-point="control">{cohort.control}</span>
                    <span data-cohort-point="guided">{cohort.guided}</span>
                  </div>
                  <b>{cohort.difference}</b>
                </li>
              );
            })}
          </ul>
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

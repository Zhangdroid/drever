import type { ReactElement } from "react";
import "./basic-focus-week.css";

export type FocusWeekPhase = "decision" | "evidence" | "framing";

type Meeting = Readonly<{
  row: number;
  span: number;
}>;

type Day = Readonly<{
  meetings: readonly Meeting[];
  name: "Fri" | "Mon" | "Thu" | "Tue" | "Wed";
}>;

const days = [
  { name: "Mon", meetings: [{ row: 2, span: 2 }] },
  {
    name: "Tue",
    meetings: [
      { row: 1, span: 1 },
      { row: 5, span: 2 },
    ],
  },
  {
    name: "Wed",
    meetings: [
      { row: 1, span: 1 },
      { row: 3, span: 2 },
      { row: 6, span: 1 },
    ],
  },
  { name: "Thu", meetings: [{ row: 4, span: 2 }] },
  { name: "Fri", meetings: [{ row: 2, span: 1 }] },
] as const satisfies readonly Day[];

const descriptions: Record<FocusWeekPhase, string> = {
  decision:
    "An illustrative team calendar with Wednesday from 9 to 12 protected as one uninterrupted focus block.",
  evidence:
    "An illustrative team calendar where three Wednesday meetings split the morning into four short fragments.",
  framing:
    "An illustrative team calendar showing the weekday mornings before a focus-time decision.",
};

const captions: Record<
  FocusWeekPhase,
  Readonly<{
    detail: string;
    label: string;
  }>
> = {
  decision: {
    detail: "Proposed 09:00–12:00",
    label: "Protected focus",
  },
  evidence: {
    detail: "Three interruptions",
    label: "Wednesday morning",
  },
  framing: {
    detail: "Current pattern",
    label: "Wednesday morning",
  },
};

/** A compact weekly calendar that can show the current pattern, evidence, or proposal. */
export const FocusWeek = ({ phase }: Readonly<{ phase: FocusWeekPhase }>): ReactElement => (
  <div
    aria-label={descriptions[phase]}
    className="theme-showcase-basic-focus-week"
    data-phase={phase}
    role="img"
  >
    <header>
      <span>Illustrative team calendar</span>
      <strong>09:00–12:00</strong>
    </header>
    <div aria-hidden="true" className="theme-showcase-basic-focus-week__days">
      {days.map(({ meetings, name }) => (
        <section data-day={name} key={name}>
          <span>{name}</span>
          <div className="theme-showcase-basic-focus-week__slots">
            <b />
            {meetings.map(({ row, span }, index) => (
              <i
                key={`${name}-${String(index)}`}
                style={{ gridRow: `${String(row)} / span ${String(span)}` }}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
    <footer>
      <span aria-hidden="true" />
      <strong>{captions[phase].label}</strong>
      <small>{captions[phase].detail}</small>
    </footer>
  </div>
);

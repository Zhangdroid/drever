import type { ReactElement } from "react";
import "./editorial-reading-hours.css";

export type ReadingHoursPhase = "decision" | "evidence" | "framing";

const arrivals = [
  { period: "open", position: "8%" },
  { period: "open", position: "27%" },
  { period: "open", position: "41%" },
  { period: "after", position: "54%" },
  { period: "after", position: "61%" },
  { period: "after", position: "69%" },
  { period: "after", position: "78%" },
  { period: "after", position: "84%" },
  { period: "after", position: "91%" },
  { period: "after", position: "97%" },
] as const;

const descriptions: Record<ReadingHoursPhase, string> = {
  decision:
    "An illustrative reading-room timeline from 4 to 8 PM. The proposed opening period now extends from 6 to 8 PM, covering seven of ten arrivals.",
  evidence:
    "An illustrative reading-room timeline from 4 to 8 PM. Three arrivals occur before the 6 PM closing line and seven occur afterward.",
  framing:
    "An illustrative reading-room timeline from 4 to 8 PM, with the current 6 PM closing line and later arrivals held in the background.",
};

/** One stable time band that moves from question to evidence to service decision. */
export const ReadingHours = ({ phase }: Readonly<{ phase: ReadingHoursPhase }>): ReactElement => (
  <div
    aria-label={descriptions[phase]}
    className="theme-showcase-editorial-reading-hours"
    data-phase={phase}
    role="img"
  >
    <header>
      <span>Illustrative weekday arrival pattern</span>
      <strong>16:00–20:00</strong>
    </header>
    <div aria-hidden="true" className="theme-showcase-editorial-reading-hours__plot">
      <span className="theme-showcase-editorial-reading-hours__open" />
      <span className="theme-showcase-editorial-reading-hours__extension" />
      <span className="theme-showcase-editorial-reading-hours__closing">
        <b>18:00 close</b>
      </span>
      <div className="theme-showcase-editorial-reading-hours__arrivals">
        {arrivals.map(({ period, position }, index) => (
          <i
            data-period={period}
            key={`${period}-${String(index)}`}
            style={{ insetInlineStart: position }}
          />
        ))}
      </div>
      <div className="theme-showcase-editorial-reading-hours__axis">
        <span>16</span>
        <span>17</span>
        <span>18</span>
        <span>19</span>
        <span>20</span>
      </div>
    </div>
    <footer>
      <span>10 arrivals observed</span>
      <span>Illustrative service scenario</span>
    </footer>
  </div>
);

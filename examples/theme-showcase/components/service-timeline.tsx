import type { PropsWithChildren, ReactElement } from "react";
import "./service-timeline.css";

const departures = [
  { label: "8:34", position: "9%" },
  { label: "9:12", position: "31%" },
  { label: "10:50", position: "88%" },
] as const;

/** A story-specific evidence component; labels stay HTML text while the timeline remains fluid. */
export const ServiceProposal = (): ReactElement => (
  <>
    <span
      className="theme-showcase-service-timeline__stop theme-showcase-service-timeline__stop--proposed"
      style={{ insetInlineStart: "60%" }}
    >
      <span className="theme-showcase-service-timeline__time">10:02 proposed</span>
    </span>
    <p>
      With one added departure
      <strong>17 minutes</strong>
    </p>
  </>
);

export const ServiceTimeline = ({ children }: PropsWithChildren): ReactElement => (
  <div
    aria-label="Illustrative Route 14 timetable comparison."
    className="theme-showcase-service-timeline"
  >
    <div className="theme-showcase-service-timeline__track">
      {departures.map(({ label, position }) => (
        <span
          className="theme-showcase-service-timeline__stop"
          key={label}
          style={{ insetInlineStart: position }}
        >
          <span className="theme-showcase-service-timeline__time">{label}</span>
        </span>
      ))}
      <span className="theme-showcase-service-timeline__gap" />
    </div>
    <p className="theme-showcase-service-timeline__finding">
      Current wait after the 9:45 shift
      <strong>65 minutes</strong>
    </p>
    {children}
  </div>
);

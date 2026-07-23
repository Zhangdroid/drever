import type { ReactElement } from "react";
import "./service-timeline.css";

const departures = [
  { label: "8:34", position: "9%" },
  { label: "9:12", position: "31%" },
  { label: "10:50", position: "88%" },
] as const;

/** A story-specific evidence component; labels stay HTML text while the timeline remains fluid. */
export const ServiceTimeline = (): ReactElement => (
  <div
    aria-label="Route 14 buses depart at 8:34 and 9:12, then not again until 10:50. A proposed 10:02 departure fills the long gap after the hospital shift."
    className="theme-showcase-service-timeline"
    role="img"
  >
    <div aria-hidden="true" className="theme-showcase-service-timeline__track">
      {departures.map(({ label, position }) => (
        <span
          className="theme-showcase-service-timeline__stop"
          key={label}
          style={{ insetInlineStart: position }}
        >
          <span className="theme-showcase-service-timeline__time">{label}</span>
        </span>
      ))}
      <span
        className="theme-showcase-service-timeline__stop theme-showcase-service-timeline__stop--proposed"
        style={{ insetInlineStart: "60%" }}
      >
        <span className="theme-showcase-service-timeline__time">10:02 proposed</span>
      </span>
      <span className="theme-showcase-service-timeline__gap" />
    </div>
    <p className="theme-showcase-service-timeline__finding">
      Current wait after the 9:45 shift: <strong>65 minutes</strong>
    </p>
  </div>
);

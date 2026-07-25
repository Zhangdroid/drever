import type { ReactElement } from "react";

import cinemaNightBus from "../assets/cinema-night-bus.jpg";

export type CinemaNightVisualProps = Readonly<{
  label?: string;
  shot?: "insert" | "return" | "wide";
}>;

/** One illustrative scene recut at deliberate shot scales without shared-element morphing. */
export const CinemaNightVisual = ({
  label = "Illustrative scene · Route 14",
  shot = "wide",
}: CinemaNightVisualProps): ReactElement => (
  <figure
    aria-label="Illustrative night-bus scene with a hospital worker riding through the city after dark."
    className="theme-showcase-cinema-visual"
    data-cinema-shot={shot}
    role="img"
  >
    <img alt="" aria-hidden="true" src={cinemaNightBus} />
    <figcaption aria-hidden="true" className="theme-showcase-cinema-visual__label">
      {label}
    </figcaption>
  </figure>
);

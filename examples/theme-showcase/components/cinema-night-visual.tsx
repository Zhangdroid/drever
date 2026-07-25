import { MotionGroup } from "drever";
import type { ReactElement } from "react";

import cinemaNightBus from "../assets/cinema-night-bus.jpg";

/** One geometry-stable illustrative artifact carried through the complete service story. */
export const CinemaNightVisual = (): ReactElement => (
  <MotionGroup
    aria-label="Illustrative night-bus scene with a hospital worker riding through the city after dark."
    className="theme-showcase-cinema-visual"
    intent="continuity"
    name="cinema-night-bus"
    role="img"
  >
    <img alt="" aria-hidden="true" src={cinemaNightBus} />
    <span aria-hidden="true" className="theme-showcase-cinema-visual__label">
      Illustrative scene · Route 14
    </span>
  </MotionGroup>
);

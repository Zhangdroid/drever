import { useId, type ReactElement } from "react";

export type AtlasRiverState = "gates" | "route" | "thermal";

export type AtlasRiverProps = Readonly<{
  state: AtlasRiverState;
}>;

const descriptions: Record<AtlasRiverState, string> = {
  route:
    "An illustrative Alder River corridor from the tidal reach through four restoration interventions to the Granite spawning beds.",
  thermal:
    "The same illustrative river corridor with four temperature stations. The exposed bend between stations B and C warms from 13.4 to 17.2 degrees Celsius.",
  gates:
    "The same illustrative river corridor with evidence gates for the culvert, canopy, and adult salmon passage.",
};

const riverPath = "M52 354 C150 332 210 272 300 282 S430 322 494 232 S620 116 770 88";

/** One fixed river geometry that acts as route, evidence, and decision record. */
export const AtlasRiver = ({ state }: AtlasRiverProps): ReactElement => {
  const descriptionId = useId();
  const titleId = useId();

  return (
    <figure className="atlas-river" data-atlas-river-state={state}>
      <svg
        aria-labelledby={`${titleId} ${descriptionId}`}
        className="atlas-river__plot"
        role="img"
        viewBox="0 0 820 450"
      >
        <title id={titleId}>Illustrative Alder River restoration corridor</title>
        <desc id={descriptionId}>{descriptions[state]}</desc>

        <path className="atlas-river__corridor-shadow" d={riverPath} />
        <path className="atlas-river__corridor" d={riverPath} />
        <path className="atlas-river__thermal-segment" d="M300 282 C370 278 430 322 494 232" />

        <g aria-hidden="true" className="atlas-river__route-labels">
          <circle cx="62" cy="351" r="8" />
          <circle cx="230" cy="276" r="8" />
          <circle cx="390" cy="280" r="8" />
          <circle cx="560" cy="169" r="8" />
          <circle cx="754" cy="92" r="10" />

          <text x="42" y="405">
            <tspan x="42">Tidal reach</tspan>
          </text>
          <text x="150" y="222">
            <tspan x="150">Remove Mill Road</tspan>
            <tspan x="150" dy="24">
              culvert
            </tspan>
          </text>
          <text x="318" y="342">
            <tspan x="318">Replant the</tspan>
            <tspan x="318" dy="24">
              exposed bend
            </tspan>
          </text>
          <text x="508" y="114">
            <tspan x="508">Reconnect</tspan>
            <tspan x="508" dy="24">
              North Marsh
            </tspan>
          </text>
          <text textAnchor="end" x="778" y="48">
            <tspan x="778">Granite</tspan>
            <tspan x="778" dy="24">
              spawning beds
            </tspan>
          </text>
          <circle className="atlas-river__route-end" cx="754" cy="92" r="5" />
        </g>

        <g aria-hidden="true" className="atlas-river__thermal-labels">
          <g transform="translate(148 326)">
            <circle r="11" />
            <text x="-24" y="-22">
              A · 13.1°
            </text>
          </g>
          <g transform="translate(300 282)">
            <circle r="11" />
            <text x="-30" y="-26">
              B · 13.4°
            </text>
          </g>
          <g transform="translate(494 232)">
            <circle r="11" />
            <text x="-26" y="-28">
              C · 17.2°
            </text>
          </g>
          <g transform="translate(650 126)">
            <circle r="11" />
            <text x="-24" y="-25">
              D · 14.0°
            </text>
          </g>
          <text className="atlas-river__thermal-change" x="360" y="357">
            +3.8 °C where canopy disappears
          </text>
        </g>

        <g aria-hidden="true" className="atlas-river__gate-labels">
          <path d="M230 276 L230 214" />
          <rect height="58" width="222" x="112" y="154" />
          <text x="130" y="178">
            <tspan className="atlas-river__gate-name">CULVERT</tspan>
            <tspan x="130" dy="21">
              Spring flow &lt; 0.8 m/s
            </tspan>
          </text>

          <path d="M390 280 L390 333" />
          <rect height="58" width="222" x="280" y="334" />
          <text x="298" y="358">
            <tspan className="atlas-river__gate-name">CANOPY</tspan>
            <tspan x="298" dy="21">
              Bend stays &lt; 15 °C
            </tspan>
          </text>

          <path d="M650 126 L650 191" />
          <rect height="58" width="226" x="568" y="192" />
          <text x="586" y="216">
            <tspan className="atlas-river__gate-name">PASSAGE</tspan>
            <tspan x="586" dy="21">
              Adults reach Granite beds
            </tspan>
          </text>
        </g>
      </svg>
      <figcaption>
        {state === "route"
          ? "Four ordered interventions · estuary to spawning beds"
          : state === "thermal"
            ? "Seven-day afternoon mean · calibrated loggers · 4–10 Aug 2026"
            : "Evidence gates · illustrative restoration scenario"}
      </figcaption>
    </figure>
  );
};

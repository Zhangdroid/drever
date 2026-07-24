import { defineTheme } from "@drever/compiler";

const PACKAGE = "@drever/designs/atlas";

export type AtlasRecipe = Readonly<{
  constraints: readonly string[];
  id: "contextual-brief" | "evidence-survey" | "journey-route";
  layout: "Markdown" | "Route" | "Survey";
  prompt: string;
  purpose: string;
}>;

/** Typed composition guidance for route, field, and evidence-led narratives. */
export const atlasRecipes = [
  {
    id: "journey-route",
    layout: "Route",
    purpose:
      "Explain a real journey, process, migration, or historical sequence from origin to destination.",
    prompt:
      "Name the origin and destination concretely, then include only the waypoints that change how the audience understands the route.",
    constraints: [
      "Use between one and five waypoints",
      "Keep each waypoint under twelve words",
      "Do not use Route for an unordered list",
    ],
  },
  {
    id: "evidence-survey",
    layout: "Survey",
    purpose:
      "Inspect one map, specimen, diagram, or field artifact with a compact legend and finding.",
    prompt:
      "Lead with the finding, make the visual the evidence, and include only the legend needed to read it.",
    constraints: [
      "Use one primary visual artifact",
      "Keep the finding under thirty-five words",
      "Keep the legend to four entries or fewer",
    ],
  },
  {
    id: "contextual-brief",
    layout: "Markdown",
    purpose:
      "Give a place, period, system, or research question enough context before examining evidence.",
    prompt:
      "State the scope first, then use one short paragraph and at most one list to establish orientation.",
    constraints: [
      "Keep prose under sixty words",
      "Use no more than four list items",
      "Do not add map decoration without spatial meaning",
    ],
  },
] as const satisfies readonly AtlasRecipe[];

export const theme = defineTheme({
  kind: "theme",
  apiVersion: 1,
  id: PACKAGE,
  version: "0.0.0",
  compilerTargets: ["canonical", "browser-lite"],
  canvas: { width: 1600, height: 900 },
  tokens: {
    color: {
      canvas: "#f1ebdd",
      ink: "#142c38",
      muted: "#586368",
      accent: "#1e6681",
      accentStrong: "#164e63",
      accentSoft: "#d6e3df",
      terrain: "#506a54",
      terrainStrong: "#3d5842",
      terrainSoft: "#dde4d8",
      ember: "#a64b1a",
      emberStrong: "#7f3510",
      emberSoft: "#f0dccb",
      surface: "#faf7ef",
      border: "#c9c0aa",
      codeCanvas: "#102631",
      codeInk: "#f5f0e5",
    },
    typography: {
      display: "Iowan Old Style, Palatino Linotype, Book Antiqua, Noto Serif, Georgia, serif",
      body: "Avenir Next, Aptos, Noto Sans, Segoe UI, ui-sans-serif, system-ui, sans-serif",
      mono: "SFMono-Regular, Consolas, ui-monospace, monospace",
      titleSize: 80,
      bodySize: 26,
    },
    space: { slideX: 104, slideY: 76, rhythm: 22 },
    shape: { radius: 2, borderWidth: 1 },
    motion: { duration: 410, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
  },
  styles: [{ specifier: `${PACKAGE}/theme.css`, layer: "theme" }],
  motion: {
    id: "atlas",
    intents: ["focus", "replace", "compare", "stagger", "continuity"],
    guidance: [
      "Use focus to identify the current waypoint while retaining the route already travelled.",
      "Use replace for one map or field artifact changing inside a stable survey frame.",
      "Use compare for alternate paths or adjacent regions and stagger for no more than four ordered observations.",
      "Follow geography and chronology: inline flow carries routes, while block flow carries strata, traces, and research observations.",
      "Use continuity only when the same place, route, specimen, or visual crop persists across adjacent slides.",
    ],
  },
  layouts: [
    {
      name: "Route",
      module: { specifier: `${PACKAGE}/layouts`, exportName: "Route" },
      description:
        "Connect an explicit origin and destination through a short ordered set of meaningful waypoints.",
      slots: [
        {
          name: "label",
          purpose: "A short region, period, route, or section label.",
          accepts: ["text"],
          maxItems: 1,
        },
        {
          name: "title",
          purpose: "The claim or question that gives the journey meaning.",
          accepts: ["text"],
          required: true,
          maxItems: 1,
        },
        {
          name: "origin",
          purpose: "The concrete starting state, place, or moment.",
          accepts: ["text", "component"],
          required: true,
          maxItems: 1,
        },
        {
          name: "waypoints",
          purpose: "Only the intermediate states that materially change the route.",
          accepts: ["text", "component"],
          required: true,
          maxItems: 5,
        },
        {
          name: "destination",
          purpose: "The concrete end state, place, or implication.",
          accepts: ["text", "component"],
          required: true,
          maxItems: 1,
        },
        {
          name: "caption",
          purpose: "Optional source, scope, date range, or route qualifier.",
          accepts: ["text"],
          maxItems: 1,
        },
      ],
      variants: ["ocean", "terrain", "ember"],
      constraints: {
        titleWords: { recommendedMaximum: 11 },
        waypointItems: { minimum: 1, recommendedMaximum: 5 },
        waypointWords: { recommendedMaximum: 12 },
        orderedRelationshipRequired: true,
      },
      example:
        '<Route label="Migration / 2026" title="From pilot to public infrastructure." origin="Prototype" waypoints={["Two partner trials", "Regional validation"]} destination="General availability" tone="terrain" />',
    },
    {
      name: "Survey",
      module: { specifier: `${PACKAGE}/layouts`, exportName: "Survey" },
      description:
        "Frame one map, specimen, diagram, or research artifact with the finding and legend needed to inspect it.",
      slots: [
        {
          name: "label",
          purpose: "A short field, location, specimen, or study label.",
          accepts: ["text"],
          maxItems: 1,
        },
        {
          name: "title",
          purpose: "The concise claim established by the evidence.",
          accepts: ["text"],
          required: true,
          maxItems: 1,
        },
        {
          name: "finding",
          purpose: "A compact interpretation of what the visual establishes.",
          accepts: ["text", "component"],
          required: true,
          maxItems: 1,
        },
        {
          name: "visual",
          purpose: "One map, specimen, diagram, chart, image, or interactive field artifact.",
          accepts: ["media", "component", "code"],
          required: true,
          maxItems: 1,
        },
        {
          name: "legend",
          purpose: "Only the labels, scale, or keys required to read the visual.",
          accepts: ["text", "component"],
          required: true,
          maxItems: 1,
        },
        {
          name: "caption",
          purpose: "Optional source, method, location, date, or accessibility summary.",
          accepts: ["text"],
          maxItems: 1,
        },
      ],
      variants: ["balanced", "visual-led"],
      constraints: {
        findingWords: { recommendedMaximum: 35 },
        legendItems: { recommendedMaximum: 4 },
        primaryVisuals: 1,
        nestedColumns: false,
      },
      example:
        '<Survey label="Coastal survey" title="The risk moved inland." finding={<p>Three districts now cross the annual flood threshold.</p>} visual={<RiskMap />} legend={<MapLegend />} caption="Modelled annual exposure · 2026" balance="visual-led" />',
    },
  ],
  manifest: {
    title: "Drever Atlas",
    summary:
      "A cartographic theme for research, travel, science, strategy, and stories shaped by place or progression.",
    artDirection: {
      keywords: ["cartographic", "field-led", "spatial", "measured", "exploratory"],
      principles: [
        "Use coordinates, routes, and legends only when they clarify scope or progression",
        "Make one map, specimen, or journey the evidence",
        "Keep labels concise and preserve generous survey margins",
        "Let direction follow geography, chronology, or research order",
      ],
      avoid: [
        "Decorative maps or invented coordinates",
        "Topographic patterns behind ordinary prose",
        "More than one competing route color on a slide",
        "Tiny legends, unlabeled paths, or maps without a text summary",
      ],
    },
    choices: {
      tones: ["ocean", "terrain", "ember"],
      emphases: ["journey", "field-evidence", "place", "progression"],
      densities: ["survey", "balanced"],
    },
  },
});

export default theme;

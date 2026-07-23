import { defineTheme } from "@drever/compiler";

const PACKAGE = "@drever/theme-studio";

export type StudioRecipe = Readonly<{
  constraints: readonly string[];
  id: "artifact-workbench" | "progressive-system" | "thesis-statement";
  layout: "Markdown" | "Statement" | "Workbench";
  prompt: string;
  purpose: string;
}>;

/** Typed composition guidance for AI and authoring tools. */
export const studioRecipes = [
  {
    id: "thesis-statement",
    layout: "Statement",
    purpose: "Open a talk or section with one decisive product or technical thesis.",
    prompt: "Write the title as a concrete claim, then add at most one clarifying sentence.",
    constraints: ["Title at most 9 words", "Supporting line at most 22 words", "Do not add a list"],
  },
  {
    id: "artifact-workbench",
    layout: "Workbench",
    purpose: "Make a live interface, diagram, code sample, or media artifact the primary evidence.",
    prompt:
      "Put the artifact in main and reserve the rail for only the context needed to inspect it.",
    constraints: ["One primary artifact", "Rail at most 35 words", "At most three rail items"],
  },
  {
    id: "progressive-system",
    layout: "Markdown",
    purpose: "Explain a system through a small sequence of meaningful Step states.",
    prompt: "Reveal only the part that changes the audience's mental model at each step.",
    constraints: ["At most four steps", "One active focal point", "No decorative reveals"],
  },
] as const satisfies readonly StudioRecipe[];

export const theme = defineTheme({
  kind: "theme",
  apiVersion: 1,
  id: PACKAGE,
  version: "0.0.0",
  compilerTargets: ["canonical", "browser-lite"],
  canvas: { width: 1600, height: 900 },
  tokens: {
    color: {
      canvas: "#101311",
      ink: "#f2f4ed",
      muted: "#9da59d",
      signal: "#dcff4f",
      signalInk: "#15180d",
      accent: "#8ddfcd",
      surface: "#191d1a",
      border: "#343b35",
      codeCanvas: "#080a09",
      codeInk: "#e8ece5",
    },
    typography: {
      display: "Aptos Display, Inter, Helvetica Neue, ui-sans-serif, system-ui, sans-serif",
      body: "Aptos, Inter, ui-sans-serif, system-ui, sans-serif",
      mono: "SFMono-Regular, Consolas, ui-monospace, monospace",
      titleSize: 78,
      bodySize: 26,
    },
    space: { slideX: 96, slideY: 76, rhythm: 22 },
    shape: { radius: 10, borderWidth: 1 },
    motion: { duration: 340, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
  },
  styles: [{ specifier: `${PACKAGE}/theme.css`, layer: "theme" }],
  motion: {
    id: "studio",
    intents: ["focus", "replace", "compare", "stagger", "continuity"],
    guidance: [
      "Use focus or replace to explain one meaningful system state at a time.",
      "Use compare for persistent alternatives and stagger for at most four parts of one artifact.",
      "Follow system topology: use inline flow for pipelines and block flow for traces, stacks, or vertically ordered states.",
      "Studio motion uses short axis travel and a subtle scale-lock so new system states feel precise rather than soft.",
      "Share a continuity name only when a diagram node, interface, or object persists across slides.",
    ],
  },
  layouts: [
    {
      name: "Statement",
      module: { specifier: `${PACKAGE}/layouts`, exportName: "Statement" },
      description:
        "State a decisive thesis for an opening or section marker with an optional index and supporting line.",
      slots: [
        {
          name: "eyebrow",
          purpose: "A short category, section, or product label.",
          accepts: ["text"],
          maxItems: 1,
        },
        {
          name: "index",
          purpose: "An optional chapter or sequence marker such as 01 or A.",
          accepts: ["text"],
          maxItems: 1,
        },
        {
          name: "title",
          purpose: "The single technical, product, or creative thesis.",
          accepts: ["text"],
          required: true,
          maxItems: 1,
        },
        {
          name: "supporting",
          purpose: "One sentence that makes the thesis concrete.",
          accepts: ["text"],
          maxItems: 1,
        },
      ],
      variants: ["dark", "signal"],
      constraints: {
        titleWords: { recommendedMaximum: 9 },
        supportingWords: { recommendedMaximum: 22 },
      },
      example:
        '<Statement eyebrow="Architecture" index="02" title="The compiler owns certainty." supporting="Runtime receives a frozen plan, not a bag of configuration." tone="signal" />',
    },
    {
      name: "Workbench",
      module: { specifier: `${PACKAGE}/layouts`, exportName: "Workbench" },
      description:
        "Give a live interface, diagram, code sample, or visual artifact a large work surface with a compact explanatory rail.",
      slots: [
        {
          name: "label",
          purpose: "A short name for the artifact or mode being inspected.",
          accepts: ["text"],
          maxItems: 1,
        },
        {
          name: "main",
          purpose: "The primary interface, diagram, code sample, media, or interactive artifact.",
          accepts: ["media", "code", "component"],
          required: true,
          maxItems: 1,
        },
        {
          name: "rail",
          purpose: "Only the context, legend, controls, or implications needed to inspect main.",
          accepts: ["text", "code", "component"],
          required: true,
          maxItems: 1,
        },
      ],
      variants: ["wide-main", "equal"],
      constraints: {
        railWords: { recommendedMaximum: 35 },
        railItems: { recommendedMaximum: 3 },
        nestedColumns: false,
      },
      example:
        '<Workbench label="Navigation state" main={<StateDiagram />} rail={<><h3>Invariant</h3><p>Every URL identifies one exact deck state.</p></>} />',
    },
  ],
  manifest: {
    title: "Drever Studio",
    summary:
      "A focused dark theme for technical narratives, product launches, creative tooling, live artifacts, and interaction-led talks.",
    artDirection: {
      keywords: ["studio", "dark", "technical", "focused", "artifact-led"],
      principles: [
        "Use signal color only for the current decision or focal point",
        "Make interfaces, diagrams, and code feel native to the slide",
        "Prefer direct claims over presentation language",
        "Use progressive disclosure to explain systems, not to decorate them",
      ],
      avoid: [
        "Cyberpunk decoration or neon color overload",
        "Dashboards made from many tiny cards",
        "Low-contrast gray body copy",
        "Showing code that is too small to discuss",
      ],
    },
    choices: {
      tones: ["dark", "signal"],
      emphases: ["thesis", "artifact", "system", "code"],
      densities: ["focused", "balanced"],
    },
  },
});

export default theme;

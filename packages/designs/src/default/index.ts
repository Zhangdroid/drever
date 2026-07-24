import { defineTheme } from "@drever/compiler";

const PACKAGE = "@drever/designs/default";

export const theme = defineTheme({
  kind: "theme",
  apiVersion: 1,
  id: PACKAGE,
  version: "0.0.0",
  compilerTargets: ["canonical", "browser-lite"],
  canvas: { width: 1600, height: 900 },
  tokens: {
    color: {
      canvas: "#f7f7f2",
      ink: "#171816",
      muted: "#62665f",
      accent: "#2855e7",
      accentStrong: "#1538a8",
      accentSoft: "#dce5ff",
      surface: "#ffffff",
      border: "#d9dcd4",
      codeCanvas: "#171a22",
      codeInk: "#f5f6f8",
    },
    typography: {
      display: "ui-sans-serif, system-ui, sans-serif",
      body: "ui-sans-serif, system-ui, sans-serif",
      mono: "ui-monospace, SFMono-Regular, monospace",
      titleSize: 76,
      bodySize: 28,
    },
    space: {
      slideX: 112,
      slideY: 88,
      rhythm: 24,
    },
    shape: {
      radius: 24,
      borderWidth: 2,
    },
    motion: {
      duration: 380,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
  },
  styles: [{ specifier: `${PACKAGE}/theme.css`, layer: "theme" }],
  motion: {
    id: "default",
    intents: ["focus", "replace", "compare", "stagger", "continuity"],
    guidance: [
      "Use focus to keep prior evidence visible while making the current Step unmistakable.",
      "Use replace for one changing state, compare for cumulative evidence, and stagger for at most four tightly related items.",
      "Set flow to block for a vertical reading sequence and inline for a horizontal process or comparison; leave it unset when neither axis explains the content.",
      "Default motion uses clean fades and short spatial travel, keeping the content more prominent than the choreography.",
      "Reuse a continuity name only when the same visual object persists across adjacent slides.",
    ],
  },
  layouts: [
    {
      name: "Cover",
      module: { specifier: `${PACKAGE}/layouts`, exportName: "Cover" },
      description:
        "Open a presentation or major chapter with one concise title and restrained supporting context.",
      slots: [
        {
          name: "eyebrow",
          purpose: "An optional short category, event, or chapter label.",
          accepts: ["text"],
          maxItems: 1,
        },
        {
          name: "title",
          purpose: "The single dominant statement for the slide.",
          accepts: ["text"],
          required: true,
          maxItems: 1,
        },
        {
          name: "supporting",
          purpose: "One short sentence that adds context without repeating the title.",
          accepts: ["text"],
          maxItems: 1,
        },
        {
          name: "footer",
          purpose: "Optional speaker, organization, date, or section metadata.",
          accepts: ["text"],
          maxItems: 1,
        },
      ],
      variants: ["light", "dark", "accent"],
      constraints: {
        titleWords: { recommendedMaximum: 10 },
        supportingLines: { recommendedMaximum: 3 },
      },
      example:
        '<Cover eyebrow="Drever" title="Presentations can be software." supporting="Interactive, testable, and ready to ship." tone="accent" />',
    },
    {
      name: "TwoColumn",
      module: { specifier: `${PACKAGE}/layouts`, exportName: "TwoColumn" },
      description:
        "Place two related ideas side by side when their relationship is more important than either idea alone.",
      slots: [
        {
          name: "primary",
          purpose: "The first argument, explanation, or visual group.",
          accepts: ["text", "media", "code", "component"],
          required: true,
          maxItems: 1,
        },
        {
          name: "secondary",
          purpose: "The comparison, consequence, or complementary visual group.",
          accepts: ["text", "media", "code", "component"],
          required: true,
          maxItems: 1,
        },
      ],
      variants: ["equal", "wide-primary", "wide-secondary"],
      constraints: {
        nestedColumns: false,
        recommendedMaximumWordsPerColumn: 45,
      },
      example:
        "<TwoColumn primary={<><h2>Before</h2><p>Static output</p></>} secondary={<><h2>After</h2><p>Living interface</p></>} />",
    },
  ],
  manifest: {
    title: "Drever Default",
    summary: "A neutral visual baseline with generous space, clear typography, and focused motion.",
    artDirection: {
      keywords: ["neutral", "clear", "versatile", "calm"],
      principles: [
        "Give every slide one dominant idea",
        "Use scale and space before decoration",
        "Animate changes that clarify state or continuity",
        "Prefer a meaningful visual over a longer list",
      ],
      avoid: [
        "Dense walls of text",
        "More than two competing accent colors",
        "Decorative animation without narrative purpose",
        "Using a two-column layout when the ideas are unrelated",
      ],
    },
    choices: {
      tones: ["light", "dark", "accent"],
      emphases: ["typography", "comparison", "visual"],
      densities: ["airy", "balanced"],
    },
  },
});

export default theme;

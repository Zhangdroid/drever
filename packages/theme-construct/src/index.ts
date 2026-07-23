import { defineTheme } from "@drever/compiler";

const PACKAGE = "@drever/theme-construct";

export type ConstructRecipe = Readonly<{
  constraints: readonly string[];
  id: "concept-assembly" | "guided-explanation" | "participatory-prompt";
  layout: "Assembly" | "Markdown" | "Prompt";
  prompt: string;
  purpose: string;
}>;

/** Typed composition guidance for participatory and concept-building presentations. */
export const constructRecipes = [
  {
    id: "participatory-prompt",
    layout: "Prompt",
    purpose: "Pause a lesson, workshop, or onboarding flow around one question or concrete task.",
    prompt:
      "Ask one answerable question, add only the context needed to respond, and make the requested action explicit.",
    constraints: [
      "Use one question or task only",
      "Keep context under thirty words",
      "Keep the response cue under sixteen words",
    ],
  },
  {
    id: "concept-assembly",
    layout: "Assembly",
    purpose: "Show how two to four named parts combine into one mechanism, result, or conclusion.",
    prompt:
      "Name each part at the same level of abstraction, then state the result as the relationship the parts create together.",
    constraints: [
      "Use between two and four parts",
      "Keep each part under twenty words",
      "Do not use Assembly for unrelated categories",
    ],
  },
  {
    id: "guided-explanation",
    layout: "Markdown",
    purpose:
      "Explain a compact idea with a direct heading, short prose, and one meaningful sequence.",
    prompt:
      "Lead with the lesson, use one short example or list, and reserve the slide tone for the current concept category.",
    constraints: [
      "Keep prose under fifty-five words",
      "Use no more than four list items",
      "Use only one tone on a slide",
    ],
  },
] as const satisfies readonly ConstructRecipe[];

export const theme = defineTheme({
  kind: "theme",
  apiVersion: 1,
  id: PACKAGE,
  version: "0.0.0",
  compilerTargets: ["canonical", "browser-lite"],
  canvas: { width: 1600, height: 900 },
  tokens: {
    color: {
      canvas: "#fff7e8",
      ink: "#24222c",
      muted: "#615c68",
      accent: "#2466a8",
      accentStrong: "#194f84",
      accentSoft: "#dce9f4",
      coral: "#b33f48",
      coralStrong: "#8b2e37",
      coralSoft: "#f3ddda",
      green: "#2f7254",
      greenStrong: "#235b42",
      greenSoft: "#dce9df",
      yellow: "#f4c95d",
      yellowStrong: "#73530f",
      yellowSoft: "#faedc3",
      surface: "#fffdf8",
      border: "#d6cbb7",
      codeCanvas: "#24222c",
      codeInk: "#fff7e8",
    },
    typography: {
      display:
        "Bricolage Grotesque, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif",
      body: "Instrument Sans, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif",
      mono: "SFMono-Regular, Consolas, ui-monospace, monospace",
      titleSize: 78,
      bodySize: 27,
    },
    space: { slideX: 96, slideY: 72, rhythm: 22 },
    shape: { radius: 4, borderWidth: 2 },
    motion: { duration: 350, easing: "cubic-bezier(0.2, 0.9, 0.2, 1)" },
  },
  styles: [{ specifier: `${PACKAGE}/theme.css`, layer: "theme" }],
  motion: {
    id: "construct",
    intents: ["focus", "replace", "compare", "stagger", "continuity"],
    guidance: [
      "Use focus to shift the one concept block currently under discussion while prior blocks remain legible.",
      "Use replace when one part changes inside a stable footprint and compare when two parts must remain visible together.",
      "Use stagger for two to four pieces that assemble into one explanatory beat, never as confetti or decoration.",
      "Follow the authored construction order: block flow builds a stack and inline flow builds a sequence or combination.",
      "Use continuity only when the same labelled concept block genuinely persists across adjacent slides.",
    ],
  },
  layouts: [
    {
      name: "Prompt",
      module: { specifier: `${PACKAGE}/layouts`, exportName: "Prompt" },
      description:
        "Center a lesson, workshop, or onboarding moment on one answerable question or concrete task.",
      slots: [
        {
          name: "eyebrow",
          purpose: "A short lesson, activity, audience, or section label.",
          accepts: ["text"],
          maxItems: 1,
        },
        {
          name: "question",
          purpose: "The single question or task the audience should act on.",
          accepts: ["text"],
          required: true,
          maxItems: 1,
        },
        {
          name: "context",
          purpose: "Only the information needed to understand or answer the prompt.",
          accepts: ["text", "component"],
          maxItems: 1,
        },
        {
          name: "cue",
          purpose: "A concise instruction describing how the audience should respond.",
          accepts: ["text", "component"],
          maxItems: 1,
        },
        {
          name: "footer",
          purpose: "Optional timing, facilitation, speaker, or chapter context.",
          accepts: ["text"],
          maxItems: 1,
        },
      ],
      variants: ["left", "center"],
      constraints: {
        tones: ["blue", "coral", "green", "yellow"],
        toneComposesWithAlignment: true,
        questionWords: { recommendedMaximum: 13 },
        contextWords: { recommendedMaximum: 30 },
        cueWords: { recommendedMaximum: 16 },
      },
      example:
        '<Prompt eyebrow="Workshop / 02" question="What must remain true?" context="Change the interface without changing its public contract." cue="Write one invariant." tone="yellow" align="left" />',
    },
    {
      name: "Assembly",
      module: { specifier: `${PACKAGE}/layouts`, exportName: "Assembly" },
      description:
        "Join two to four explicitly related parts into one mechanism, result, or conclusion.",
      slots: [
        {
          name: "label",
          purpose: "A short lesson, mechanism, recipe, or section label.",
          accepts: ["text"],
          maxItems: 1,
        },
        {
          name: "title",
          purpose: "The relationship or mechanism being assembled.",
          accepts: ["text"],
          required: true,
          maxItems: 1,
        },
        {
          name: "parts",
          purpose: "Two to four peer inputs at the same conceptual level.",
          accepts: ["text", "component"],
          required: true,
          maxItems: 4,
        },
        {
          name: "result",
          purpose: "The mechanism, implication, or conclusion created by the parts together.",
          accepts: ["text", "component"],
          required: true,
          maxItems: 1,
        },
        {
          name: "caption",
          purpose: "Optional qualification, source, or instruction for reading the assembly.",
          accepts: ["text"],
          maxItems: 1,
        },
      ],
      variants: ["blue", "coral", "green", "yellow"],
      constraints: {
        partItems: { minimum: 2, recommendedMaximum: 4 },
        partWords: { recommendedMaximum: 20 },
        resultWords: { recommendedMaximum: 28 },
        peerRelationshipRequired: true,
      },
      example:
        '<Assembly label="Delivery contract" title="Three guarantees make one dependable release." parts={["Stable URLs", "Deterministic export", "Inspectable state"]} result={<strong>The artifact tested is the artifact shipped.</strong>} tone="green" />',
    },
  ],
  manifest: {
    title: "Drever Construct",
    summary:
      "A modular theme for teaching, facilitation, onboarding, and presentations that build understanding from explicit parts.",
    artDirection: {
      keywords: ["modular", "participatory", "clear", "constructive", "approachable"],
      principles: [
        "Give every block a named concept, step, or category",
        "Use one slide tone to preserve category and focus",
        "Show how parts connect instead of scattering cards",
        "Keep questions answerable and instructions concrete",
      ],
      avoid: [
        "Confetti, random shapes, or multicolor decoration",
        "Card grids whose items have no relationship",
        "Bouncy motion or playful effects without explanatory value",
        "Using color as the only category or state label",
      ],
    },
    choices: {
      tones: ["blue", "coral", "green", "yellow"],
      emphases: ["prompt", "assembly", "sequence", "lesson"],
      densities: ["open", "guided"],
    },
  },
});

export default theme;

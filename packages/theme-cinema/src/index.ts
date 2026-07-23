import { defineTheme } from "@drever/compiler";

const PACKAGE = "@drever/theme-cinema";

export type CinemaRecipe = Readonly<{
  constraints: readonly string[];
  id: "evidence-frame" | "opening-title-card" | "sequence-beats";
  layout: "Frame" | "Markdown" | "TitleCard";
  prompt: string;
  purpose: string;
}>;

/** Typed cinematic composition guidance that tools can consume without scraping prose. */
export const cinemaRecipes = [
  {
    id: "opening-title-card",
    layout: "TitleCard",
    purpose: "Open a story or chapter with one premise and a restrained credit line.",
    prompt: "Write a compact title, one-sentence logline, and only the context needed to begin.",
    constraints: [
      "Title at most eight words",
      "Logline at most twenty-two words",
      "Credit is one quiet line",
    ],
  },
  {
    id: "evidence-frame",
    layout: "Frame",
    purpose: "Hold one image, diagram, video, or artifact at a stable, legible frame geometry.",
    prompt:
      "Choose one visual that advances the story, then caption what the audience should notice.",
    constraints: [
      "One primary visual only",
      "Never crop merely for drama",
      "Caption at most eighteen words",
    ],
  },
  {
    id: "sequence-beats",
    layout: "Markdown",
    purpose: "Advance an explanation as a short sequence of cause, turn, and consequence.",
    prompt:
      "Write one scene-setting heading followed by no more than four concise narrative beats.",
    constraints: [
      "At most four sequence beats",
      "One sentence per beat",
      "Reveal in reading order",
    ],
  },
] as const satisfies readonly CinemaRecipe[];

export const theme = defineTheme({
  kind: "theme",
  apiVersion: 1,
  id: PACKAGE,
  version: "0.0.0",
  compilerTargets: ["canonical", "browser-lite"],
  canvas: { width: 1600, height: 900 },
  tokens: {
    color: {
      canvas: "#0b0b0c",
      ink: "#f3eee4",
      muted: "#aaa296",
      accent: "#e2a64a",
      accentStrong: "#e2a64a",
      accentSoft: "#44331f",
      surface: "#171719",
      border: "#4c4740",
      codeCanvas: "#070708",
      codeInk: "#eee9df",
      paper: "#e9dfce",
      paperInk: "#181617",
    },
    typography: {
      display: "Baskerville, Iowan Old Style, Palatino Linotype, Georgia, serif",
      body: "Aptos, Segoe UI, Helvetica Neue, Arial, ui-sans-serif, system-ui, sans-serif",
      mono: "SFMono-Regular, Consolas, Liberation Mono, ui-monospace, monospace",
      titleSize: 86,
      bodySize: 26,
    },
    space: { slideX: 104, slideY: 76, rhythm: 24 },
    shape: { radius: 1, borderWidth: 1 },
    motion: { duration: 360, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  },
  styles: [{ specifier: `${PACKAGE}/theme.css`, layer: "theme" }],
  motion: {
    id: "cinema",
    intents: ["focus", "replace", "compare", "stagger", "continuity"],
    guidance: [
      "Cinema motion is editorial cutting, not a default Ken Burns effect.",
      "Never scale, pan, or re-crop still media merely to make a slide feel cinematic.",
      "Keep frame bounds, object-fit, aspect ratio, and crop invariant while captions or supporting text change.",
      "Prefer short dissolves and directional edge reveals; stagger only beats that form a deliberate sequence.",
      "Use continuity only when the same media object carries forward with identical geometry and crop.",
    ],
  },
  layouts: [
    {
      name: "TitleCard",
      module: { specifier: `${PACKAGE}/layouts`, exportName: "TitleCard" },
      description:
        "Open a talk, act, or chapter with a cinematic title, compact logline, and restrained credit.",
      slots: [
        {
          name: "eyebrow",
          purpose: "An act, chapter, place, date, or category cue.",
          accepts: ["text"],
          maxItems: 1,
        },
        {
          name: "title",
          purpose: "The title-card statement.",
          accepts: ["text"],
          required: true,
          maxItems: 1,
        },
        {
          name: "logline",
          purpose: "One sentence that establishes tension, premise, or direction.",
          accepts: ["text"],
          maxItems: 1,
        },
        {
          name: "credit",
          purpose: "Speaker, organization, date, or other quiet production context.",
          accepts: ["text"],
          maxItems: 1,
        },
      ],
      variants: ["center", "left"],
      constraints: {
        tones: ["night", "paper"],
        titleWords: { recommendedMaximum: 8 },
        loglineWords: { recommendedMaximum: 22 },
        titleCardIsNotBodySlide: true,
      },
      example:
        '<TitleCard eyebrow="Act I / The Interface" title="Every state deserves a URL." logline="Presentations become software when their structure survives the stage." credit="Drever · 2026" />',
    },
    {
      name: "Frame",
      module: { specifier: `${PACKAGE}/layouts`, exportName: "Frame" },
      description:
        "Present one media artifact inside a stable widescreen or academy frame with an explanatory caption.",
      slots: [
        {
          name: "media",
          purpose: "One image, chart, diagram, video, or interactive artifact.",
          accepts: ["media", "component", "code"],
          required: true,
          maxItems: 1,
        },
        {
          name: "heading",
          purpose: "A short cue that states what the frame demonstrates.",
          accepts: ["text"],
          maxItems: 1,
        },
        {
          name: "caption",
          purpose: "The observation or source needed to interpret the artifact.",
          accepts: ["text"],
          maxItems: 1,
        },
        {
          name: "credit",
          purpose: "A source, timestamp, or artifact identifier.",
          accepts: ["text"],
          maxItems: 1,
        },
      ],
      variants: ["widescreen", "academy"],
      constraints: {
        captionWords: { recommendedMaximum: 18 },
        cropChangesAcrossSteps: false,
        mediaObjectFit: "contain",
        primaryVisuals: { maximum: 1 },
      },
      example:
        '<Frame heading="The route is the state." media={<Diagram />} caption="A stable URL identifies one exact presentation moment." credit="Runtime model / 04" ratio="academy" />',
    },
  ],
  manifest: {
    title: "Drever Cinema",
    summary:
      "A projection-dark narrative theme built around title cards, stable media frames, captions, and deliberate editorial cuts.",
    artDirection: {
      keywords: ["cinematic", "narrative", "projection", "title-card", "evidence-frame"],
      principles: [
        "Make every slide advance a scene, argument, or reveal",
        "Use title cards only at genuine story boundaries",
        "Keep visual artifacts geometrically stable and fully legible",
        "Build drama through hierarchy, pacing, and contrast rather than effects",
      ],
      avoid: [
        "Default Ken Burns motion on still media",
        "Fake film grain, sprocket holes, or decorative clapperboard motifs",
        "Letterboxing content that already has a meaningful aspect ratio",
        "Using a hero image as atmosphere when it provides no evidence",
      ],
    },
    choices: {
      tones: ["night", "paper"],
      emphases: ["premise", "sequence", "artifact", "caption"],
      densities: ["spare", "balanced"],
    },
  },
});

export default theme;

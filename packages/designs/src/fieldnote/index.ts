import { defineTheme } from "@drever/compiler";
import { CJK_HANDWRITTEN_FONT_STACKS } from "../cjk-typography.ts";

const PACKAGE = "@drever/designs/fieldnote";

export type FieldnoteRecipe = Readonly<{
  constraints: readonly string[];
  id: "annotated-evidence" | "guided-sequence" | "opening-notebook";
  layout: "Annotated" | "Markdown" | "Notebook";
  prompt: string;
  purpose: string;
}>;

/** Typed composition guidance for people and tools that import the package directly. */
export const fieldnoteRecipes = [
  {
    id: "opening-notebook",
    layout: "Notebook",
    purpose: "Open a lesson, workshop, reflection, or chapter with one memorable thought.",
    prompt: "Write a short handwritten title, then one plain-language note that makes it useful.",
    constraints: ["Title at most 10 words", "Note at most 24 words", "No list or extra panel"],
  },
  {
    id: "annotated-evidence",
    layout: "Annotated",
    purpose:
      "Explain one sketch, image, chart, artifact, or worked example with direct annotations.",
    prompt: "Make the evidence dominant and attach only notes that explain a visible detail.",
    constraints: ["One evidence object", "At most three annotations", "Each note names its target"],
  },
  {
    id: "guided-sequence",
    layout: "Markdown",
    purpose: "Teach a compact process in the same order someone would write or perform it.",
    prompt: "Use one short list or Step sequence and preserve the natural writing order.",
    constraints: ["At most four items", "No nested list", "One active emphasis"],
  },
] as const satisfies readonly FieldnoteRecipe[];

export const theme = defineTheme({
  kind: "theme",
  apiVersion: 1,
  id: PACKAGE,
  version: "0.0.0",
  compilerTargets: ["canonical", "browser-lite"],
  canvas: { width: 1600, height: 900 },
  tokens: {
    color: {
      canvas: "#fbfaf4",
      ink: "#26231e",
      muted: "#696153",
      accent: "#275f96",
      accentStrong: "#184875",
      accentSoft: "#dce8ef",
      annotation: "#9e3b32",
      surface: "#fffefa",
      border: "#ddd6c5",
      codeCanvas: "#24323a",
      codeInk: "#f8f4e8",
    },
    typography: {
      display: "Caveat, Bradley Hand, Segoe Print, cursive",
      body: "Caveat, Bradley Hand, Segoe Print, cursive",
      mono: "SFMono-Regular, Consolas, ui-monospace, monospace",
      titleSize: 88,
      bodySize: 30,
      cjk: {
        handwritten: CJK_HANDWRITTEN_FONT_STACKS,
        titleLineHeight: 1.15,
        bodyLineHeight: 1.5,
      },
    },
    space: { slideX: 108, slideY: 82, rhythm: 24 },
    shape: { radius: 5, borderWidth: 1 },
    motion: { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  },
  styles: [{ specifier: `${PACKAGE}/theme.css`, layer: "theme" }],
  motion: {
    id: "fieldnote",
    intents: ["focus", "replace", "compare", "stagger", "continuity"],
    guidance: [
      "Use focus to move attention through notes in the same order a person would write or discuss them.",
      "Use replace only when one sketch, answer, or worked state changes inside a stable paper frame.",
      "Use compare for evidence that must remain visible and stagger for no more than four parts of one explanation.",
      "Fieldnote uses quiet page cuts and occasional annotation reveals along the writing axis, never simulated handwriting across whole paragraphs.",
      "Share continuity only when the same note, sketch, image, or worked object persists across adjacent pages; the notebook should not become a fixed two-column template.",
    ],
  },
  layouts: [
    {
      name: "Notebook",
      module: { specifier: `${PACKAGE}/layouts`, exportName: "Notebook" },
      description:
        "Open a lesson, workshop, personal story, or chapter with one handwritten conclusion and quiet context.",
      slots: [
        {
          name: "eyebrow",
          purpose: "A short date, chapter, session, or topic label.",
          accepts: ["text"],
          maxItems: 1,
        },
        {
          name: "title",
          purpose: "The single handwritten thought the audience should remember.",
          accepts: ["text"],
          required: true,
          maxItems: 1,
        },
        {
          name: "note",
          purpose: "One plain-language sentence that makes the title concrete.",
          accepts: ["text"],
          maxItems: 1,
        },
        {
          name: "footer",
          purpose: "Optional author, class, team, or session context.",
          accepts: ["text"],
          maxItems: 1,
        },
      ],
      variants: ["paper", "blue"],
      constraints: {
        noteWords: { recommendedMaximum: 24 },
        titleWords: { recommendedMaximum: 10 },
      },
      example:
        '<Notebook eyebrow="Workshop · 01" title="Start with what changed." note="The useful story begins where the audience must see the situation differently." footer="Field notes" />',
    },
    {
      name: "Annotated",
      module: { specifier: `${PACKAGE}/layouts`, exportName: "Annotated" },
      description:
        "Place one visible artifact beside a bounded set of annotations that explain exact details.",
      slots: [
        {
          name: "heading",
          purpose: "The conclusion the evidence and notes collectively support.",
          accepts: ["text"],
          required: true,
          maxItems: 1,
        },
        {
          name: "evidence",
          purpose: "One sketch, image, chart, diagram, code sample, or worked example.",
          accepts: ["media", "code", "component"],
          required: true,
          maxItems: 1,
        },
        {
          name: "annotations",
          purpose: "Up to three notes that each name a visible target in the evidence.",
          accepts: ["text", "component"],
          required: true,
          maxItems: 3,
        },
        {
          name: "caption",
          purpose: "An optional source, interpretation, or evidence label.",
          accepts: ["text"],
          maxItems: 1,
        },
      ],
      variants: ["balanced", "evidence-led"],
      constraints: {
        annotations: { recommendedMaximum: 3 },
        annotationWords: { recommendedMaximum: 16 },
        nestedColumns: false,
      },
      example:
        '<Annotated heading="The gap appears at handoff." evidence={<ProcessSketch />} annotations={<ol><li>The decision loses an owner.</li><li>The artifact loses context.</li></ol>} caption="Workshop synthesis" />',
    },
  ],
  manifest: {
    title: "Drever Fieldnote",
    summary:
      "A coherent handwritten theme for workshops, lessons, tutorials, reflections, and early ideas.",
    artDirection: {
      keywords: ["handwritten", "instructional", "warm", "reflective", "direct"],
      principles: [
        "Carry one handwritten type voice through headings, body copy, labels, annotations, and data",
        "Keep the near-white paper field quiet enough to disappear behind the written content",
        "Attach every annotation to a visible idea or artifact",
        "Reserve monospace only for literal code, where the content requires it",
      ],
      avoid: [
        "Coffee stains, tape, random rotation, or decorative doodles",
        "Dense paragraphs that use handwriting as texture instead of editing the thought",
        "More than three annotations around one object",
        "Animation that pretends to write every glyph",
      ],
    },
    choices: {
      tones: ["paper", "blue"],
      emphases: ["lesson", "annotation", "process", "reflection"],
      densities: ["airy", "balanced"],
    },
  },
});

export default theme;

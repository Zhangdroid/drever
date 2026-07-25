import { defineTheme } from "@drever/compiler";

const PACKAGE = "@drever/designs/editorial";

export type EditorialRecipe = Readonly<{
  constraints: readonly string[];
  id: "evidence-feature" | "opening-masthead" | "reported-argument";
  layout: "Feature" | "Masthead" | "Markdown";
  prompt: string;
  purpose: string;
}>;

/** Typed composition guidance that tools can consume without scraping prose documentation. */
export const editorialRecipes = [
  {
    id: "opening-masthead",
    layout: "Masthead",
    purpose: "Open a talk or chapter with the confidence and hierarchy of a magazine cover.",
    prompt: "Write one memorable headline, one sentence of deck copy, and a quiet line of context.",
    constraints: ["Headline at most 11 words", "Deck at most 24 words", "No extra body copy"],
  },
  {
    id: "evidence-feature",
    layout: "Feature",
    purpose: "Pair one explained claim with one image, chart, diagram, or artifact.",
    prompt: "Lead with the conclusion; use the visual as evidence rather than decoration.",
    constraints: ["One visual", "Body at most 55 words", "Caption at most 16 words"],
  },
  {
    id: "reported-argument",
    layout: "Markdown",
    purpose: "Develop an argument through a title, compact prose, and a short list or quotation.",
    prompt: "Use editorial rhythm: claim, evidence, implication.",
    constraints: ["At most one list", "At most four list items", "Avoid nested lists"],
  },
] as const satisfies readonly EditorialRecipe[];

export const theme = defineTheme({
  kind: "theme",
  apiVersion: 1,
  id: PACKAGE,
  version: "0.0.0",
  compilerTargets: ["canonical", "browser-lite"],
  canvas: { width: 1600, height: 900 },
  tokens: {
    color: {
      canvas: "#f3efe4",
      ink: "#191814",
      muted: "#686157",
      accent: "#9d302f",
      accentSoft: "#ead7cc",
      surface: "#fffaf0",
      border: "#cfc7b8",
      codeCanvas: "#25231f",
      codeInk: "#f7f0e3",
    },
    typography: {
      display: "Iowan Old Style, Palatino Linotype, Book Antiqua, Georgia, serif",
      body: "Aptos, Inter, ui-sans-serif, system-ui, sans-serif",
      mono: "SFMono-Regular, Consolas, ui-monospace, monospace",
      titleSize: 82,
      bodySize: 27,
    },
    space: { slideX: 108, slideY: 82, rhythm: 24 },
    shape: { radius: 2, borderWidth: 1 },
    motion: { duration: 420, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
  },
  styles: [{ specifier: `${PACKAGE}/theme.css`, layer: "theme" }],
  motion: {
    id: "editorial",
    intents: ["focus", "replace", "compare", "stagger", "continuity"],
    guidance: [
      "Prefer focus and compare when the audience should retain the argument's reading order.",
      "Use replace for a revised claim or artifact, and stagger no more than four related details.",
      "Follow editorial reading order: use block flow for stacked evidence and inline flow for a page-like revision or side-by-side argument.",
      "Editorial alternates direct page cuts with a separated reading-edge reveal so the previous thought clears before the next becomes legible.",
      "Use continuity only for an image, quotation, or artifact that genuinely carries into the next slide; never keep a side artifact solely to repeat the layout.",
    ],
  },
  layouts: [
    {
      name: "Masthead",
      module: { specifier: `${PACKAGE}/layouts`, exportName: "Masthead" },
      description:
        "Open a talk or major chapter with a publication-style headline, short deck, and quiet metadata.",
      slots: [
        {
          name: "kicker",
          purpose: "A short section, issue, event, or category label.",
          accepts: ["text"],
          maxItems: 1,
        },
        {
          name: "title",
          purpose: "The single editorial headline.",
          accepts: ["text"],
          required: true,
          maxItems: 1,
        },
        {
          name: "deck",
          purpose: "One sentence that sharpens or qualifies the headline.",
          accepts: ["text"],
          maxItems: 1,
        },
        {
          name: "meta",
          purpose: "Speaker, date, organization, or chapter context.",
          accepts: ["text"],
          maxItems: 1,
        },
      ],
      variants: ["left", "center"],
      constraints: {
        toneComposesWithAlignment: true,
        tones: ["paper", "ink"],
        titleWords: { recommendedMaximum: 11 },
        deckWords: { recommendedMaximum: 24 },
      },
      example:
        '<Masthead kicker="Field notes / Spring 2026" title="The city after quiet hours." deck="A visual essay on how night transit changes the shape of public life." meta="Issue 01 · Urban rhythms" />',
    },
    {
      name: "Feature",
      module: { specifier: `${PACKAGE}/layouts`, exportName: "Feature" },
      description:
        "Pair one concise argument with one visual artifact when the visual provides evidence for the claim.",
      slots: [
        {
          name: "heading",
          purpose: "The conclusion or claim, written as a short heading.",
          accepts: ["text"],
          required: true,
          maxItems: 1,
        },
        {
          name: "body",
          purpose: "Compact explanation, evidence, or implications.",
          accepts: ["text", "code", "component"],
          required: true,
          maxItems: 1,
        },
        {
          name: "visual",
          purpose: "One image, chart, diagram, video, or interactive artifact.",
          accepts: ["media", "component", "code"],
          required: true,
          maxItems: 1,
        },
        {
          name: "caption",
          purpose: "A source or interpretation that makes the visual self-contained.",
          accepts: ["text"],
          maxItems: 1,
        },
      ],
      variants: ["balanced", "text-led", "visual-led"],
      constraints: {
        bodyWords: { recommendedMaximum: 55 },
        captionWords: { recommendedMaximum: 16 },
        nestedColumns: false,
      },
      example:
        '<Feature heading="Interfaces explain change." body={<p>Motion should preserve context, not decorate navigation.</p>} visual={<Diagram />} caption="Named transition groups" balance="visual-led" />',
    },
  ],
  manifest: {
    title: "Drever Editorial",
    summary:
      "A warm publication-led theme for narrative talks, product stories, essays, and evidence-rich presentations.",
    artDirection: {
      keywords: ["editorial", "warm", "literary", "considered", "evidence-led"],
      principles: [
        "Write headlines with a point of view",
        "Create hierarchy with typography and rules, not ornament",
        "Treat images and data as evidence",
        "Let warm paper and generous margins slow the reading rhythm",
      ],
      avoid: [
        "Generic corporate slogans",
        "Centered layouts for ordinary content slides",
        "More than one major visual per slide",
        "Decorative gradients, glass effects, or rounded card grids",
      ],
    },
    choices: {
      tones: ["paper", "ink"],
      emphases: ["headline", "narrative", "evidence", "quotation"],
      densities: ["airy", "balanced"],
    },
  },
});

export default theme;

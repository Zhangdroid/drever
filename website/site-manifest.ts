export const siteOrigin = "https://drever.dev";

export const canonicalSiteURL = (path: string): string => {
  const url = new URL(path, siteOrigin);
  if (url.pathname !== "/" && !url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }
  return url.href;
};

export const documentationRoutes = [
  "/docs",
  "/docs/getting-started",
  "/docs/configuration",
  "/docs/authoring",
  "/docs/motion",
  "/docs/themes",
  "/docs/plugins",
  "/docs/presenting",
  "/docs/delivery",
  "/docs/ai",
  "/docs/credits",
] as const;

export const siteRoutes = [
  "/",
  "/changelog",
  ...documentationRoutes,
  "/showcase",
  "/release-smoke",
] as const;

export const demoMounts = [
  {
    description:
      "A launch decision shaped with AI, directed by the room, grounded in proof, and kept useful afterward.",
    id: "product",
    label: "Product tour",
    slug: "product",
    source: "product-tour",
  },
  {
    description: "Live MDX, GFM, code, math, charts, media, React, and complete delivery surfaces.",
    id: "features",
    label: "Feature gallery",
    slug: "features",
    source: "feature-gallery",
  },
  {
    description:
      "Story-led motion for evidence, context, semantic change, causality, data, and spatial ideas.",
    id: "motion",
    label: "Motion stories",
    slug: "motion",
    source: "motion-recipes",
  },
  {
    description: "An incubating study where nearby sound moves a persistent lime-and-violet Stage.",
    id: "scenes",
    label: "Room Sense",
    slug: "scenes",
    source: "room-scenes",
  },
  {
    description:
      "A technical tour through compilation, routing, extensions, runtime surfaces, and delivery.",
    id: "architecture",
    label: "Architecture",
    slug: "architecture",
    source: "architecture",
  },
  {
    description:
      "The smallest complete project for learning slide boundaries, Steps, and delivery.",
    id: "basic",
    label: "Minimal reference",
    slug: "basic",
    source: "basic",
  },
] as const;

export const designStudyMounts = [
  {
    description:
      "A calm decision brief that turns a fragmented week into one bounded team experiment.",
    id: "basic",
    label: "Basic design study",
    output: "dist/basic",
    slug: "design/basic",
    source: "theme-showcase",
  },
  {
    description:
      "An editorial civic-service story that follows one late-hour demand signal into a measured pilot.",
    id: "editorial",
    label: "Editorial design study",
    output: "dist/editorial",
    slug: "design/editorial",
    source: "theme-showcase",
  },
  {
    description:
      "A technical trace that follows one slow request across system boundaries to a verified fix.",
    id: "studio",
    label: "Studio design study",
    output: "dist/studio",
    slug: "design/studio",
    source: "theme-showcase",
  },
  {
    description:
      "A research debrief that turns observed hesitation into a precise, annotated recommendation.",
    id: "fieldnote",
    label: "Fieldnote design study",
    output: "dist/fieldnote",
    slug: "design/fieldnote",
    source: "theme-showcase",
  },
  {
    description:
      "A spatial restoration story that connects river evidence, interventions, and progression.",
    id: "atlas",
    label: "Atlas design study",
    output: "dist/atlas",
    slug: "design/atlas",
    source: "theme-showcase",
  },
  {
    description:
      "An accountable product review that traces one metric from evidence to a bounded decision.",
    id: "ledger",
    label: "Ledger design study",
    output: "dist/ledger",
    slug: "design/ledger",
    source: "theme-showcase",
  },
  {
    description:
      "A restrained, media-led service story about restoring the final hour of a city bus route.",
    id: "cinema",
    label: "Cinema design study",
    output: "dist/cinema",
    slug: "design/cinema",
    source: "theme-showcase",
  },
  {
    description:
      "A modular workshop that assembles a reliable handoff from concrete, testable parts.",
    id: "construct",
    label: "Construct design study",
    output: "dist/construct",
    slug: "design/construct",
    source: "theme-showcase",
  },
] as const;

export const publicPresentationMounts = [...demoMounts, ...designStudyMounts] as const;

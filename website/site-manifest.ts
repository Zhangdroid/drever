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

export const siteRoutes = ["/", ...documentationRoutes, "/demos", "/themes"] as const;

export const demoMounts = [
  {
    description:
      "A complete story of creating, directing, sharing, and keeping a presentation useful.",
    id: "product",
    label: "Product tour",
    slug: "product",
    source: "product-tour",
  },
  {
    description: "Live MDX, React, LaTeX, code highlighting, Tailwind CSS, and delivery surfaces.",
    id: "features",
    label: "Feature gallery",
    slug: "features",
    source: "feature-gallery",
  },
  {
    description:
      "Practical recipes for continuity, focus, replacement, comparison, and stable geometry.",
    id: "motion",
    label: "Motion field notes",
    slug: "motion",
    source: "motion-recipes",
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

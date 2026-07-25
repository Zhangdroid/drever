import { demoMounts } from "../site-manifest";

export const primaryNavigation = [
  { href: "/showcase/", label: "Showcase" },
  { href: "/docs/", label: "Docs" },
] as const;

export const documentationNavigation = [
  {
    label: "Start",
    pages: [
      { href: "/docs/", label: "Overview" },
      { href: "/docs/getting-started/", label: "Getting started" },
      { href: "/docs/configuration/", label: "Configuration" },
      { href: "/docs/ai/", label: "AI workflows" },
    ],
  },
  {
    label: "Create",
    pages: [
      { href: "/docs/authoring/", label: "Authoring slides" },
      { href: "/docs/motion/", label: "Motion" },
      { href: "/docs/themes/", label: "Art direction" },
      { href: "/docs/plugins/", label: "Plugins" },
    ],
  },
  {
    label: "Present & deliver",
    pages: [
      { href: "/docs/presenting/", label: "Presenting" },
      { href: "/docs/delivery/", label: "Build, deploy, and export" },
    ],
  },
  {
    label: "About",
    pages: [{ href: "/docs/credits/", label: "Credits" }],
  },
] as const;

const demoContent = {
  product: {
    meta: "Editorial · 12 slides",
  },
  features: {
    meta: "Studio · 14 slides",
  },
  motion: {
    meta: "Editorial · 16 slides",
  },
  scenes: {
    meta: "Incubating source study · 4 slides",
  },
  architecture: {
    meta: "Studio · 11 slides",
  },
  basic: {
    meta: "Default · 5 slides",
  },
} as const;

export const demos = demoMounts.map(({ description, id, label, slug }) => ({
  ...demoContent[id],
  description,
  href: `/showcase/${slug}/`,
  id,
  label,
}));

export const themes = [
  {
    description:
      "A clear, adaptable system for everyday stories, product reviews, lessons, and proposals.",
    id: "default",
    label: "Default",
    liveHref: "/showcase/basic/",
    statement: "Clear, spacious, ready for almost any story.",
    voice: "Direct · calm · versatile",
  },
  {
    description:
      "Typographic pacing and warm editorial structure for narratives that need a point of view.",
    id: "editorial",
    label: "Editorial",
    liveHref: "/showcase/product/",
    statement: "A point of view, set in type.",
    voice: "Measured · literary · assured",
  },
  {
    description:
      "A precise dark canvas for systems, technical arguments, product architecture, and data.",
    id: "studio",
    label: "Studio",
    liveHref: "/showcase/features/",
    statement: "Let the artifact take the stage.",
    voice: "Technical · focused · exact",
  },
  {
    description:
      "Quiet paper and one coherent handwritten voice for workshops, lessons, tutorials, and reflection.",
    id: "fieldnote",
    label: "Fieldnote",
    liveHref: "/showcase/design/fieldnote/",
    statement: "Think in ink, explain in plain language.",
    voice: "Warm · handwritten · instructional",
  },
  {
    description:
      "Routes, coordinates, and evidence frames for strategy, history, travel, systems, and change over time.",
    id: "atlas",
    label: "Atlas",
    liveHref: "/showcase/design/atlas/",
    statement: "Show where the story is going.",
    voice: "Spatial · exploratory · grounded",
  },
  {
    description:
      "A rigorous grid for metrics, policy, financial results, research findings, and traceable decisions.",
    id: "ledger",
    label: "Ledger",
    liveHref: "/showcase/design/ledger/",
    statement: "Make the number answerable.",
    voice: "Analytical · sober · accountable",
  },
  {
    description:
      "A dark, media-led canvas for photography, portfolios, case studies, and visual product stories.",
    id: "cinema",
    label: "Cinema",
    liveHref: "/showcase/design/cinema/",
    statement: "Let one image carry the moment.",
    voice: "Immersive · restrained · narrative",
  },
  {
    description:
      "Purposeful building blocks for teaching, collaborative prompts, product concepts, and clear explanations.",
    id: "construct",
    label: "Construct",
    liveHref: "/showcase/design/construct/",
    statement: "Build the explanation from real parts.",
    voice: "Modular · lively · explanatory",
  },
] as const;

export type ThemeId = (typeof themes)[number]["id"];

export const githubURL = "https://github.com/Zhangdroid/drever";

export const primaryNavigation = [
  { href: "/docs", label: "Docs" },
  { href: "/demos", label: "Demos" },
  { href: "/themes", label: "Themes" },
] as const;

export const documentationNavigation = [
  {
    label: "Start",
    pages: [
      { href: "/docs", label: "Overview" },
      { href: "/docs/getting-started", label: "Getting started" },
      { href: "/docs/configuration", label: "Configuration" },
      { href: "/docs/ai", label: "AI workflows" },
    ],
  },
  {
    label: "Create",
    pages: [
      { href: "/docs/authoring", label: "Authoring slides" },
      { href: "/docs/motion", label: "Motion" },
      { href: "/docs/themes", label: "Themes" },
      { href: "/docs/plugins", label: "Plugins" },
    ],
  },
  {
    label: "Present & deliver",
    pages: [
      { href: "/docs/presenting", label: "Presenting" },
      { href: "/docs/delivery", label: "Build and export" },
    ],
  },
] as const;

const demoContent = {
  product: {
    meta: "Editorial · 11 slides",
  },
  features: {
    meta: "Studio · 9 slides",
  },
  motion: {
    meta: "Editorial · 15 slides",
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
  href: `/demos/${slug}/`,
  id,
  label,
}));

export const themes = [
  {
    description:
      "A clear, adaptable system for everyday stories, product reviews, lessons, and proposals.",
    id: "default",
    label: "Default",
    packageName: "@drever/theme-default",
    voice: "Direct · calm · versatile",
  },
  {
    description:
      "Typographic pacing and warm editorial structure for narratives that need a point of view.",
    id: "editorial",
    label: "Editorial",
    packageName: "@drever/theme-editorial",
    voice: "Measured · literary · assured",
  },
  {
    description:
      "A precise dark canvas for systems, technical arguments, product architecture, and data.",
    id: "studio",
    label: "Studio",
    packageName: "@drever/theme-studio",
    voice: "Technical · focused · exact",
  },
] as const;

export const githubURL = "https://github.com/Zhangdroid/drever";
import { demoMounts } from "../site-manifest";

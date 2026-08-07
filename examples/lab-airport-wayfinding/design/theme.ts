import { defineTheme } from "drever";

export default defineTheme({
  kind: "theme",
  apiVersion: 1,
  id: "local.calm-route-system",
  baseURL: import.meta.url,
  tokens: {
    color: {
      canvas: "#0b1f33",
      ink: "#f7f4ea",
      accent: "#ffd34e",
    },
    typography: {
      display: "Inter, ui-sans-serif, system-ui, sans-serif",
      body: "Inter, ui-sans-serif, system-ui, sans-serif",
      mono: "ui-monospace, SFMono-Regular, monospace",
    },
    spacing: {
      safe: 56,
      slideX: 96,
      slideY: 72,
      rhythm: 24,
    },
    shape: {
      radius: 0,
      line: 2,
    },
    motion: {
      duration: 520,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
  },
  styles: [{ specifier: "./theme.css", layer: "theme" }],
  manifest: {
    title: "Calm route system",
    summary:
      "A local wayfinding system that turns attention constraints into clear routes and decisions.",
    artDirection: {
      keywords: ["wayfinding", "high-contrast", "directional", "calm-under-pressure"],
      principles: [
        "One destination and one navigable relationship per scene",
        "Use route geometry as explanatory evidence",
        "Keep every endpoint readable without motion",
      ],
      avoid: [
        "Airport-brand imitation",
        "Decorative arrows without destinations",
        "Motion on unrelated edges",
        "Microcopy used as texture",
      ],
    },
  },
});

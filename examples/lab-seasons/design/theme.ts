import { defineTheme } from "drever";

export default defineTheme({
  kind: "theme",
  apiVersion: 1,
  id: "local.seasons-geometry",
  baseURL: import.meta.url,
  tokens: {
    color: {
      canvas: "#071522",
      ink: "#f5f1e8",
      accent: "#ffca56",
      quiet: "#acc2ce",
      cool: "#82b8ff",
      surface: "#0d2436",
    },
    typography: {
      display: "Inter, ui-sans-serif, system-ui, sans-serif",
      body: "Inter, ui-sans-serif, system-ui, sans-serif",
      mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
    },
    space: {
      safeArea: 72,
      slideInset: 96,
      panelPadding: 32,
      rhythm: 24,
    },
    shape: {
      panelRadius: 22,
      chipRadius: 999,
    },
    motion: {
      duration: 620,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
  },
  styles: [{ specifier: "./theme.css", layer: "theme" }],
  manifest: {
    title: "Seasons: Geometry of Light",
    summary:
      "A local astronomy-notebook system that makes axial tilt, light angle, and daylight duration visible.",
    artDirection: {
      keywords: ["astronomy", "causal", "schematic", "classroom"],
      principles: [
        "Make geometry—not decoration—the strongest visual evidence",
        "Use warm light and cool shadow as stable semantic signals",
        "Keep every settled state readable from a classroom projector",
      ],
      avoid: [
        "Exaggerated orbital distance",
        "Decorative stars competing with labels",
        "Motion without a causal or comparative job",
      ],
    },
  },
});

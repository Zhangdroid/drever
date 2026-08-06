import { defineTheme } from "@drever/compiler";

/** @internal Structural fallback for semantic MDX before a presentation owns an art direction. */
export const neutralTheme = defineTheme({
  kind: "theme",
  apiVersion: 1,
  id: "drever:neutral",
  compilerTargets: ["canonical", "browser-lite"],
  canvas: { width: 1_600, height: 900 },
  tokens: {
    color: {
      canvas: "#ffffff",
      ink: "#15171a",
    },
    typography: {
      display: "ui-sans-serif, system-ui, sans-serif",
      body: "ui-sans-serif, system-ui, sans-serif",
      mono: "ui-monospace, SFMono-Regular, monospace",
      titleSize: 72,
      bodySize: 28,
    },
    space: {
      slideX: 112,
      slideY: 88,
      rhythm: 24,
    },
    motion: {
      duration: 420,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
  },
  manifest: {
    title: "Drever Neutral",
    summary:
      "An undecorated, readable foundation used until the presentation selects or creates an art direction.",
  },
});

import { defineTheme } from "@drever/compiler";

const theme = defineTheme({
  kind: "theme",
  apiVersion: 1,
  id: "drever.example.architecture",
  version: "0.0.0",
  baseURL: import.meta.url,
  compilerTargets: ["canonical", "browser-lite"],
  canvas: { width: 1600, height: 900 },
  tokens: {
    color: {
      canvas: "#4935ad",
      canvasStart: "#4f3bc0",
      canvasEnd: "#402f9f",
      ink: "#ffffff",
      muted: "#c1b9f6",
      mutedStrong: "#ded9ff",
      signal: "#dbff4f",
      signalInk: "#21174f",
      surface: "#21164f",
      border: "#7668cc",
      codeCanvas: "#17103f",
      codeInk: "#f7f5ff",
      failure: "#ffc466",
    },
    typography: {
      display:
        "Bricolage Grotesque, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif",
      body: "Instrument Sans, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif",
      mono: "SFMono-Regular, Consolas, Liberation Mono, ui-monospace, monospace",
      titleSize: 76,
      bodySize: 26,
    },
    space: {
      slideX: 104,
      slideY: 82,
      rhythm: 22,
    },
    shape: {
      radius: 18,
      borderWidth: 1,
    },
    motion: {
      duration: 520,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
  },
  styles: [{ specifier: "./theme.css", layer: "theme" }],
  motion: {
    id: "living-build-graph",
    intents: ["focus", "replace", "compare", "stagger", "continuity"],
    guidance: [
      "Follow causality through one persistent build graph instead of introducing unrelated objects.",
      "Use focus to move one lime signal to the currently owned boundary.",
      "Use replace only when one semantic state changes inside an unchanged footprint.",
      "Use stagger for an authored pipeline or fan-out, never for decorative entrances.",
      "Use continuity only when the same node, route, or artifact persists across adjacent slides.",
      "Keep topology, type metrics, paint, and shadow geometry explicit at both transition endpoints.",
    ],
  },
  layouts: [],
  manifest: {
    title: "Drever Architecture",
    summary:
      "A violet living build graph for explaining how one semantic contract remains trustworthy across every presentation surface.",
    artDirection: {
      keywords: ["violet", "systemic", "graph-led", "precise", "continuous"],
      principles: [
        "Show architectural ownership as connected spatial relationships",
        "Use one lime signal to identify the current causal step",
        "Let white nodes carry meaning and lavender metadata provide context",
        "Keep the persistent field quieter than the foreground claim",
      ],
      avoid: [
        "Dashboard-like card grids",
        "Competing teal or blue accents",
        "Decorative movement without a causal role",
        "Code that is too small to discuss",
        "Background contrast that competes with content",
      ],
    },
    choices: {
      tones: ["system", "signal", "failure"],
      emphases: ["graph", "artifact", "route", "proof"],
      densities: ["focused", "technical"],
    },
  },
});

export default theme;

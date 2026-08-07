import { defineTheme } from "drever";

export default defineTheme({
  kind: "theme",
  apiVersion: 1,
  id: "local.riverton-route",
  baseURL: import.meta.url,
  tokens: {
    color: {
      canvas: "#f4f1e8",
      ink: "#152522",
      accent: "#0f766e",
      signal: "#d95d43",
      checkpoint: "#e3b93f",
    },
    typography: {
      display: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      body: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
    },
    space: {
      safeArea: 72,
      contentInset: 96,
      rhythm: 24,
    },
    shape: {
      panelRadius: 24,
      routeWidth: 8,
    },
    motion: {
      duration: 520,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
  },
  styles: [{ specifier: "./theme.css", layer: "theme" }],
  manifest: {
    title: "Riverton Route",
    summary: "A civic decision system built around a corridor, constraints, and review gates.",
    artDirection: {
      keywords: ["civic", "route-led", "evidence", "accountable"],
      principles: [
        "Let supplied evidence own the strongest visual marks",
        "Carry the route only while it advances the decision",
        "Keep forecasts visibly distinct from observed outcomes",
      ],
      avoid: [
        "Fabricated maps or transport data",
        "Decorative motion on every edge",
        "Tiny labels or low-contrast qualification text",
      ],
    },
  },
});

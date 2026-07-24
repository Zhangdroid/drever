import { defineConfig, type ThemeDefinition } from "drever";

const themeNames = ["fieldnote", "atlas", "ledger", "cinema", "construct"] as const;
type ThemeName = (typeof themeNames)[number];

const isThemeName = (value: string): value is ThemeName =>
  (themeNames as readonly string[]).includes(value);

const requestedTheme = (process.env.DREVER_THEME ?? "fieldnote").trim().toLowerCase();

if (!isThemeName(requestedTheme)) {
  throw new Error(
    `[theme-showcase] Unsupported DREVER_THEME "${requestedTheme}". Expected one of: ${themeNames.join(", ")}.`,
  );
}

const themeLoaders = {
  atlas: () => import("@drever/designs/atlas"),
  cinema: () => import("@drever/designs/cinema"),
  construct: () => import("@drever/designs/construct"),
  fieldnote: () => import("@drever/designs/fieldnote"),
  ledger: () => import("@drever/designs/ledger"),
} satisfies Record<ThemeName, () => Promise<{ default: ThemeDefinition }>>;

const selectedTheme = (await themeLoaders[requestedTheme]()).default;

export default defineConfig({
  build: {
    outDir: `dist/${requestedTheme}`,
  },
  entry: `decks/${requestedTheme}.mdx`,
  rehearsal: {
    targetDurationMinutes: 4,
  },
  server: {
    host: "127.0.0.1",
    port: 4326,
    strictPort: true,
  },
  theme: selectedTheme,
});

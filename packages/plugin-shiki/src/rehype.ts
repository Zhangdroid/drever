import rehypeShiki from "@shikijs/rehype";
import { defineRehypePlugin } from "@drever/plugin";

const configuredTheme = (
  config: Readonly<Record<string, unknown>>,
  key: "darkTheme" | "lightTheme",
  fallback: string,
): string => (typeof config[key] === "string" ? config[key] : fallback);

export default defineRehypePlugin(({ pluginConfig }) => [
  rehypeShiki,
  {
    defaultColor: "light-dark()",
    themes: {
      dark: configuredTheme(pluginConfig, "darkTheme", "github-dark"),
      light: configuredTheme(pluginConfig, "lightTheme", "github-light"),
    },
  },
]);

export { defineConfig } from "./config.ts";
export type {
  DreverBuildConfig,
  DreverCanvasConfig,
  DreverConfig,
  DreverConfigExport,
  DreverPluginUse,
  DreverServerConfig,
} from "./config.ts";

export { definePlugin, defineTheme } from "@drever/compiler";
export type {
  ComponentManifest,
  DeckManifest,
  DreverPlugin,
  LayoutDefinition,
  PluginConfigManifest,
  SlideManifest,
  SpeakerNote,
  ThemeDefinition,
} from "@drever/compiler";
export { MotionGroup, Note, Step } from "@drever/core";
export type { MotionGroupProps, NoteProps, StepProps, StepState } from "@drever/core";
export { shiki, shikiPlugin } from "@drever/plugin-shiki";
export type { ShikiOptions } from "@drever/plugin-shiki";
export { tailwindCss, tailwindCssPlugin } from "@drever/plugin-tailwindcss";
export type { TailwindCssOptions } from "@drever/plugin-tailwindcss";

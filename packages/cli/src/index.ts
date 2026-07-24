export { defineConfig } from "./config.ts";
export type {
  DreverBuildConfig,
  DreverCanvasConfig,
  DreverConfig,
  DreverConfigExport,
  DreverFocusHighlighterConfig,
  DreverFocusLaserConfig,
  DreverFocusPenConfig,
  DreverFocusToolsConfig,
  DreverPluginUse,
  DreverRehearsalConfig,
  DreverServerConfig,
  DreverStageConfig,
} from "./config.ts";

export { DREVER_AUTHORING_CONTEXT_VERSION, definePlugin, defineTheme } from "@drever/compiler";
export type {
  ComponentManifest,
  DeckManifest,
  DreverAuthoringContext,
  DreverAuthoringSlide,
  DreverPlugin,
  LayoutDefinition,
  PluginConfigManifest,
  SlideManifest,
  SpeakerNote,
  ThemeDefinition,
} from "@drever/compiler";
export { MotionGroup, Note, SlideTransition, Step } from "@drever/core";
export type {
  MotionFlow,
  MotionGroupProps,
  MotionIntent,
  NoteProps,
  SlideTransitionProps,
  StepProps,
  StepState,
} from "@drever/core";
export { useStage } from "@drever/client";
export type { StageComponents, StageLayerComponent, StageLayerProps } from "@drever/client";
export { shiki, shikiPlugin } from "@drever/plugin-shiki";
export type { ShikiOptions } from "@drever/plugin-shiki";
export { tailwindCss, tailwindCssPlugin } from "@drever/plugin-tailwindcss";
export type { TailwindCssOptions } from "@drever/plugin-tailwindcss";

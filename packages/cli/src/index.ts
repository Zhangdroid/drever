export { defineConfig } from "./config.ts";
export type {
  DreverBuildConfig,
  DreverCanvasConfig,
  DreverConfig,
  DreverConfigExport,
  DreverDeckConfig,
  DreverDeckSocialConfig,
  DreverFocusHighlighterConfig,
  DreverFocusLaserConfig,
  DreverFocusPenConfig,
  DreverFocusToolsConfig,
  DreverPluginUse,
  DreverRehearsalConfig,
  DreverServerConfig,
  DreverStageConfig,
} from "./config.ts";

export {
  DECK_PREFLIGHT_VERSION,
  DREVER_AUTHORING_CONTEXT_VERSION,
  RENDERED_PREFLIGHT_RULESET_VERSION,
  RENDERED_PREFLIGHT_VERSION,
  definePlugin,
  defineTheme,
} from "@drever/compiler";
export type {
  ComponentManifest,
  DeckManifest,
  DeckPreflightReport,
  DeckPreflightReportV1,
  DeckPreflightReportV2,
  DeckPreflightSummary,
  DreverAuthoringContext,
  DreverAuthoringContextV1,
  DreverAuthoringContextV2,
  DreverAuthoringSlide,
  DreverPlugin,
  LayoutDefinition,
  PluginConfigManifest,
  RenderedPreflightReceipt,
  SlideManifest,
  SpeakerNote,
  ThemeDefinition,
} from "@drever/compiler";
export {
  MotionGroup,
  Note,
  SlideTransition,
  Step,
  useDreverRenderMode,
  useStage,
} from "./runtime.ts";
export type {
  DreverRenderMode,
  MotionFlow,
  MotionGroupProps,
  MotionIntent,
  NoteProps,
  SlideTransitionProps,
  StepProps,
  StepState,
  StageComponents,
  StageLayerComponent,
  StageLayerProps,
} from "./runtime.ts";
export { gfm, gfmPlugin } from "@drever/plugin-gfm";
export type { GfmOptions } from "@drever/plugin-gfm";
export { shiki, shikiPlugin } from "@drever/plugin-shiki";
export type { ShikiOptions } from "@drever/plugin-shiki";
export { tailwindCss, tailwindCssPlugin } from "@drever/plugin-tailwindcss";
export type { TailwindCssOptions } from "@drever/plugin-tailwindcss";

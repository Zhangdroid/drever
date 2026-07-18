export { createCompilePlan } from "./create-compile-plan.ts";
export type { CreateCompilePlanOptions } from "./create-compile-plan.ts";
export { definePlugin, defineTheme } from "./define-extension.ts";
export { parseDeck } from "./parse-deck.ts";
export type { ParseDeckOptions } from "./parse-deck.ts";

export {
  COMPILE_PLAN_VERSION,
  DECK_MANIFEST_VERSION,
  DREVER_EXTENSION_API_VERSION,
} from "@drever/schema";
export type {
  BuildPluginReference,
  CompilePlan,
  CompilerTarget,
  ComponentManifest,
  ComponentPropManifest,
  DreverPlugin,
  DeckManifest,
  LayoutDefinition,
  ModuleReference,
  PlannedBuildPlugin,
  PluginBuildPhase,
  PluginConfigManifest,
  PluginRegistration,
  SpeakerNote,
  StyleReference,
  SlideManifest,
  ThemeDefinition,
} from "@drever/schema";

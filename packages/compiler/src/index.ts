export { createCompilePlan } from "./create-compile-plan.ts";
export type { CreateCompilePlanOptions } from "./create-compile-plan.ts";
export { compileDeckManifest } from "./compile-deck-manifest.ts";
export type { CompileDeckManifestOptions } from "./compile-deck-manifest.ts";
export { definePlugin, defineTheme } from "./define-extension.ts";
export { parseDeck } from "./parse-deck.ts";
export type { ParseDeckOptions } from "./parse-deck.ts";
export { preflightDeck } from "./preflight-deck.ts";
export type { PreflightDeckOptions } from "./preflight-deck.ts";

export {
  COMPILE_PLAN_VERSION,
  DREVER_AUTHORING_CONTEXT_VERSION,
  DREVER_DECK_PLAN_VERSION,
  DECK_PREFLIGHT_VERSION,
  DECK_MANIFEST_VERSION,
  DREVER_EXTENSION_API_VERSION,
  RENDERED_PREFLIGHT_RULESET_VERSION,
  RENDERED_PREFLIGHT_VERSION,
  validateDreverDeckPlanValue,
} from "@drever/schema";
export type {
  BuildPluginReference,
  CompilePlan,
  CompilerTarget,
  ComponentManifest,
  ComponentPropManifest,
  DreverPlugin,
  DreverDeckPlan,
  DreverDeckPlanBrief,
  DreverDeckPlanComposition,
  DreverDeckPlanDensity,
  DreverDeckPlanMotion,
  DreverDeckPlanSlide,
  DreverDeckPlanSlideJob,
  DreverDeckPlanStatus,
  DreverDeckPlanValidationIssue,
  DreverDeckPlanValidationResult,
  DreverAuthoringComponent,
  DreverAuthoringContext,
  DreverAuthoringDeck,
  DreverAuthoringDesign,
  DreverAuthoringLayout,
  DreverAuthoringPlugin,
  DreverAuthoringSlide,
  DreverAuthoringTheme,
  DreverAuthoringContextV1,
  DreverAuthoringContextV2,
  DeckPreflightReport,
  DeckPreflightReportV1,
  DeckPreflightReportV2,
  DeckPreflightSummary,
  RenderedPreflightReceipt,
  RenderedPreflightRulesetVersion,
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

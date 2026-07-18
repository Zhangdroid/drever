export { COMPILE_PLAN_VERSION } from "./compile-plan.ts";
export { DREVER_AUTHORING_CONTEXT_VERSION } from "./authoring-context.ts";
export type {
  DreverAuthoringComponent,
  DreverAuthoringContext,
  DreverAuthoringDeck,
  DreverAuthoringDesign,
  DreverAuthoringLayout,
  DreverAuthoringPlugin,
  DreverAuthoringSlide,
  DreverAuthoringTheme,
} from "./authoring-context.ts";
export { DREVER_INTERNAL_SLIDE_COMPONENT, DREVER_INTERNAL_STEP_COMPONENT } from "./component.ts";
export type {
  CompilePlan,
  OwnedModuleReference,
  OwnedStyleReference,
  PlannedBuildPlugin,
  PlannedComponent,
  PlannedElement,
  PlannedLayout,
  PlannedPlugin,
  PlannedTheme,
} from "./compile-plan.ts";
export { DECK_IR_VERSION } from "./deck.ts";
export type { DeckIR, SlideIR } from "./deck.ts";
export { DECK_MANIFEST_VERSION } from "./deck-manifest.ts";
export type { DeckManifest, SlideManifest, SpeakerNote } from "./deck-manifest.ts";
export type {
  Diagnostic,
  DiagnosticResult,
  DiagnosticSeverity,
  DiagnosticStage,
} from "./diagnostic.ts";
export { DREVER_EXTENSION_API_VERSION } from "./extension.ts";
export type {
  BuildPluginReference,
  CanvasDefinition,
  CompilerTarget,
  ComponentManifest,
  ComponentPropManifest,
  DreverPlugin,
  ExtensionOwner,
  LayoutContentKind,
  LayoutDefinition,
  LayoutSlotDefinition,
  ModuleReference,
  MotionIntent,
  MotionProfileDefinition,
  PluginBuildDefinition,
  PluginBuildPhase,
  PluginComponentDefinition,
  PluginConfigManifest,
  PluginManifest,
  PluginOrderDefinition,
  PluginOrigin,
  PluginRegistration,
  PluginRuntimeDefinition,
  StyleLayer,
  StyleReference,
  ThemeDefinition,
  ThemeElementName,
  ThemeManifest,
} from "./extension.ts";
export type { JsonArray, JsonObject, JsonPrimitive, JsonValue } from "./json.ts";
export { DECK_PREFLIGHT_VERSION } from "./preflight.ts";
export type { DeckPreflightReport, DeckPreflightSummary } from "./preflight.ts";
export type { SourceFragment, SourcePoint, SourceRange } from "./source.ts";

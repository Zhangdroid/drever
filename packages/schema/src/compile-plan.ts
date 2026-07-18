import type {
  BuildPluginReference,
  CanvasDefinition,
  CompilerTarget,
  ComponentManifest,
  ExtensionOwner,
  LayoutDefinition,
  ModuleReference,
  MotionProfileDefinition,
  PluginBuildPhase,
  PluginOrigin,
  StyleReference,
  ThemeElementName,
  ThemeManifest,
} from "./extension.ts";
import type { JsonObject } from "./json.ts";

export const COMPILE_PLAN_VERSION = 1 as const;

export type OwnedModuleReference<Reference extends ModuleReference = ModuleReference> = Readonly<{
  owner: ExtensionOwner;
  module: Reference;
}>;

export type OwnedStyleReference = Readonly<{
  owner: ExtensionOwner;
  style: StyleReference;
}>;

export type PlannedBuildPlugin = OwnedModuleReference<BuildPluginReference> &
  Readonly<{
    phase: PluginBuildPhase;
  }>;

export type PlannedPlugin = Readonly<{
  id: string;
  version?: string;
  origin: PluginOrigin;
  config?: JsonObject;
}>;

export type PlannedElement = Readonly<{
  name: ThemeElementName;
  owner: ExtensionOwner;
  module: ModuleReference;
}>;

export type PlannedLayout = Omit<LayoutDefinition, "module"> &
  Readonly<{
    owner: ExtensionOwner;
    module: ModuleReference;
  }>;

export type PlannedComponent = Readonly<{
  name: string;
  owner: ExtensionOwner;
  module: ModuleReference;
  manifest: ComponentManifest;
}>;

export type PlannedTheme = Readonly<{
  id: string;
  version?: string;
  canvas?: CanvasDefinition;
  tokens: JsonObject;
  motion?: MotionProfileDefinition;
  manifest: ThemeManifest;
}>;

export type CompilePlan = Readonly<{
  version: typeof COMPILE_PLAN_VERSION;
  target: CompilerTarget;
  theme: PlannedTheme;
  plugins: readonly PlannedPlugin[];
  build: Readonly<{
    remark: readonly PlannedBuildPlugin[];
    rehype: readonly PlannedBuildPlugin[];
    recma: readonly PlannedBuildPlugin[];
    vite: readonly PlannedBuildPlugin[];
  }>;
  runtime: Readonly<{
    elements: readonly PlannedElement[];
    layouts: readonly PlannedLayout[];
    components: readonly PlannedComponent[];
    styles: readonly OwnedStyleReference[];
    setup: readonly OwnedModuleReference[];
    exportSetup: readonly OwnedModuleReference[];
  }>;
}>;

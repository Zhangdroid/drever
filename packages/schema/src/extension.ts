import type { JsonObject, JsonPrimitive, JsonValue } from "./json.ts";

export const DREVER_EXTENSION_API_VERSION = 1 as const;

export type CompilerTarget = "canonical" | "browser-lite";

export type ModuleReference = Readonly<{
  specifier: string;
  exportName?: string;
}>;

export type BuildPluginReference = ModuleReference &
  Readonly<{
    options?: JsonValue;
  }>;

export type StyleLayer = "theme" | "layout" | "component" | "utility";

export type StyleReference = Readonly<{
  specifier: string;
  layer: StyleLayer;
}>;

export type ExtensionOwner = Readonly<{
  kind: "theme" | "plugin";
  id: string;
}>;

export type ComponentPropManifest = Readonly<{
  type: "string" | "number" | "boolean" | "json";
  description: string;
  required?: boolean;
  values?: readonly JsonPrimitive[];
  default?: JsonValue;
}>;

export type ComponentManifest = Readonly<{
  description: string;
  props?: Readonly<Record<string, ComponentPropManifest>>;
  example?: string;
}>;

export type PluginComponentDefinition = Readonly<{
  name: string;
  module: ModuleReference;
  manifest: ComponentManifest;
}>;

export type PluginBuildPhase = "pre" | "normal" | "post";

export type PluginBuildDefinition = Readonly<{
  enforce?: PluginBuildPhase;
  remark?: readonly BuildPluginReference[];
  rehype?: readonly BuildPluginReference[];
  recma?: readonly BuildPluginReference[];
  vite?: readonly BuildPluginReference[];
}>;

export type PluginRuntimeDefinition = Readonly<{
  components?: readonly PluginComponentDefinition[];
  styles?: readonly StyleReference[];
  setup?: readonly ModuleReference[];
  exportSetup?: readonly ModuleReference[];
}>;

export type PluginOrderDefinition = Readonly<{
  before?: readonly string[];
  after?: readonly string[];
  requires?: readonly string[];
}>;

export type PluginConfigManifest = Readonly<{
  description: string;
  properties: Readonly<Record<string, ComponentPropManifest>>;
  additionalProperties?: boolean;
}>;

export type PluginManifest = Readonly<{
  title: string;
  summary: string;
  config?: PluginConfigManifest;
}>;

export type DreverPlugin = Readonly<{
  kind: "plugin";
  apiVersion: typeof DREVER_EXTENSION_API_VERSION;
  id: string;
  version?: string;
  baseURL?: string;
  compilerTargets?: readonly CompilerTarget[];
  order?: PluginOrderDefinition;
  build?: PluginBuildDefinition;
  runtime?: PluginRuntimeDefinition;
  manifest: PluginManifest;
}>;

export type PluginOrigin = "required" | "default" | "user";

export type PluginRegistration = Readonly<{
  plugin: DreverPlugin;
  origin: PluginOrigin;
  enabled?: boolean;
  config?: JsonObject;
}>;

export type ThemeElementName =
  | "a"
  | "blockquote"
  | "code"
  | "em"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "hr"
  | "img"
  | "li"
  | "ol"
  | "p"
  | "pre"
  | "strong"
  | "table"
  | "tbody"
  | "td"
  | "th"
  | "thead"
  | "tr"
  | "ul";

export type CanvasDefinition = Readonly<{
  width: number;
  height: number;
}>;

export type LayoutContentKind = "text" | "media" | "code" | "component";

export type LayoutSlotDefinition = Readonly<{
  name: string;
  purpose: string;
  accepts: readonly LayoutContentKind[];
  required?: boolean;
  maxItems?: number;
}>;

export type LayoutDefinition = Readonly<{
  name: string;
  module: ModuleReference;
  description: string;
  slots: readonly LayoutSlotDefinition[];
  variants?: readonly string[];
  constraints?: JsonObject;
  example?: string;
}>;

export type MotionIntent = "reveal" | "focus" | "replace" | "continuity" | "stagger" | "ambient";

export type MotionProfileDefinition = Readonly<{
  id: string;
  module: ModuleReference;
  intents: readonly MotionIntent[];
  guidance?: readonly string[];
}>;

export type ThemeManifest = Readonly<{
  title: string;
  summary: string;
  artDirection?: Readonly<{
    keywords: readonly string[];
    principles: readonly string[];
    avoid: readonly string[];
  }>;
  choices?: Readonly<{
    tones?: readonly string[];
    emphases?: readonly string[];
    densities?: readonly string[];
  }>;
}>;

export type ThemeDefinition = Readonly<{
  kind: "theme";
  apiVersion: typeof DREVER_EXTENSION_API_VERSION;
  id: string;
  version?: string;
  baseURL?: string;
  compilerTargets?: readonly CompilerTarget[];
  canvas?: CanvasDefinition;
  tokens: JsonObject;
  styles?: readonly StyleReference[];
  elements?: Partial<Readonly<Record<ThemeElementName, ModuleReference>>>;
  layouts?: readonly LayoutDefinition[];
  motion?: MotionProfileDefinition;
  manifest: ThemeManifest;
}>;

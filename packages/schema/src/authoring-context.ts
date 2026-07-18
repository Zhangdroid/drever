import type {
  CanvasDefinition,
  ComponentManifest,
  LayoutContentKind,
  MotionIntent,
  PluginOrigin,
  ThemeElementName,
  ThemeManifest,
} from "./extension.ts";
import type { JsonObject } from "./json.ts";
import type { DeckManifest, SlideManifest } from "./deck-manifest.ts";
import type { DeckPreflightReport } from "./preflight.ts";
import type { SourceFragment } from "./source.ts";

export const DREVER_AUTHORING_CONTEXT_VERSION = 1 as const;

export type DreverAuthoringSlide = SlideManifest &
  Readonly<{
    /** Exact authored fragments retained after excluding root MDX ESM declarations. */
    source: readonly SourceFragment[];
  }>;

export type DreverAuthoringDeck = Omit<DeckManifest, "slides"> &
  Readonly<{
    slides: readonly DreverAuthoringSlide[];
  }>;

export type DreverAuthoringTheme = Readonly<{
  id: string;
  version?: string;
  tokens: JsonObject;
  manifest: ThemeManifest;
  motion?: Readonly<{
    id: string;
    intents: readonly MotionIntent[];
    guidance?: readonly string[];
  }>;
}>;

export type DreverAuthoringLayout = Readonly<{
  name: string;
  description: string;
  slots: readonly Readonly<{
    name: string;
    purpose: string;
    accepts: readonly LayoutContentKind[];
    required?: boolean;
    maxItems?: number;
  }>[];
  variants?: readonly string[];
  constraints?: JsonObject;
  example?: string;
}>;

export type DreverAuthoringComponent = Readonly<{
  name: string;
  manifest: ComponentManifest;
}>;

export type DreverAuthoringPlugin = Readonly<{
  id: string;
  version?: string;
  origin: PluginOrigin;
  config?: JsonObject;
}>;

export type DreverAuthoringDesign = Readonly<{
  theme: DreverAuthoringTheme;
  layouts: readonly DreverAuthoringLayout[];
  components: readonly DreverAuthoringComponent[];
  elements: readonly ThemeElementName[];
}>;

/** Stable, JSON-safe input for agents that author or review one resolved deck. */
export type DreverAuthoringContext = Readonly<{
  version: typeof DREVER_AUTHORING_CONTEXT_VERSION;
  sourcePath: string;
  canvas: CanvasDefinition;
  deck: DreverAuthoringDeck;
  design: DreverAuthoringDesign;
  plugins: readonly DreverAuthoringPlugin[];
  preflight: DeckPreflightReport;
}>;

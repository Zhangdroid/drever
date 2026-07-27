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
import type { DeckPreflightReportV1, DeckPreflightReportV2 } from "./preflight.ts";
import type { SourceFragment } from "./source.ts";

export const DREVER_AUTHORING_CONTEXT_VERSION = 2 as const;

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

type DreverAuthoringContextBase = Readonly<{
  sourcePath: string;
  canvas: CanvasDefinition;
  deck: DreverAuthoringDeck;
  design: DreverAuthoringDesign;
  plugins: readonly DreverAuthoringPlugin[];
}>;

/** Legacy authoring context paired with the source-only preflight contract. */
export type DreverAuthoringContextV1 = DreverAuthoringContextBase &
  Readonly<{
    version: 1;
    preflight: DeckPreflightReportV1;
  }>;

/** Current authoring context paired with the current preflight contract. */
export type DreverAuthoringContextV2 = DreverAuthoringContextBase &
  Readonly<{
    version: typeof DREVER_AUTHORING_CONTEXT_VERSION;
    preflight: DeckPreflightReportV2;
  }>;

/** Every authoring-context version that current consumers can inspect safely. */
export type DreverAuthoringContext = DreverAuthoringContextV1 | DreverAuthoringContextV2;

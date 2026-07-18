import { DEFAULT_CANVAS } from "@drever/client";
import { compileDeckManifest, parseDeck, preflightDeck } from "@drever/compiler";
import {
  DREVER_AUTHORING_CONTEXT_VERSION,
  type DeckIR,
  type DeckManifest,
  type DreverAuthoringContext,
  type DreverAuthoringLayout,
  type DreverAuthoringTheme,
} from "@drever/schema";
import { readFile } from "node:fs/promises";
import { loadRemarkModules } from "@drever/vite";
import { DreverCliError } from "./errors.ts";
import type { ResolvedDreverPlan } from "./project.ts";

export type WriteAuthoringContextRequest = Readonly<{
  project: ResolvedDreverPlan;
  json: boolean;
  stdout: Pick<NodeJS.WriteStream, "write">;
}>;

const deepFreeze = (value: unknown): unknown => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return value;
};

const snapshot = <Value>(value: Value): Value =>
  deepFreeze(JSON.parse(JSON.stringify(value)) as unknown) as Value;

const readSource = async (path: string): Promise<string> => {
  try {
    return await readFile(path, "utf8");
  } catch (cause) {
    throw new DreverCliError(
      "DREVER_AUTHORING_CONTEXT_READ_FAILED",
      `Drever could not read ${path} for authoring context.`,
      {
        cause,
        details: { path },
        hint: "Check the deck permissions and run the context command again.",
      },
    );
  }
};

const parseSource = (source: string, path: string): DeckIR => {
  const parsed = parseDeck(source, { path });
  if (parsed.ok) {
    return parsed.value;
  }
  throw new DreverCliError(
    "DREVER_AUTHORING_CONTEXT_PARSE_FAILED",
    `Drever could not parse ${path} for authoring context.`,
    {
      details: { diagnostics: parsed.diagnostics, path },
      hint: "Fix the MDX parse diagnostics and run the context command again.",
    },
  );
};

const compileManifest = async (
  source: string,
  project: ResolvedDreverPlan,
): Promise<DeckManifest> => {
  const loaded = await loadRemarkModules(project.plan, { root: project.root });
  if (!loaded.ok) {
    throw new DreverCliError(
      "DREVER_AUTHORING_CONTEXT_PLUGIN_LOAD_FAILED",
      "Drever could not load the configured remark plugins for authoring context.",
      {
        details: { diagnostics: loaded.diagnostics, path: project.entry },
        hint: "Fix the plugin diagnostics and run the context command again.",
      },
    );
  }
  try {
    return await compileDeckManifest(source, {
      path: project.entry,
      remarkPlugins: loaded.value,
    });
  } catch (cause) {
    throw new DreverCliError(
      "DREVER_AUTHORING_CONTEXT_COMPILE_FAILED",
      `Drever could not compile ${project.entry} for authoring context.`,
      {
        cause,
        details: { path: project.entry },
        hint: "Fix the compiler or plugin error and run the context command again.",
      },
    );
  }
};

const manifestMismatch = (manifest: DeckManifest, deck: DeckIR, reason: string): DreverCliError =>
  new DreverCliError(
    "DREVER_AUTHORING_CONTEXT_MANIFEST_MISMATCH",
    "The compiled DeckManifest does not match the parsed authoring source.",
    {
      details: {
        manifestSlideCount: manifest.slides.length,
        parsedSlideCount: deck.slides.length,
        reason,
        sourcePath: deck.sourcePath,
      },
      hint: "Run the command again; if the mismatch persists, report it as a Drever compiler bug.",
    },
  );

/** @internal Joins compiler-owned navigation data to parser-owned source locations. */
export const mergeAuthoringDeck = (
  manifest: DeckManifest,
  deck: DeckIR,
): DreverAuthoringContext["deck"] => {
  if (manifest.slides.length !== deck.slides.length) {
    throw manifestMismatch(manifest, deck, "slide-count");
  }

  return {
    version: manifest.version,
    slides: manifest.slides.map((slide, index) => {
      const parsedSlide = deck.slides[index];
      if (
        parsedSlide === undefined ||
        parsedSlide.id !== slide.id ||
        parsedSlide.index !== slide.index
      ) {
        throw manifestMismatch(manifest, deck, `slide-identity:${index}`);
      }
      return { ...slide, source: parsedSlide.fragments };
    }),
  };
};

const curateTheme = (theme: ResolvedDreverPlan["plan"]["theme"]): DreverAuthoringTheme => ({
  id: theme.id,
  ...(theme.version === undefined ? {} : { version: theme.version }),
  tokens: theme.tokens,
  manifest: theme.manifest,
  ...(theme.motion === undefined
    ? {}
    : {
        motion: {
          id: theme.motion.id,
          intents: theme.motion.intents,
          ...(theme.motion.guidance === undefined ? {} : { guidance: theme.motion.guidance }),
        },
      }),
});

const curateLayout = (
  layout: ResolvedDreverPlan["plan"]["runtime"]["layouts"][number],
): DreverAuthoringLayout => ({
  name: layout.name,
  description: layout.description,
  slots: layout.slots,
  ...(layout.variants === undefined ? {} : { variants: layout.variants }),
  ...(layout.constraints === undefined ? {} : { constraints: layout.constraints }),
  ...(layout.example === undefined ? {} : { example: layout.example }),
});

export const createAuthoringContext = async (
  project: ResolvedDreverPlan,
): Promise<DreverAuthoringContext> => {
  const source = await readSource(project.entry);
  const parsed = parseSource(source, project.entry);
  const manifest = await compileManifest(source, project);
  const plan = project.plan;

  return snapshot({
    version: DREVER_AUTHORING_CONTEXT_VERSION,
    sourcePath: project.entry,
    canvas: project.config.canvas ?? plan.theme.canvas ?? DEFAULT_CANVAS,
    deck: mergeAuthoringDeck(manifest, parsed),
    design: {
      theme: curateTheme(plan.theme),
      layouts: plan.runtime.layouts.map(curateLayout),
      components: plan.runtime.components.map(({ name, manifest: componentManifest }) => ({
        name,
        manifest: componentManifest,
      })),
      elements: plan.runtime.elements.map(({ name }) => name),
    },
    plugins: plan.plugins.map(({ id, version, origin, config }) => ({
      id,
      ...(version === undefined ? {} : { version }),
      origin,
      ...(config === undefined ? {} : { config }),
    })),
    preflight: preflightDeck(source, { path: project.entry }),
  });
};

export const formatAuthoringContextJson = (context: DreverAuthoringContext): string =>
  `${JSON.stringify(context, null, 2)}\n`;

export const formatAuthoringContextHuman = (context: DreverAuthoringContext): string =>
  `Authoring context for ${context.sourcePath}: ${context.deck.slides.length} slides, ${context.design.theme.id} theme, ${context.plugins.length} plugins. Use --json for the complete agent-readable contract.\n`;

export const writeAuthoringContext = async ({
  project,
  json,
  stdout,
}: WriteAuthoringContextRequest): Promise<DreverAuthoringContext> => {
  const context = await createAuthoringContext(project);
  stdout.write(json ? formatAuthoringContextJson(context) : formatAuthoringContextHuman(context));
  return context;
};

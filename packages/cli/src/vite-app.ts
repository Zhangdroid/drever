import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DeckManifest } from "@drever/schema";
import {
  build,
  createServer,
  searchForWorkspaceRoot,
  type Alias,
  type InlineConfig,
  type Plugin,
  type ResolvedServerUrls,
  type ViteDevServer,
} from "vite";
import type { ResolvedDreverProject } from "./project.ts";
import { resolveConfigPath, type DreverConfig } from "./config.ts";
import { createCurrentPositionPlugin } from "./current-position.ts";
import { createPrivateApp, createPrivateDevApp, type PrivateAppOptions } from "./private-app.ts";
import { DreverCliError } from "./errors.ts";
import { createStoryboardPlanPlugin } from "./storyboard-plan-plugin.ts";
import { createStudioPlugin, resolveStudioUrls } from "./studio-plugin.ts";
import { writeStaticDeckRoutes } from "./static-routes.ts";

const workspaceFallbacks = Object.freeze({
  "drever/runtime": "../src/runtime.ts",
  "@drever/client": "../../client/src/index.ts",
  "@drever/client/audience": "../../client/src/audience.ts",
  "@drever/client/document": "../../client/src/document.ts",
  "@drever/client/speaker": "../../client/src/speaker-entry.ts",
  "@drever/client/storyboard": "../../client/src/storyboard-entry.ts",
  "@drever/client/storyboard.css": "../../client/storyboard.css",
  "@drever/client/studio": "../../client/src/studio-entry.ts",
  "@drever/client/studio.css": "../../client/studio.css",
  "@drever/client/styles.css": "../../client/styles.css",
  "@drever/core": "../../core/src/index.ts",
  "@drever/designs/basic/layouts": "../../designs/src/basic/layouts.tsx",
  "@drever/designs/basic/theme.css": "../../designs/themes/basic/theme.css",
  react: "../../client/node_modules/react/index.js",
  "react/jsx-dev-runtime": "../../client/node_modules/react/jsx-dev-runtime.js",
  "react/jsx-runtime": "../../client/node_modules/react/jsx-runtime.js",
  "react-dom": "../../client/node_modules/react-dom/index.js",
  "react-dom/client": "../../client/node_modules/react-dom/client.js",
}) satisfies Readonly<Record<string, string>>;

const optimizedFrameworkDependencies = Object.freeze([
  "drever",
  "@drever/client",
  "@drever/client/audience",
  "@drever/client/document",
  "@drever/client/speaker",
  "@drever/client/storyboard",
  "@drever/client/studio",
  "@drever/core",
  "@drever/designs/basic/layouts",
  "react",
  "react/jsx-dev-runtime",
  "react/jsx-runtime",
  "react-dom",
  "react-dom/client",
]);

const unoptimizedFrameworkDependencies = Object.freeze(["@chenglou/pretext"]);

const packageFile = (specifier: keyof typeof workspaceFallbacks): string => {
  let resolutionError: unknown;
  try {
    const resolved = fileURLToPath(import.meta.resolve(specifier));
    if (existsSync(resolved)) {
      return resolved;
    }
    resolutionError = new TypeError(`Resolved package file does not exist: ${resolved}`);
  } catch (cause) {
    resolutionError = cause;
  }
  const fallback = fileURLToPath(new URL(workspaceFallbacks[specifier], import.meta.url));
  if (existsSync(fallback)) {
    return fallback;
  }
  throw resolutionError;
};

const experimentalTextLayoutFile = (): string => {
  for (const relativePath of ["./experimental-text-layout.mjs", "./experimental-text-layout.ts"]) {
    const path = fileURLToPath(new URL(relativePath, import.meta.url));
    if (existsSync(path)) return path;
  }
  throw new TypeError("The internal experimental text-layout module is missing.");
};

const frameworkAliases = (): readonly Alias[] => [
  {
    find: /^virtual:drever\/experimental-text-layout$/u,
    replacement: experimentalTextLayoutFile(),
  },
  { find: /^drever$/u, replacement: packageFile("drever/runtime") },
  {
    find: /^@drever\/client\/audience$/u,
    replacement: packageFile("@drever/client/audience"),
  },
  {
    find: /^@drever\/client\/document$/u,
    replacement: packageFile("@drever/client/document"),
  },
  {
    find: /^@drever\/client\/speaker$/u,
    replacement: packageFile("@drever/client/speaker"),
  },
  {
    find: /^@drever\/client\/storyboard$/u,
    replacement: packageFile("@drever/client/storyboard"),
  },
  {
    find: /^@drever\/client\/storyboard\.css$/u,
    replacement: packageFile("@drever/client/storyboard.css"),
  },
  {
    find: /^@drever\/client\/studio$/u,
    replacement: packageFile("@drever/client/studio"),
  },
  {
    find: /^@drever\/client\/studio\.css$/u,
    replacement: packageFile("@drever/client/studio.css"),
  },
  {
    find: /^@drever\/client\/styles\.css$/u,
    replacement: packageFile("@drever/client/styles.css"),
  },
  { find: /^@drever\/client$/u, replacement: packageFile("@drever/client") },
  { find: /^@drever\/core$/u, replacement: packageFile("@drever/core") },
  {
    find: /^@drever\/designs\/basic\/layouts$/u,
    replacement: packageFile("@drever/designs/basic/layouts"),
  },
  {
    find: /^@drever\/designs\/basic\/theme\.css$/u,
    replacement: packageFile("@drever/designs/basic/theme.css"),
  },
  { find: /^react$/u, replacement: packageFile("react") },
  { find: /^react\/jsx-dev-runtime$/u, replacement: packageFile("react/jsx-dev-runtime") },
  { find: /^react\/jsx-runtime$/u, replacement: packageFile("react/jsx-runtime") },
  { find: /^react-dom$/u, replacement: packageFile("react-dom") },
  { find: /^react-dom\/client$/u, replacement: packageFile("react-dom/client") },
];

/**
 * @internal Vite cannot see MDX and virtual-module imports during its initial
 * scan. Eager optimization keeps their first browser load on one React graph.
 */
export const resolveFrameworkViteConfig = (): Readonly<{
  aliases: readonly Alias[];
  dedupe: readonly string[];
  exclude: readonly string[];
  optimize: readonly string[];
  warmup: readonly string[];
}> =>
  Object.freeze({
    aliases: frameworkAliases(),
    dedupe: Object.freeze(["react", "react-dom"]),
    exclude: unoptimizedFrameworkDependencies,
    optimize: optimizedFrameworkDependencies,
    warmup: Object.freeze(["./entry.js"]),
  });

const projectModuleResolver = (root: string): Plugin => {
  const importer = join(root, ".drever", "runtime-entry.js");
  return {
    name: "drever:project-module-resolution",
    enforce: "pre",
    async resolveId(source, sourceImporter, options) {
      if (
        sourceImporter?.includes("virtual:drever/") !== true ||
        source.startsWith(".") ||
        source.startsWith("/") ||
        source.includes(":")
      ) {
        return;
      }
      return this.resolve(source, importer, { ...options, skipSelf: true });
    },
  };
};

/** @internal Keeps generated apps, authored files, and workspace package assets available to Vite. */
export const resolveServerFsAllow = (
  projectRoot: string,
  appRoot: string,
  resolvedAliases: readonly string[],
  workspaceRoot = searchForWorkspaceRoot(projectRoot),
): string[] => [
  appRoot,
  projectRoot,
  workspaceRoot,
  ...resolvedAliases.map((replacement) => dirname(replacement)),
];

const inlineConfig = (
  project: ResolvedDreverProject,
  appRoot: string,
  plugins: readonly Plugin[] = [],
): InlineConfig => {
  const framework = resolveFrameworkViteConfig();
  const aliases = [...framework.aliases];
  return {
    appType: "spa",
    configFile: false,
    optimizeDeps: { exclude: [...framework.exclude], include: [...framework.optimize] },
    plugins: [projectModuleResolver(project.root), ...plugins, ...project.plugins],
    publicDir: join(project.root, "public"),
    resolve: { alias: aliases, dedupe: [...framework.dedupe] },
    root: appRoot,
    server: {
      fs: {
        allow: resolveServerFsAllow(
          project.root,
          appRoot,
          aliases.map(({ replacement }) => replacement),
        ),
      },
      warmup: { clientFiles: [...framework.warmup] },
      ...project.config.server,
    },
  };
};

const requireBuiltManifest = (project: ResolvedDreverProject): DeckManifest => {
  const manifest = project.getDeckManifest();
  if (manifest !== undefined) {
    return manifest;
  }
  throw new DreverCliError(
    "DREVER_BUILD_MANIFEST_MISSING",
    "The production build did not emit a DeckManifest for the configured entry.",
    {
      details: { entry: project.entry },
      hint: "Ensure the configured entry is the MDX deck compiled by Drever.",
    },
  );
};

const buildPrivateApp = async (
  project: ResolvedDreverProject,
  appRoot: string,
  outDir: string,
  sourcemap: boolean | "hidden" | "inline",
  logLevel?: InlineConfig["logLevel"],
): Promise<DeckManifest> => {
  await build({
    ...inlineConfig(project, appRoot),
    base: "./",
    build: { emptyOutDir: true, outDir, sourcemap },
    ...(logLevel === undefined ? {} : { logLevel }),
  });
  return requireBuiltManifest(project);
};

const buildFailure = (
  cause: unknown,
  project: ResolvedDreverProject,
  outDir: string,
): DreverCliError =>
  cause instanceof DreverCliError
    ? cause
    : new DreverCliError("DREVER_BUILD_FAILED", "The Drever production build failed.", {
        cause,
        details: { entry: project.entry, outDir },
        hint: "Review the compiler diagnostic above and fix the deck or extension configuration.",
      });

/** @internal Keeps the private generated app alive until its development server closes. */
export const attachPrivateAppLifetime = (
  server: Pick<ViteDevServer, "close">,
  dispose: () => Promise<void>,
): void => {
  const closeServer = server.close.bind(server);
  let closing: Promise<void> | undefined;
  server.close = () => {
    closing ??= (async () => {
      try {
        await closeServer();
      } finally {
        await dispose();
      }
    })();
    return closing;
  };
};

/** @internal Derives speaker entry points from the URLs resolved by Vite. */
export const resolveSpeakerUrls = (resolvedUrls: ResolvedServerUrls | null): readonly string[] => {
  if (resolvedUrls === null) {
    return [];
  }

  const urls = new Set<string>();
  for (const audienceUrl of [...resolvedUrls.local, ...resolvedUrls.network]) {
    const speakerUrl = new URL(audienceUrl);
    speakerUrl.pathname = `${speakerUrl.pathname.replace(/\/+$/u, "")}/speaker`;
    speakerUrl.search = "";
    speakerUrl.hash = "";
    urls.add(speakerUrl.href);
  }
  return [...urls];
};

/** @internal Derives plan-only preview entry points from the URLs resolved by Vite. */
export const resolveStoryboardUrls = (
  resolvedUrls: ResolvedServerUrls | null,
): readonly string[] => {
  if (resolvedUrls === null) return [];
  const urls = new Set<string>();
  for (const audienceUrl of [...resolvedUrls.local, ...resolvedUrls.network]) {
    const storyboardUrl = new URL(audienceUrl);
    storyboardUrl.pathname = `${storyboardUrl.pathname.replace(/\/+$/u, "")}/storyboard`;
    storyboardUrl.search = "";
    storyboardUrl.hash = "";
    urls.add(storyboardUrl.href);
  }
  return [...urls];
};

/** @internal Converts author-facing minutes into the speaker runtime's millisecond contract. */
export const resolvePrivateAppOptions = (
  config: Pick<DreverConfig, "canvas" | "deck" | "focusTools" | "rehearsal" | "stage">,
  root = ".",
): PrivateAppOptions => {
  const targetDurationMinutes = config.rehearsal?.targetDurationMinutes;
  return Object.freeze({
    ...(config.canvas === undefined ? {} : { canvas: config.canvas }),
    ...(config.deck === undefined ? {} : { deck: config.deck }),
    ...(config.focusTools === undefined ? {} : { focusTools: config.focusTools }),
    ...(targetDurationMinutes === undefined
      ? {}
      : {
          rehearsal: Object.freeze({ targetDurationMs: targetDurationMinutes * 60_000 }),
        }),
    ...(config.stage === undefined
      ? {}
      : {
          stage: Object.freeze({
            ...(config.stage.background === undefined
              ? {}
              : { background: resolveConfigPath(root, config.stage.background) }),
            ...(config.stage.foreground === undefined
              ? {}
              : { foreground: resolveConfigPath(root, config.stage.foreground) }),
          }),
        }),
  });
};

export const buildDreverProject = async (
  project: ResolvedDreverProject,
  options: Readonly<{ quiet?: boolean }> = {},
): Promise<void> => {
  const app = await createPrivateApp(
    project.entry,
    resolvePrivateAppOptions(project.config, project.root),
  );
  try {
    const manifest = await buildPrivateApp(
      project,
      app.root,
      project.outDir,
      project.config.build?.sourcemap ?? false,
      options.quiet === true ? "silent" : undefined,
    );
    await writeStaticDeckRoutes(project.outDir, manifest, project.config.deck);
  } catch (cause) {
    throw buildFailure(cause, project, project.outDir);
  } finally {
    await app.dispose();
  }
};

export type BuiltDreverExportApp = Readonly<{
  manifest: DeckManifest;
  outDir: string;
}>;

/** @internal Builds an exporter-only app without writing presentation routes or project output. */
export const buildDreverExportApp = async (
  project: ResolvedDreverProject,
  appRoot: string,
): Promise<BuiltDreverExportApp> => {
  const outDir = join(appRoot, "dist");
  try {
    const manifest = await buildPrivateApp(project, appRoot, outDir, false, "silent");
    return Object.freeze({ manifest, outDir });
  } catch (cause) {
    throw buildFailure(cause, project, outDir);
  }
};

/** @internal Builds portable audience routes in temporary storage for rendered preflight. */
export const buildDreverInspectionApp = async (
  project: ResolvedDreverProject,
  appRoot: string,
): Promise<BuiltDreverExportApp> => {
  const built = await buildDreverExportApp(project, appRoot);
  await writeStaticDeckRoutes(built.outDir, built.manifest, project.config.deck);
  return built;
};

export const serveDreverProject = async (
  project: ResolvedDreverProject,
): Promise<ViteDevServer> => {
  const app = await createPrivateDevApp(
    project.entry,
    resolvePrivateAppOptions(project.config, project.root),
  );
  try {
    const server = await createServer(
      inlineConfig(project, app.root, [
        createStoryboardPlanPlugin({ root: project.root }),
        createStudioPlugin({ root: project.root }),
        createCurrentPositionPlugin({ root: project.root, sourcePath: project.entry }),
      ]),
    );
    attachPrivateAppLifetime(server, app.dispose);
    await server.listen();
    server.printUrls();
    for (const studioUrl of resolveStudioUrls(server.resolvedUrls)) {
      server.config.logger.info(`  Creation room: ${studioUrl}`);
    }
    for (const storyboardUrl of resolveStoryboardUrls(server.resolvedUrls)) {
      server.config.logger.info(`  Storyboard: ${storyboardUrl}`);
    }
    for (const speakerUrl of resolveSpeakerUrls(server.resolvedUrls)) {
      server.config.logger.info(`  Speaker view: ${speakerUrl} (press P from audience)`);
    }
    return server;
  } catch (cause) {
    await app.dispose();
    throw new DreverCliError("DREVER_DEV_SERVER_FAILED", "The Drever development server failed.", {
      cause,
      details: { entry: project.entry },
      hint: "Review the diagnostic above and fix the deck or choose another server port.",
    });
  }
};

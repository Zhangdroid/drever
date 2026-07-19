import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DeckManifest } from "@drever/schema";
import {
  build,
  createServer,
  type Alias,
  type InlineConfig,
  type Plugin,
  type ResolvedServerUrls,
  type ViteDevServer,
} from "vite";
import type { ResolvedDreverProject } from "./project.ts";
import { resolveConfigPath, type DreverConfig } from "./config.ts";
import { createPrivateApp, type PrivateAppOptions } from "./private-app.ts";
import { DreverCliError } from "./errors.ts";
import { writeStaticDeckRoutes } from "./static-routes.ts";

const workspaceFallbacks = Object.freeze({
  "@drever/client": "../../client/src/index.ts",
  "@drever/client/styles.css": "../../client/styles.css",
  "@drever/core": "../../core/src/index.ts",
  "@drever/theme-default/layouts": "../../theme-default/src/layouts.tsx",
  "@drever/theme-default/theme.css": "../../theme-default/theme.css",
  react: "../../client/node_modules/react/index.js",
  "react/jsx-dev-runtime": "../../client/node_modules/react/jsx-dev-runtime.js",
  "react/jsx-runtime": "../../client/node_modules/react/jsx-runtime.js",
  "react-dom": "../../client/node_modules/react-dom/index.js",
  "react-dom/client": "../../client/node_modules/react-dom/client.js",
}) satisfies Readonly<Record<string, string>>;

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

const frameworkAliases = (): readonly Alias[] => [
  {
    find: /^@drever\/client\/styles\.css$/u,
    replacement: packageFile("@drever/client/styles.css"),
  },
  { find: /^@drever\/client$/u, replacement: packageFile("@drever/client") },
  { find: /^@drever\/core$/u, replacement: packageFile("@drever/core") },
  {
    find: /^@drever\/theme-default\/layouts$/u,
    replacement: packageFile("@drever/theme-default/layouts"),
  },
  {
    find: /^@drever\/theme-default\/theme\.css$/u,
    replacement: packageFile("@drever/theme-default/theme.css"),
  },
  { find: /^react$/u, replacement: packageFile("react") },
  { find: /^react\/jsx-dev-runtime$/u, replacement: packageFile("react/jsx-dev-runtime") },
  { find: /^react\/jsx-runtime$/u, replacement: packageFile("react/jsx-runtime") },
  { find: /^react-dom$/u, replacement: packageFile("react-dom") },
  { find: /^react-dom\/client$/u, replacement: packageFile("react-dom/client") },
];

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

const inlineConfig = (project: ResolvedDreverProject, appRoot: string): InlineConfig => {
  const aliases = [...frameworkAliases()];
  return {
    appType: "spa",
    configFile: false,
    plugins: [projectModuleResolver(project.root), ...project.plugins],
    resolve: { alias: aliases },
    root: appRoot,
    server: {
      fs: {
        allow: [appRoot, project.root, ...aliases.map(({ replacement }) => dirname(replacement))],
      },
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

/** @internal Converts author-facing minutes into the speaker runtime's millisecond contract. */
export const resolvePrivateAppOptions = (
  config: Pick<DreverConfig, "canvas" | "rehearsal" | "stage">,
  root = ".",
): PrivateAppOptions => {
  const targetDurationMinutes = config.rehearsal?.targetDurationMinutes;
  return Object.freeze({
    ...(config.canvas === undefined ? {} : { canvas: config.canvas }),
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

export const buildDreverProject = async (project: ResolvedDreverProject): Promise<void> => {
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
    );
    await writeStaticDeckRoutes(project.outDir, manifest);
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

export const serveDreverProject = async (
  project: ResolvedDreverProject,
): Promise<ViteDevServer> => {
  const app = await createPrivateApp(
    project.entry,
    resolvePrivateAppOptions(project.config, project.root),
  );
  try {
    const server = await createServer(inlineConfig(project, app.root));
    attachPrivateAppLifetime(server, app.dispose);
    await server.listen();
    server.printUrls();
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

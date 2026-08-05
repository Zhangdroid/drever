import { existsSync } from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import { createServer as createHttpServer, type Server as HttpServer } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DeckManifest } from "@drever/schema";
import {
  build,
  createServer,
  normalizePath,
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
import { openLocalUrl } from "./open-local-url.ts";
import type { StudioAgentProvider } from "./studio-agent-provider.ts";
import {
  createStudioAgentProvider,
  STUDIO_AGENT_SUPPORT,
  type StudioAgentName,
} from "./studio-agent-registry.ts";
import { startStudioPreviewProxy, type StudioPreviewProxy } from "./studio-preview-proxy.ts";

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

const viteDefaultServerFsDeny = Object.freeze([
  ".env",
  ".env.*",
  "*.{crt,pem,key,p12,pfx,cer,der}",
  ".npmrc",
  ".yarnrc.yml",
  "**/.git/**",
]);

/** @internal Extends Vite's documented deny list with private Studio session state. */
export const resolveServerFsDeny = (): readonly string[] => [
  "**/.drever/studio/**",
  ...viteDefaultServerFsDeny,
];

const inlineConfig = (
  project: ResolvedDreverProject,
  appRoot: string,
  plugins: readonly Plugin[] = [],
  serverConfig: DreverConfig["server"] = project.config.server,
  parentServer?: HttpServer,
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
        deny: [...resolveServerFsDeny()],
      },
      warmup: { clientFiles: [...framework.warmup] },
      ...serverConfig,
      ...(parentServer === undefined
        ? {}
        : {
            middlewareMode: { server: parentServer },
            open: false,
            ws: { server: parentServer },
          }),
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

export type ServeDreverProjectOptions = Readonly<{
  agent?: StudioAgentName;
  configDependencies?: readonly string[];
  environment?: NodeJS.ProcessEnv;
  open?: "studio";
  openUrl?: (url: string, environment?: NodeJS.ProcessEnv) => Promise<boolean>;
  reloadProject?: () => Promise<
    Readonly<{
      dependencies: readonly string[];
      project: ResolvedDreverProject;
    }>
  >;
}>;

const configDependencyPaths = (
  root: string,
  dependencies: readonly string[] = [],
): readonly string[] =>
  Object.freeze(
    [...new Set([join(root, "drever.config.ts"), ...dependencies].map(normalizePath))].sort(),
  );

const createConfigReloadPlugin = (
  root: string,
  dependencies: readonly string[],
  isRecovering: () => boolean,
  requestReload: () => void,
): Plugin => {
  const normalizedRoot = normalizePath(root).replace(/\/+$/u, "");
  const recoveryPrefix = `${normalizedRoot}/`;
  const ignoredRecoverySegments = new Set([".drever", ".git", "dist", "node_modules"]);
  const isRecoveryCandidate = (path: string): boolean => {
    if (!path.startsWith(recoveryPrefix)) return false;
    return !path
      .slice(recoveryPrefix.length)
      .split("/")
      .some((segment) => ignoredRecoverySegments.has(segment));
  };
  const watched = new Set(dependencies);
  const missing = new Set(dependencies.filter((path) => !existsSync(path)));
  let cleanup: (() => void) | undefined;
  const shouldReload = (event: "add" | "change" | "unlink", path: string): boolean => {
    const normalized = normalizePath(path);
    if (event === "unlink" && watched.has(normalized)) missing.add(normalized);
    const expectedAdd = event === "add" && missing.delete(normalized);
    return (
      (watched.has(normalized) && (event !== "add" || expectedAdd)) ||
      (isRecovering() && isRecoveryCandidate(normalized))
    );
  };

  return {
    apply: "serve",
    name: "drever:config-reload",
    hotUpdate({ file, type }) {
      const event = type === "create" ? "add" : type === "delete" ? "unlink" : "change";
      if (!shouldReload(event, file)) return;
      requestReload();
      return [];
    },
    configureServer(server) {
      server.watcher.add([root, ...dependencies]);
      const update = (event: "add" | "change" | "unlink", path: string): void => {
        if (shouldReload(event, path)) requestReload();
      };
      const add = (path: string): void => update("add", path);
      const change = (path: string): void => update("change", path);
      const unlink = (path: string): void => update("unlink", path);
      server.watcher.on("add", add);
      server.watcher.on("change", change);
      server.watcher.on("unlink", unlink);
      const release = (): void => {
        if (cleanup === undefined) return;
        cleanup = undefined;
        server.watcher.off("add", add);
        server.watcher.off("change", change);
        server.watcher.off("unlink", unlink);
      };
      cleanup = release;
      server.httpServer?.once("close", release);
    },
    closeBundle() {
      cleanup?.();
    },
  };
};

/** @internal Opens only the first exact local Creation room URL after Vite resolves its listener. */
export const openStudioWhenRequested = async (
  resolvedUrls: ViteDevServer["resolvedUrls"],
  token: string,
  previewUrl: string,
  options: ServeDreverProjectOptions,
): Promise<boolean | undefined> => {
  if (options.open !== "studio") return undefined;
  const studioUrl = resolveStudioUrls(resolvedUrls, token, previewUrl)[0];
  if (studioUrl === undefined) return false;
  return (options.openUrl ?? openLocalUrl)(studioUrl, options.environment);
};

const DEFAULT_DEVELOPMENT_PORT = 5173;

/** @internal Preserves Vite's loopback default while allowing an explicit network bind. */
export const resolveDevelopmentServerHost = (
  host: boolean | string | undefined,
): string | undefined =>
  typeof host === "string" ? host : host === true ? undefined : "localhost";

const isLoopbackHost = (host: string): boolean =>
  host === "localhost" || host === "::1" || host === "[::1]" || /^127(?:\.\d{1,3}){3}$/u.test(host);

const isWildcardHost = (host: string): boolean =>
  host === "0.0.0.0" || host === "::" || host === "[::]";

const urlHost = (host: string): string => {
  const normalized = host.replace(/^\[|\]$/gu, "").replace("%", "%25");
  return normalized.includes(":") ? `[${normalized}]` : normalized;
};

const serverUrl = (host: string, port: number): string =>
  new URL(`http://${urlHost(host)}:${String(port)}/`).href;

/** @internal Resolves the stable parent listener URLs exposed by `drever dev`. */
export const resolveDevelopmentServerUrls = (
  host: boolean | string | undefined,
  port: number,
): ResolvedServerUrls => {
  const requestedHost = typeof host === "string" ? host : undefined;
  const exposeNetwork =
    host === true || (requestedHost !== undefined && isWildcardHost(requestedHost));
  const local = new Set<string>();
  const network = new Set<string>();

  if (exposeNetwork) {
    local.add(serverUrl("localhost", port));
    for (const addresses of Object.values(networkInterfaces())) {
      for (const address of addresses ?? []) {
        if (!address.internal && address.family === "IPv4") {
          network.add(serverUrl(address.address, port));
        }
      }
    }
  } else {
    const resolvedHost = requestedHost ?? "localhost";
    (isLoopbackHost(resolvedHost) ? local : network).add(serverUrl(resolvedHost, port));
  }

  return Object.freeze({ local: [...local], network: [...network] });
};

const listenDevelopmentServer = async (
  server: HttpServer,
  config: NonNullable<DreverConfig["server"]>,
  onPortInUse: (port: number) => void,
): Promise<number> => {
  const host = resolveDevelopmentServerHost(config.host);
  let port = config.port ?? DEFAULT_DEVELOPMENT_PORT;
  for (;;) {
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error): void => {
          server.off("listening", onListening);
          reject(error);
        };
        const onListening = (): void => {
          server.off("error", onError);
          resolve();
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen({ host, port });
      });
      return (server.address() as AddressInfo).port;
    } catch (cause) {
      if (
        (cause as NodeJS.ErrnoException).code !== "EADDRINUSE" ||
        config.strictPort === true ||
        port >= 65_535
      ) {
        throw cause;
      }
      onPortInUse(port);
      port += 1;
    }
  }
};

const closeHttpServer = (server: HttpServer, sockets: Set<Socket>): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    if (!server.listening) {
      for (const socket of sockets) socket.destroy();
      resolve();
      return;
    }
    server.close((error) => (error === undefined ? resolve() : reject(error)));
    for (const socket of sockets) socket.destroy();
  });

export const serveDreverProject = async (
  project: ResolvedDreverProject,
  options: ServeDreverProjectOptions = {},
): Promise<ViteDevServer> => {
  let app = await createPrivateDevApp(
    project.entry,
    resolvePrivateAppOptions(project.config, project.root),
  );
  let stableServerConfig = project.config.server ?? {};
  const configDependencies = configDependencyPaths(project.root, options.configDependencies);
  let server: ViteDevServer | undefined;
  let resolvedUrls: ResolvedServerUrls | undefined;
  let previewProxy: StudioPreviewProxy | undefined;
  let agentProvider: StudioAgentProvider | undefined;
  let closing: Promise<void> | undefined;
  let parentClosing: Promise<void> | undefined;
  let reloadTimer: ReturnType<typeof setTimeout> | undefined;
  let reloadUpdates = Promise.resolve();
  let restartUpdate = Promise.resolve();
  let reloadProject = async (): Promise<void> => undefined;
  let configReloadFailed = false;
  let shuttingDown = false;
  const restartScope = new AsyncLocalStorage<boolean>();
  let closeCurrentServer: (() => Promise<void>) | undefined;
  const parentSockets = new Set<Socket>();
  const parentServer = createHttpServer((request, response) => {
    if (server === undefined) {
      response.statusCode = 503;
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
      response.end("The Drever development server is starting.\n");
      return;
    }
    server.middlewares(request, response, (cause?: unknown) => {
      if (response.writableEnded) return;
      response.statusCode = cause === undefined ? 404 : 500;
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
      response.end(
        cause === undefined
          ? "Not found.\n"
          : `The Drever development server could not handle this request: ${cause instanceof Error ? cause.message : "Unknown middleware failure."}\n`,
      );
    });
  });
  parentServer.on("connection", (socket) => {
    parentSockets.add(socket);
    socket.once("close", () => parentSockets.delete(socket));
  });
  const closeParentServer = (): Promise<void> => {
    parentClosing ??= closeHttpServer(parentServer, parentSockets);
    return parentClosing;
  };
  try {
    const occupiedPorts: number[] = [];
    const port = await listenDevelopmentServer(parentServer, stableServerConfig, (occupiedPort) =>
      occupiedPorts.push(occupiedPort),
    );
    stableServerConfig = Object.freeze({ ...stableServerConfig, port });
    resolvedUrls = resolveDevelopmentServerUrls(stableServerConfig.host, port);
    const studioToken = randomBytes(32).toString("base64url");
    agentProvider =
      options.agent === undefined
        ? undefined
        : await createStudioAgentProvider(options.agent, project.root);

    const requestReload = (): void => {
      if (options.reloadProject === undefined || shuttingDown) return;
      if (reloadTimer !== undefined) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        reloadTimer = undefined;
        reloadUpdates = reloadUpdates.then(reloadProject).catch((cause: unknown) => {
          configReloadFailed = true;
          server?.config.logger.error(
            `Drever kept the current preview because configuration reload failed: ${cause instanceof Error ? cause.message : String(cause)}`,
            { timestamp: true },
          );
        });
      }, 80);
      reloadTimer.unref?.();
    };

    const developmentPlugins = (
      activeProject: ResolvedDreverProject,
      dependencies: readonly string[],
    ): readonly Plugin[] => [
      ...(options.reloadProject === undefined
        ? []
        : [
            createConfigReloadPlugin(
              activeProject.root,
              dependencies,
              () => configReloadFailed,
              requestReload,
            ),
          ]),
      createStoryboardPlanPlugin({ root: activeProject.root }),
      createStudioPlugin({
        root: activeProject.root,
        token: studioToken,
        ...(agentProvider === undefined ? {} : { agentProvider }),
      }),
      createCurrentPositionPlugin({ root: activeProject.root, sourcePath: activeProject.entry }),
    ];

    const initialInlineConfig = inlineConfig(
      project,
      app.root,
      developmentPlugins(project, configDependencies),
      stableServerConfig,
      parentServer,
    );
    server = await createServer(initialInlineConfig);
    for (const occupiedPort of occupiedPorts) {
      server.config.logger.info(`Port ${String(occupiedPort)} is in use, trying another one...`);
    }

    const installLifetime = (): void => {
      if (server === undefined) return;
      const activeServer = server;
      const closeServer = server.close.bind(server);
      closeCurrentServer = closeServer;
      (activeServer as { httpServer: HttpServer | null }).httpServer = parentServer;
      activeServer.config.server.open = stableServerConfig.open ?? false;
      activeServer.resolvedUrls = resolvedUrls ?? null;
      activeServer.printUrls = () => {
        for (const url of resolvedUrls?.local ?? []) {
          activeServer.config.logger.info(`  Local: ${url}`);
        }
        for (const url of resolvedUrls?.network ?? []) {
          activeServer.config.logger.info(`  Network: ${url}`);
        }
      };
      server.close = () => {
        if (restartScope.getStore() === true) return closeServer();
        shuttingDown = true;
        if (reloadTimer !== undefined) clearTimeout(reloadTimer);
        closing ??= (async () => {
          try {
            await restartUpdate.catch(() => undefined);
            await closeCurrentServer?.();
          } finally {
            try {
              await closeParentServer();
            } finally {
              try {
                await agentProvider?.stop();
              } finally {
                try {
                  await previewProxy?.close();
                } finally {
                  await app.dispose();
                }
              }
            }
          }
        })();
        return closing;
      };
    };

    reloadProject = async (): Promise<void> => {
      if (server === undefined || options.reloadProject === undefined || shuttingDown) return;
      const reloaded = await options.reloadProject();
      if (shuttingDown) return;
      const nextDependencies = configDependencyPaths(reloaded.project.root, reloaded.dependencies);
      const nextApp = await createPrivateDevApp(
        reloaded.project.entry,
        resolvePrivateAppOptions(reloaded.project.config, reloaded.project.root),
      );
      if (shuttingDown) {
        await nextApp.dispose();
        return;
      }
      const nextInlineConfig = inlineConfig(
        reloaded.project,
        nextApp.root,
        developmentPlugins(reloaded.project, nextDependencies),
        stableServerConfig,
        parentServer,
      );
      const previousInlineConfig = server.config.inlineConfig;
      let adopted = false;
      try {
        restartUpdate = (async () => {
          if (shuttingDown) return;
          (server.config as { inlineConfig: InlineConfig }).inlineConfig = nextInlineConfig;
          await restartScope.run(true, () => server?.restart());
          if (server.config.root !== nextApp.root) {
            (server.config as { inlineConfig: InlineConfig }).inlineConfig = previousInlineConfig;
            throw new TypeError("Vite did not accept the refreshed Drever configuration.");
          }
          installLifetime();
          if (shuttingDown) return;

          const previousApp = app;
          app = nextApp;
          adopted = true;
          configReloadFailed = false;
          await previousApp.dispose();
          server.config.logger.info("Drever configuration reloaded.", { timestamp: true });
        })();
        await restartUpdate;
      } finally {
        if (!adopted) await nextApp.dispose();
      }
    };

    installLifetime();
    const audienceUrl = server.resolvedUrls?.local[0];
    if (audienceUrl === undefined) {
      throw new TypeError("Vite did not resolve a local audience URL for Studio.");
    }
    previewProxy = await startStudioPreviewProxy(audienceUrl);
    server.printUrls();
    if (stableServerConfig.open !== undefined && stableServerConfig.open !== false) {
      server.openBrowser();
    }
    const studioUrls = resolveStudioUrls(
      server.resolvedUrls,
      studioToken,
      previewProxy.audienceUrl,
    );
    for (const studioUrl of studioUrls) {
      server.config.logger.info(`  Creation room: ${studioUrl}`);
    }
    if (options.agent !== undefined) {
      const support = STUDIO_AGENT_SUPPORT[options.agent];
      server.config.logger.info(
        `  Studio agent: ${support.label} configured (${support.transport}; connecting)`,
      );
    }
    const opened = await openStudioWhenRequested(
      server.resolvedUrls,
      studioToken,
      previewProxy.audienceUrl,
      options,
    );
    if (opened !== undefined) {
      server.config.logger.info(
        opened
          ? "  Opened the Creation room in your default browser."
          : "  Browser auto-open is unavailable; use the Creation room URL above.",
      );
    }
    for (const storyboardUrl of resolveStoryboardUrls(server.resolvedUrls)) {
      server.config.logger.info(`  Storyboard: ${storyboardUrl}`);
    }
    for (const speakerUrl of resolveSpeakerUrls(server.resolvedUrls)) {
      server.config.logger.info(`  Speaker view: ${speakerUrl} (press P from audience)`);
    }
    return server;
  } catch (cause) {
    if (server === undefined) {
      try {
        await closeParentServer().catch(() => undefined);
      } finally {
        try {
          await agentProvider?.stop();
        } finally {
          await app.dispose();
        }
      }
    } else {
      await server.close().catch(() => undefined);
    }
    throw new DreverCliError("DREVER_DEV_SERVER_FAILED", "The Drever development server failed.", {
      cause,
      details: { entry: project.entry },
      hint: "Review the diagnostic above and fix the deck or choose another server port.",
    });
  }
};

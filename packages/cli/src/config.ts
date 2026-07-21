import type { DreverPlugin, PluginRegistration, ThemeDefinition } from "@drever/compiler";
import { access } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { loadConfigFromFile, type ConfigEnv } from "vite";
import { DreverCliError } from "./errors.ts";

export type DreverCanvasConfig = Readonly<{
  height: number;
  width: number;
}>;

export type DreverServerConfig = Readonly<{
  host?: boolean | string;
  open?: boolean | string;
  port?: number;
  strictPort?: boolean;
}>;

export type DreverBuildConfig = Readonly<{
  outDir?: string;
  sourcemap?: boolean | "hidden" | "inline";
}>;

export type DreverRehearsalConfig = Readonly<{
  targetDurationMinutes?: number;
}>;

export type DreverFocusPenConfig = Readonly<{
  color?: string;
  width?: number;
}>;

export type DreverFocusHighlighterConfig = Readonly<{
  color?: string;
  opacity?: number;
  width?: number;
}>;

export type DreverFocusLaserConfig = Readonly<{
  color?: string;
}>;

export type DreverFocusToolsConfig = Readonly<{
  highlighter?: DreverFocusHighlighterConfig;
  laser?: DreverFocusLaserConfig;
  pen?: DreverFocusPenConfig;
}>;

export type DreverStageConfig = Readonly<{
  background?: string;
  foreground?: string;
}>;

export type DreverPluginUse = Readonly<{
  config?: PluginRegistration["config"];
  enabled?: boolean;
  plugin: DreverPlugin;
}>;

export type DreverConfig = Readonly<{
  build?: DreverBuildConfig;
  canvas?: DreverCanvasConfig;
  entry?: string;
  focusTools?: DreverFocusToolsConfig;
  plugins?: readonly (DreverPlugin | DreverPluginUse)[];
  rehearsal?: DreverRehearsalConfig;
  server?: DreverServerConfig;
  stage?: DreverStageConfig;
  theme?: ThemeDefinition;
}>;

export type DreverConfigExport = DreverConfig;

/** Adds type checking to drever.config.ts without changing the value. */
export const defineConfig = <const Config extends DreverConfig>(config: Config): Config => config;

export type LoadDreverConfigOptions = Readonly<{
  command: "build" | "check" | "serve";
  root: string;
}>;

export type LoadedDreverConfig = Readonly<{
  config: DreverConfig;
  path?: string;
}>;

const CONFIG_FILE = "drever.config.ts";
const CONFIG_KEYS = new Set([
  "build",
  "canvas",
  "entry",
  "focusTools",
  "plugins",
  "rehearsal",
  "server",
  "stage",
  "theme",
]);
const BUILD_KEYS = new Set(["outDir", "sourcemap"]);
const CANVAS_KEYS = new Set(["height", "width"]);
const FOCUS_TOOLS_KEYS = new Set(["highlighter", "laser", "pen"]);
const FOCUS_INK_KEYS = new Set(["color", "width"]);
const FOCUS_HIGHLIGHTER_KEYS = new Set(["color", "opacity", "width"]);
const FOCUS_LASER_KEYS = new Set(["color"]);
const REHEARSAL_KEYS = new Set(["targetDurationMinutes"]);
const SERVER_KEYS = new Set(["host", "open", "port", "strictPort"]);
const STAGE_KEYS = new Set(["background", "foreground"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

const isPositiveFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const isPort = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 65_535;

const hasErrorCode = (error: unknown, code: string): boolean =>
  error instanceof Error && "code" in error && error.code === code;

const unknownKey = (
  value: Record<string, unknown>,
  keys: ReadonlySet<string>,
): string | undefined => Object.keys(value).find((key) => !keys.has(key));

const invalidConfig = (message: string, path: string, received?: unknown): never => {
  throw new DreverCliError("DREVER_CONFIG_INVALID", message, {
    details: {
      path,
      ...(received === undefined ? {} : { received }),
    },
    hint: "Update drever.config.ts to use the typed defineConfig() API.",
  });
};

const requireRecord = (value: unknown, message: string, path: string): Record<string, unknown> => {
  if (isRecord(value)) {
    return value;
  }
  return invalidConfig(message, path, value);
};

const validateCanvas = (value: unknown): void => {
  const canvas = requireRecord(value, "canvas must be an object with width and height.", "canvas");
  const extra = unknownKey(canvas, CANVAS_KEYS);
  if (extra !== undefined) {
    invalidConfig(`canvas.${extra} is not a supported option.`, `canvas.${extra}`);
  }
  for (const key of ["width", "height"] as const) {
    const dimension = canvas[key];
    if (!isPositiveInteger(dimension)) {
      invalidConfig(`canvas.${key} must be a positive integer.`, `canvas.${key}`, dimension);
    }
  }
};

const validateBuild = (value: unknown): void => {
  const build = requireRecord(value, "build must be an object.", "build");
  const extra = unknownKey(build, BUILD_KEYS);
  if (extra !== undefined) {
    invalidConfig(`build.${extra} is not a supported option.`, `build.${extra}`);
  }
  if (
    build.outDir !== undefined &&
    (typeof build.outDir !== "string" || build.outDir.length === 0)
  ) {
    invalidConfig("build.outDir must be a non-empty path.", "build.outDir", build.outDir);
  }
  if (
    build.sourcemap !== undefined &&
    build.sourcemap !== true &&
    build.sourcemap !== false &&
    build.sourcemap !== "hidden" &&
    build.sourcemap !== "inline"
  ) {
    invalidConfig(
      'build.sourcemap must be boolean, "inline", or "hidden".',
      "build.sourcemap",
      build.sourcemap,
    );
  }
};

const validateServer = (value: unknown): void => {
  const server = requireRecord(value, "server must be an object.", "server");
  const extra = unknownKey(server, SERVER_KEYS);
  if (extra !== undefined) {
    invalidConfig(`server.${extra} is not a supported option.`, `server.${extra}`);
  }
  if (
    server.host !== undefined &&
    typeof server.host !== "boolean" &&
    typeof server.host !== "string"
  ) {
    invalidConfig("server.host must be a hostname or boolean.", "server.host", server.host);
  }
  if (
    server.open !== undefined &&
    typeof server.open !== "boolean" &&
    typeof server.open !== "string"
  ) {
    invalidConfig("server.open must be a path or boolean.", "server.open", server.open);
  }
  if (server.port !== undefined && !isPort(server.port)) {
    invalidConfig("server.port must be an integer from 1 to 65535.", "server.port", server.port);
  }
  if (server.strictPort !== undefined && typeof server.strictPort !== "boolean") {
    invalidConfig("server.strictPort must be boolean.", "server.strictPort", server.strictPort);
  }
};

const validateRehearsal = (value: unknown): void => {
  const rehearsal = requireRecord(value, "rehearsal must be an object.", "rehearsal");
  const extra = unknownKey(rehearsal, REHEARSAL_KEYS);
  if (extra !== undefined) {
    invalidConfig(`rehearsal.${extra} is not a supported option.`, `rehearsal.${extra}`);
  }
  if (
    rehearsal.targetDurationMinutes !== undefined &&
    !isPositiveFiniteNumber(rehearsal.targetDurationMinutes)
  ) {
    invalidConfig(
      "rehearsal.targetDurationMinutes must be a finite number greater than zero.",
      "rehearsal.targetDurationMinutes",
      rehearsal.targetDurationMinutes,
    );
  }
};

const validateFocusColor = (value: unknown, path: string): void => {
  if (value !== undefined && (typeof value !== "string" || value.trim().length === 0)) {
    invalidConfig(`${path} must be a non-empty CSS color value.`, path, value);
  }
};

const validateFocusWidth = (value: unknown, path: string): void => {
  if (value !== undefined && !isPositiveFiniteNumber(value)) {
    invalidConfig(`${path} must be a finite number greater than zero.`, path, value);
  }
};

const validateFocusInk = (
  value: unknown,
  path: "focusTools.highlighter" | "focusTools.pen",
): void => {
  const ink = requireRecord(value, `${path} must be an object.`, path);
  const keys = path === "focusTools.highlighter" ? FOCUS_HIGHLIGHTER_KEYS : FOCUS_INK_KEYS;
  const extra = unknownKey(ink, keys);
  if (extra !== undefined) {
    invalidConfig(`${path}.${extra} is not a supported option.`, `${path}.${extra}`);
  }
  validateFocusColor(ink.color, `${path}.color`);
  validateFocusWidth(ink.width, `${path}.width`);
  if (
    path === "focusTools.highlighter" &&
    ink.opacity !== undefined &&
    (typeof ink.opacity !== "number" ||
      !Number.isFinite(ink.opacity) ||
      ink.opacity < 0 ||
      ink.opacity > 1)
  ) {
    invalidConfig(
      "focusTools.highlighter.opacity must be a finite number from zero to one.",
      "focusTools.highlighter.opacity",
      ink.opacity,
    );
  }
};

const validateFocusTools = (value: unknown): void => {
  const tools = requireRecord(value, "focusTools must be an object.", "focusTools");
  const extra = unknownKey(tools, FOCUS_TOOLS_KEYS);
  if (extra !== undefined) {
    invalidConfig(`focusTools.${extra} is not a supported option.`, `focusTools.${extra}`);
  }
  if (tools.pen !== undefined) {
    validateFocusInk(tools.pen, "focusTools.pen");
  }
  if (tools.highlighter !== undefined) {
    validateFocusInk(tools.highlighter, "focusTools.highlighter");
  }
  if (tools.laser !== undefined) {
    const laser = requireRecord(
      tools.laser,
      "focusTools.laser must be an object.",
      "focusTools.laser",
    );
    const laserExtra = unknownKey(laser, FOCUS_LASER_KEYS);
    if (laserExtra !== undefined) {
      invalidConfig(
        `focusTools.laser.${laserExtra} is not a supported option.`,
        `focusTools.laser.${laserExtra}`,
      );
    }
    validateFocusColor(laser.color, "focusTools.laser.color");
  }
};

const validateStage = (value: unknown): void => {
  const stage = requireRecord(value, "stage must be an object.", "stage");
  const extra = unknownKey(stage, STAGE_KEYS);
  if (extra !== undefined) {
    invalidConfig(`stage.${extra} is not a supported option.`, `stage.${extra}`);
  }
  if (stage.background === undefined && stage.foreground === undefined) {
    invalidConfig("stage must define a background or foreground component module.", "stage", stage);
  }
  for (const key of STAGE_KEYS) {
    const module = stage[key];
    if (module !== undefined && (typeof module !== "string" || module.length === 0)) {
      invalidConfig(`stage.${key} must be a non-empty module path.`, `stage.${key}`, module);
    }
  }
};

const validateConfig = (value: unknown): DreverConfig => {
  const config = requireRecord(value, "The default export must be an object.", "$");
  const extra = unknownKey(config, CONFIG_KEYS);
  if (extra !== undefined) {
    invalidConfig(`${extra} is not a supported Drever option.`, extra);
  }
  if (
    config.entry !== undefined &&
    (typeof config.entry !== "string" || config.entry.length === 0)
  ) {
    invalidConfig("entry must be a non-empty path.", "entry", config.entry);
  }
  if (config.canvas !== undefined) {
    validateCanvas(config.canvas);
  }
  if (config.build !== undefined) {
    validateBuild(config.build);
  }
  if (config.focusTools !== undefined) {
    validateFocusTools(config.focusTools);
  }
  if (config.rehearsal !== undefined) {
    validateRehearsal(config.rehearsal);
  }
  if (config.server !== undefined) {
    validateServer(config.server);
  }
  if (config.stage !== undefined) {
    validateStage(config.stage);
  }
  if (config.plugins !== undefined && !Array.isArray(config.plugins)) {
    invalidConfig(
      "plugins must be an array of plugins or plugin settings.",
      "plugins",
      config.plugins,
    );
  }
  if (Array.isArray(config.plugins) && config.plugins.some((plugin) => !isRecord(plugin))) {
    invalidConfig(
      "Every plugins entry must be a plugin or an object containing plugin.",
      "plugins",
      config.plugins,
    );
  }
  if (config.theme !== undefined && !isRecord(config.theme)) {
    invalidConfig("theme must be a Drever theme definition.", "theme", config.theme);
  }
  return Object.freeze({ ...config }) as DreverConfig;
};

export const loadDreverConfig = async ({
  command,
  root,
}: LoadDreverConfigOptions): Promise<LoadedDreverConfig> => {
  const path = join(root, CONFIG_FILE);
  try {
    await access(path);
  } catch (cause) {
    if (hasErrorCode(cause, "ENOENT")) {
      return Object.freeze({ config: Object.freeze({}) });
    }
    throw new DreverCliError("DREVER_CONFIG_LOAD_FAILED", `Could not access ${CONFIG_FILE}.`, {
      cause,
      details: { path },
      hint: "Check the config file permissions and try again.",
    });
  }

  const buildEnvironment = command !== "serve";
  const environment: ConfigEnv = {
    command: buildEnvironment ? "build" : "serve",
    isPreview: false,
    isSsrBuild: false,
    mode: buildEnvironment ? "production" : "development",
  };
  try {
    const loaded =
      command === "check"
        ? await loadConfigFromFile(environment, path, root, "silent", undefined, "runner")
        : await loadConfigFromFile(environment, path, root, "silent");
    if (loaded === null) {
      throw new TypeError(`Vite did not load ${path}.`);
    }
    return Object.freeze({ config: validateConfig(loaded.config), path: loaded.path });
  } catch (cause) {
    if (cause instanceof DreverCliError) {
      throw cause;
    }
    throw new DreverCliError("DREVER_CONFIG_LOAD_FAILED", `Could not load ${CONFIG_FILE}.`, {
      cause,
      details: { path },
      hint: "Fix the TypeScript or imports in drever.config.ts, then run the command again.",
    });
  }
};

export const resolveConfigPath = (root: string, path: string): string =>
  isAbsolute(path) ? path : resolve(root, path);

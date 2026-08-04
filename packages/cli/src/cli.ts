import { basename, extname, relative, resolve, sep } from "node:path";
import type { ViteDevServer } from "vite";
import { loadDreverConfig, type LoadDreverConfigOptions } from "./config.ts";
import { DreverCliError } from "./errors.ts";
import {
  resolveDreverEntry,
  resolveDreverDevelopmentProject,
  resolveDreverPlan,
  resolveDreverProject,
  type ResolvedDreverProject,
} from "./project.ts";
import { buildDreverProject, serveDreverProject } from "./vite-app.ts";
import type { CheckDeckRequest, CheckExitCode } from "./check.ts";
import type { AgentSyncResult, AgentSyncTarget, SyncAgentKitOptions } from "./agent-sync.ts";
import {
  parseCreateArguments,
  runCreateCommand,
  type CreateCommand,
  type CreateProjectOptions,
  type CreateProjectResult,
} from "./create-project.ts";
import type { WriteAuthoringContextRequest } from "./context.ts";
import type { WriteCurrentPositionRequest } from "./current-position.ts";
import type { RunMcpServerRequest } from "./mcp-server.ts";
import { createArtifactReceipt, writeArtifactReceipt } from "./artifact-receipt.ts";
import { DREVER_VERSION } from "./package-version.ts";
import type { RunDoctorRequest } from "./doctor.ts";
import type { BrowserInstallRequest } from "./browser-install.ts";
import type {
  DesignImportColorScheme,
  DesignImportReceipt,
  ImportWebsiteDesignOptions,
} from "./design-import.ts";
import type { RunStudioCommandRequest, StudioCommand } from "./studio-command.ts";

export type AgentCommand = Readonly<{
  action: "sync";
  name: "agent";
  target?: AgentSyncTarget;
}>;

export type BuildCommand = Readonly<{
  entry?: string;
  json: boolean;
  name: "build";
}>;

export type BrowserCommand = Readonly<{
  action: "install";
  name: "browser";
  withDeps: boolean;
}>;

type DevCommand = Readonly<{
  entry?: string;
  name: "dev";
}>;

export type CheckCommand = Readonly<{
  entry?: string;
  json: boolean;
  name: "check";
  rendered: boolean;
}>;

export type ContextCommand = Readonly<{
  entry?: string;
  json: boolean;
  name: "context";
}>;

export type CurrentCommand = Readonly<{
  json: boolean;
  name: "current";
}>;

export type DesignCommand = Readonly<{
  action: "import";
  allowPrivate: boolean;
  colorScheme: DesignImportColorScheme;
  json: boolean;
  name: "design";
  output: string;
  themeName: string;
  url: string;
}>;

export type DoctorCommand = Readonly<{
  json: boolean;
  name: "doctor";
}>;

export type McpCommand = Readonly<{
  entry?: string;
  name: "mcp";
}>;

export type PdfSlideRange = Readonly<{
  first: number;
  last: number;
}>;

export type ExportPdfCommand = Readonly<{
  entry?: string;
  format: "pdf";
  json: boolean;
  name: "export";
  output?: string;
  slides?: readonly PdfSlideRange[];
  steps: boolean;
}>;

export type DreverCommand =
  | AgentCommand
  | BrowserCommand
  | BuildCommand
  | CheckCommand
  | ContextCommand
  | CreateCommand
  | CurrentCommand
  | DesignCommand
  | DoctorCommand
  | ExportPdfCommand
  | McpCommand
  | StudioCommand
  | DevCommand;

export type PdfExportRequest = Readonly<{
  output: string;
  project: ResolvedDreverProject;
  slides?: readonly PdfSlideRange[];
  steps: boolean;
}>;

const EXPORT_PDF_USAGE =
  "Usage: drever export pdf [entry] [--steps] [--slides <range>] [-o|--output <path>] [--json]";
const BUILD_USAGE = "Usage: drever build [entry] [--json]";
const CHECK_USAGE = "Usage: drever check [entry] [--rendered] [--json]";
const CONTEXT_USAGE = "Usage: drever context [entry] [--json]";
const CURRENT_USAGE = "Usage: drever current [--json]";
const DOCTOR_USAGE = "Usage: drever doctor [--json]";
const MCP_USAGE = "Usage: drever mcp [entry]";
const AGENT_SYNC_USAGE = "Usage: drever agent sync [--target <all|auto|codex|claude>]";
const BROWSER_INSTALL_USAGE = "Usage: drever browser install [--with-deps]";
const DESIGN_IMPORT_USAGE =
  "Usage: drever design import <url> [--name <name>] [--output <directory>] [--color-scheme <light|dark>] [--allow-private] [--json]";
const STUDIO_USAGE =
  "Usage: drever studio <status [--json]|wait --after <revision> [--timeout <seconds>] [--json]|publish --file <path> [--json]>";
const CONFIG_COMMAND = {
  build: "build",
  check: "check",
  context: "check",
  dev: "serve",
  export: "build",
  mcp: "check",
} as const satisfies Readonly<
  Record<
    Exclude<
      DreverCommand,
      | AgentCommand
      | BrowserCommand
      | CreateCommand
      | CurrentCommand
      | DesignCommand
      | DoctorCommand
      | StudioCommand
    >["name"],
    LoadDreverConfigOptions["command"]
  >
>;

const invalidArgument = (message: string, hint: string): never => {
  throw new DreverCliError("DREVER_ARGUMENT_INVALID", message, { hint });
};

const parsePdfSlideRanges = (source: string): readonly PdfSlideRange[] =>
  Object.freeze(
    source.split(",").map((fragment) => {
      const range = fragment.trim();
      const match = /^(\d+)(?:-(\d+))?$/u.exec(range);
      if (match === null) {
        return invalidArgument(
          `Invalid --slides selection "${source}". Use one-based slide numbers and inclusive ranges such as 2-5,8.`,
          EXPORT_PDF_USAGE,
        );
      }
      const first = Number(match[1]);
      const last = Number(match[2] ?? match[1]);
      if (![first, last].every((value) => Number.isSafeInteger(value) && value > 0)) {
        return invalidArgument(
          `Invalid --slides range "${range}". Slide numbers must be positive safe integers.`,
          EXPORT_PDF_USAGE,
        );
      }
      if (first > last) {
        return invalidArgument(
          `Invalid --slides range "${range}". The first slide must not exceed the last slide.`,
          EXPORT_PDF_USAGE,
        );
      }
      return Object.freeze({ first, last });
    }),
  );

const parsePdfExport = (arguments_: readonly string[]): ExportPdfCommand => {
  let entry: string | undefined;
  let json = false;
  let output: string | undefined;
  let slides: readonly PdfSlideRange[] | undefined;
  let steps = false;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index] as string;
    if (argument === "--json") {
      if (json) {
        invalidArgument("--json can be specified only once.", EXPORT_PDF_USAGE);
      }
      json = true;
      continue;
    }
    if (argument === "--steps") {
      if (steps) {
        invalidArgument("--steps can be specified only once.", EXPORT_PDF_USAGE);
      }
      steps = true;
      continue;
    }
    if (argument === "--slides") {
      if (slides !== undefined) {
        invalidArgument("--slides can be specified only once.", EXPORT_PDF_USAGE);
      }
      const value =
        arguments_[index + 1] ??
        invalidArgument("--slides requires a slide selection such as 2-5,8.", EXPORT_PDF_USAGE);
      if (value.length === 0 || value.startsWith("-")) {
        invalidArgument("--slides requires a slide selection such as 2-5,8.", EXPORT_PDF_USAGE);
      }
      slides = parsePdfSlideRanges(value);
      index += 1;
      continue;
    }
    if (argument === "-o" || argument === "--output") {
      if (output !== undefined) {
        invalidArgument("The PDF output can be specified only once.", EXPORT_PDF_USAGE);
      }
      const value = arguments_[index + 1];
      if (value === undefined || value.length === 0 || value.startsWith("-")) {
        invalidArgument(`${argument} requires a PDF path.`, EXPORT_PDF_USAGE);
      }
      output = value;
      index += 1;
      continue;
    }
    if (argument.startsWith("-")) {
      invalidArgument(`Unknown export flag: ${argument}`, EXPORT_PDF_USAGE);
    }
    if (entry !== undefined) {
      invalidArgument("PDF export accepts at most one deck entry path.", EXPORT_PDF_USAGE);
    }
    entry = argument;
  }

  if (output !== undefined && !output.endsWith(".pdf")) {
    invalidArgument("The export output path must end with .pdf.", EXPORT_PDF_USAGE);
  }

  return Object.freeze({
    format: "pdf",
    json,
    name: "export",
    steps,
    ...(entry === undefined ? {} : { entry }),
    ...(output === undefined ? {} : { output }),
    ...(slides === undefined ? {} : { slides }),
  });
};

const parseBuild = (arguments_: readonly string[]): BuildCommand => {
  let entry: string | undefined;
  let json = false;

  for (const argument of arguments_) {
    if (argument === "--json") {
      if (json) {
        invalidArgument("--json can be specified only once.", BUILD_USAGE);
      }
      json = true;
      continue;
    }
    if (argument.startsWith("-")) {
      invalidArgument(`Unknown build flag: ${argument}`, BUILD_USAGE);
    }
    if (entry !== undefined) {
      invalidArgument("build accepts at most one deck entry path.", BUILD_USAGE);
    }
    entry = argument;
  }

  return Object.freeze({
    json,
    name: "build",
    ...(entry === undefined ? {} : { entry }),
  });
};

const parseCheck = (arguments_: readonly string[]): CheckCommand => {
  let entry: string | undefined;
  let json = false;
  let rendered = false;

  for (const argument of arguments_) {
    if (argument === "--json") {
      if (json) {
        invalidArgument("--json can be specified only once.", CHECK_USAGE);
      }
      json = true;
      continue;
    }
    if (argument === "--rendered") {
      if (rendered) {
        invalidArgument("--rendered can be specified only once.", CHECK_USAGE);
      }
      rendered = true;
      continue;
    }
    if (argument.startsWith("-")) {
      invalidArgument(`Unknown check flag: ${argument}`, CHECK_USAGE);
    }
    if (entry !== undefined) {
      invalidArgument("check accepts at most one deck entry path.", CHECK_USAGE);
    }
    entry = argument;
  }

  return Object.freeze({
    json,
    name: "check",
    rendered,
    ...(entry === undefined ? {} : { entry }),
  });
};

const parseContext = (arguments_: readonly string[]): ContextCommand => {
  let entry: string | undefined;
  let json = false;

  for (const argument of arguments_) {
    if (argument === "--json") {
      if (json) {
        invalidArgument("--json can be specified only once.", CONTEXT_USAGE);
      }
      json = true;
      continue;
    }
    if (argument.startsWith("-")) {
      invalidArgument(`Unknown context flag: ${argument}`, CONTEXT_USAGE);
    }
    if (entry !== undefined) {
      invalidArgument("context accepts at most one deck entry path.", CONTEXT_USAGE);
    }
    entry = argument;
  }

  return Object.freeze({
    json,
    name: "context",
    ...(entry === undefined ? {} : { entry }),
  });
};

const parseCurrent = (arguments_: readonly string[]): CurrentCommand => {
  let json = false;
  for (const argument of arguments_) {
    if (argument === "--json" && !json) {
      json = true;
      continue;
    }
    invalidArgument(
      argument === "--json"
        ? "--json can be specified only once."
        : `Unknown current argument: ${argument}`,
      CURRENT_USAGE,
    );
  }
  return Object.freeze({ json, name: "current" });
};

const parseDoctor = (arguments_: readonly string[]): DoctorCommand => {
  if (arguments_.length === 0) {
    return Object.freeze({ json: false, name: "doctor" });
  }
  if (arguments_.length === 1 && arguments_[0] === "--json") {
    return Object.freeze({ json: true, name: "doctor" });
  }
  return invalidArgument(
    arguments_.filter((argument) => argument === "--json").length > 1
      ? "--json can be specified only once."
      : `Unknown doctor argument: ${String(arguments_[0])}`,
    DOCTOR_USAGE,
  );
};

const parseAgent = (arguments_: readonly string[]): AgentCommand => {
  const [action, ...rest] = arguments_;
  if (action !== "sync") {
    invalidArgument(
      action === undefined ? "Agent action is required." : `Unknown agent action: ${action}`,
      AGENT_SYNC_USAGE,
    );
  }
  let target: AgentSyncTarget | undefined;
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index] as string;
    if (argument !== "--target") {
      invalidArgument(`Unknown agent sync argument: ${argument}`, AGENT_SYNC_USAGE);
    }
    if (target !== undefined) {
      invalidArgument("--target can be specified only once.", AGENT_SYNC_USAGE);
    }
    const value = rest[index + 1];
    if (value !== "all" && value !== "auto" && value !== "claude" && value !== "codex") {
      invalidArgument("--target requires one of: all, auto, claude, codex.", AGENT_SYNC_USAGE);
    }
    target = value as AgentSyncTarget;
    index += 1;
  }
  return Object.freeze({
    action: "sync",
    name: "agent",
    ...(target === undefined ? {} : { target }),
  });
};

const parseBrowser = (arguments_: readonly string[]): BrowserCommand => {
  const [action, ...rest] = arguments_;
  if (action !== "install") {
    invalidArgument(
      action === undefined ? "Browser action is required." : `Unknown browser action: ${action}`,
      BROWSER_INSTALL_USAGE,
    );
  }
  let withDeps = false;
  for (const argument of rest) {
    if (argument !== "--with-deps") {
      invalidArgument(`Unknown browser install argument: ${argument}`, BROWSER_INSTALL_USAGE);
    }
    if (withDeps) {
      invalidArgument("--with-deps can be specified only once.", BROWSER_INSTALL_USAGE);
    }
    withDeps = true;
  }
  return Object.freeze({ action: "install", name: "browser", withDeps });
};

const designIdentity = (source: string): Readonly<{ name: string; output: string }> => {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return invalidArgument("design import requires an absolute website URL.", DESIGN_IMPORT_USAGE);
  }
  if (url.username !== "" || url.password !== "") {
    return invalidArgument(
      "design import does not accept website URLs with embedded credentials.",
      DESIGN_IMPORT_USAGE,
    );
  }
  const identity = url.hostname
    .replace(/^www\./u, "")
    .split(".")
    .filter(Boolean)
    .join("-");
  const slug =
    identity
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
      .replace(/^-|-$/gu, "") || "reference";
  const name = slug
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
  return { name, output: `design/${slug}` };
};

const parseDesign = (arguments_: readonly string[]): DesignCommand => {
  const [action, ...rest] = arguments_;
  if (action !== "import") {
    invalidArgument(
      action === undefined ? "Design action is required." : `Unknown design action: ${action}`,
      DESIGN_IMPORT_USAGE,
    );
  }
  let colorScheme: DesignImportColorScheme = "light";
  let colorSchemeSet = false;
  let allowPrivate = false;
  let json = false;
  let output: string | undefined;
  let themeName: string | undefined;
  let url: string | undefined;
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index] as string;
    if (argument === "--json") {
      if (json) invalidArgument("--json can be specified only once.", DESIGN_IMPORT_USAGE);
      json = true;
      continue;
    }
    if (argument === "--allow-private") {
      if (allowPrivate) {
        invalidArgument("--allow-private can be specified only once.", DESIGN_IMPORT_USAGE);
      }
      allowPrivate = true;
      continue;
    }
    if (argument === "--name" || argument === "--output" || argument === "--color-scheme") {
      const value =
        rest[index + 1] ?? invalidArgument(`${argument} requires a value.`, DESIGN_IMPORT_USAGE);
      if (value.length === 0 || value.startsWith("-")) {
        invalidArgument(`${argument} requires a value.`, DESIGN_IMPORT_USAGE);
      }
      if (argument === "--name") {
        if (themeName !== undefined) {
          invalidArgument("--name can be specified only once.", DESIGN_IMPORT_USAGE);
        }
        themeName = value;
      } else if (argument === "--output") {
        if (output !== undefined) {
          invalidArgument("--output can be specified only once.", DESIGN_IMPORT_USAGE);
        }
        output = value;
      } else {
        if (colorSchemeSet) {
          invalidArgument("--color-scheme can be specified only once.", DESIGN_IMPORT_USAGE);
        }
        if (value !== "light" && value !== "dark") {
          invalidArgument("--color-scheme requires light or dark.", DESIGN_IMPORT_USAGE);
        }
        colorScheme = value as DesignImportColorScheme;
        colorSchemeSet = true;
      }
      index += 1;
      continue;
    }
    if (argument.startsWith("-")) {
      invalidArgument(`Unknown design import flag: ${argument}`, DESIGN_IMPORT_USAGE);
    }
    if (url !== undefined) {
      invalidArgument("design import accepts exactly one website URL.", DESIGN_IMPORT_USAGE);
    }
    url = argument;
  }
  const resolvedUrl =
    url ?? invalidArgument("design import requires a website URL.", DESIGN_IMPORT_USAGE);
  const defaults = designIdentity(resolvedUrl);
  return Object.freeze({
    action: "import",
    allowPrivate,
    colorScheme,
    json,
    name: "design",
    output: output ?? defaults.output,
    themeName: themeName ?? defaults.name,
    url: resolvedUrl,
  });
};

const parseMcp = (arguments_: readonly string[]): McpCommand => {
  const [entry, ...rest] = arguments_;
  if (rest.length > 0 || entry?.startsWith("-") === true) {
    invalidArgument("mcp accepts at most one deck entry path.", MCP_USAGE);
  }
  return Object.freeze({ name: "mcp", ...(entry === undefined ? {} : { entry }) });
};

const parseStudio = (arguments_: readonly string[]): StudioCommand => {
  const [action, ...rest] = arguments_;
  if (action !== "status" && action !== "wait" && action !== "publish") {
    invalidArgument(
      action === undefined ? "Studio action is required." : `Unknown Studio action: ${action}`,
      STUDIO_USAGE,
    );
  }
  let after: number | undefined;
  let file: string | undefined;
  let json = false;
  let timeoutSeconds = 45;
  let timeoutSet = false;
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index] as string;
    if (argument === "--json") {
      if (json) invalidArgument("--json can be specified only once.", STUDIO_USAGE);
      json = true;
      continue;
    }
    if (argument !== "--after" && argument !== "--timeout" && argument !== "--file") {
      invalidArgument(`Unknown Studio argument: ${argument}`, STUDIO_USAGE);
    }
    const raw = rest[index + 1];
    if (raw === undefined || raw.length === 0 || raw.startsWith("-")) {
      invalidArgument(`${argument} requires a value.`, STUDIO_USAGE);
    }
    if (argument === "--file") {
      if (file !== undefined) invalidArgument("--file can be specified only once.", STUDIO_USAGE);
      file = raw;
    } else {
      const value = Number(raw);
      if (!Number.isSafeInteger(value) || value < (argument === "--timeout" ? 1 : 0)) {
        invalidArgument(
          `${argument} requires ${argument === "--timeout" ? "a positive" : "a non-negative"} integer.`,
          STUDIO_USAGE,
        );
      }
      if (argument === "--after") {
        if (after !== undefined)
          invalidArgument("--after can be specified only once.", STUDIO_USAGE);
        after = value;
      } else {
        if (timeoutSet) invalidArgument("--timeout can be specified only once.", STUDIO_USAGE);
        if (value > 300) invalidArgument("--timeout cannot exceed 300 seconds.", STUDIO_USAGE);
        timeoutSeconds = value;
        timeoutSet = true;
      }
    }
    index += 1;
  }
  if (action === "status") {
    if (after !== undefined || file !== undefined || timeoutSet) {
      invalidArgument("studio status accepts only --json.", STUDIO_USAGE);
    }
    return Object.freeze({ action: "status", json, name: "studio" });
  }
  if (action === "wait") {
    if (file !== undefined) invalidArgument("studio wait does not accept --file.", STUDIO_USAGE);
    const afterRevision = after ?? invalidArgument("studio wait requires --after.", STUDIO_USAGE);
    return Object.freeze({
      action: "wait",
      after: afterRevision,
      json,
      name: "studio",
      timeoutSeconds,
    });
  }
  if (after !== undefined || timeoutSet) {
    invalidArgument("studio publish accepts --file and --json.", STUDIO_USAGE);
  }
  const publicationFile = file ?? invalidArgument("studio publish requires --file.", STUDIO_USAGE);
  return Object.freeze({ action: "publish", file: publicationFile, json, name: "studio" });
};

export const HELP = `Drever — AI-first MDX presentations

Usage:
  drever create [directory] [options]
  drever dev [entry]
  drever build [entry] [--json]
  drever check [entry] [--rendered] [--json]
  drever context [entry] [--json]
  drever current [--json]
  drever studio status [--json]
  drever studio wait --after <revision> [--timeout <seconds>] [--json]
  drever studio publish --file <path> [--json]
  drever doctor [--json]
  drever browser install [--with-deps]
  drever design import <url> [options]
  drever mcp [entry]
  drever export pdf [entry] [--steps] [--slides <range>] [-o|--output <path>] [--json]
  drever agent sync [--target <all|auto|codex|claude>]

The default entry is slides.mdx. Project settings live in drever.config.ts.
`;

export const parseCommand = (arguments_: readonly string[]): DreverCommand | "help" | "version" => {
  const [command, ...rest] = arguments_;
  if (command === undefined || command === "--help" || command === "-h") {
    return "help";
  }
  if (command === "--version" || command === "-v") {
    return "version";
  }
  if (command === "check") {
    return parseCheck(rest);
  }
  if (command === "context") {
    return parseContext(rest);
  }
  if (command === "current") {
    return parseCurrent(rest);
  }
  if (command === "doctor") {
    return parseDoctor(rest);
  }
  if (command === "browser") {
    return parseBrowser(rest);
  }
  if (command === "design") {
    return parseDesign(rest);
  }
  if (command === "mcp") {
    return parseMcp(rest);
  }
  if (command === "studio") {
    return parseStudio(rest);
  }
  if (command === "agent") {
    return parseAgent(rest);
  }
  if (command === "create") {
    return parseCreateArguments(rest);
  }
  if (command === "build") {
    return parseBuild(rest);
  }
  if (command === "export") {
    const [format, ...exportArguments] = rest;
    if (format !== "pdf") {
      return invalidArgument(
        format === undefined ? "Export format is required." : `Unknown export format: ${format}`,
        EXPORT_PDF_USAGE,
      );
    }
    return parsePdfExport(exportArguments);
  }
  if (command !== "dev") {
    throw new DreverCliError("DREVER_COMMAND_UNKNOWN", `Unknown command: ${command}`, {
      hint: "Run drever --help to see the available commands.",
    });
  }
  if (rest.length > 1 || rest[0]?.startsWith("-") === true) {
    throw new DreverCliError(
      "DREVER_ARGUMENT_INVALID",
      `${command} accepts at most one deck entry path.`,
      { hint: `Usage: drever ${command} [entry]` },
    );
  }
  return Object.freeze({
    name: command,
    ...(rest[0] === undefined ? {} : { entry: rest[0] }),
  });
};

export type RunCliOptions = Readonly<{
  checkDeck?: (request: CheckDeckRequest) => Promise<CheckExitCode>;
  createProject?: (options: CreateProjectOptions) => Promise<CreateProjectResult>;
  cwd?: string;
  environment?: NodeJS.ProcessEnv;
  exportPdf?: (request: PdfExportRequest) => Promise<void>;
  importDesign?: (request: ImportWebsiteDesignOptions) => Promise<DesignImportReceipt>;
  installBrowser?: (request: BrowserInstallRequest) => Promise<void>;
  runDoctor?: (request: RunDoctorRequest) => Promise<CheckExitCode>;
  runStudioCommand?: (request: RunStudioCommandRequest) => Promise<void>;
  syncAgentKit?: (options: SyncAgentKitOptions) => Promise<AgentSyncResult>;
  serveMcp?: (request: RunMcpServerRequest) => Promise<void>;
  stdin?: NodeJS.ReadableStream;
  stdout?: Pick<NodeJS.WriteStream, "write">;
  writeAuthoringContext?: (request: WriteAuthoringContextRequest) => Promise<unknown>;
  writeCurrentPosition?: (request: WriteCurrentPositionRequest) => Promise<unknown>;
}>;

export type RunCliResult = CheckExitCode | void | ViteDevServer;

const createPdfExportRequest = (
  command: ExportPdfCommand,
  project: ResolvedDreverProject,
): PdfExportRequest => {
  const entryName = basename(project.entry, extname(project.entry));
  const output = resolve(project.root, command.output ?? `${entryName}-export.pdf`);
  return Object.freeze({
    output,
    project,
    steps: command.steps,
    ...(command.slides === undefined ? {} : { slides: command.slides }),
  });
};

const formatAgentSyncResult = ({ files }: AgentSyncResult): string => {
  const count = (status: AgentSyncResult["files"][number]["status"]): number =>
    files.filter((file) => file.status === status).length;
  return `Synced Drever agent kit: ${count("created")} created, ${count("updated")} updated, ${count("unchanged")} unchanged.\n`;
};

const designImportPath = (root: string, output: string): string => {
  const path = relative(root, output).split(sep).join("/");
  return path.startsWith(".") ? path : `./${path}`;
};

export const runCli = async (
  arguments_: readonly string[],
  options: RunCliOptions = {},
): Promise<RunCliResult> => {
  const command = parseCommand(arguments_);
  const output = options.stdout ?? process.stdout;
  if (command === "help") {
    output.write(HELP);
    return;
  }
  if (command === "version") {
    output.write(`${DREVER_VERSION}\n`);
    return;
  }

  const root = options.cwd ?? process.cwd();
  if (command.name === "create") {
    await runCreateCommand(command, {
      ...(options.createProject === undefined ? {} : { createProject: options.createProject }),
      cwd: root,
      ...(options.environment === undefined ? {} : { environment: options.environment }),
      stdout: output,
    });
    return;
  }
  if (command.name === "doctor") {
    const runDoctor =
      options.runDoctor ??
      (async (request: RunDoctorRequest): Promise<CheckExitCode> => {
        const doctor = await import("./doctor.ts");
        return doctor.runDoctor(request);
      });
    return runDoctor({ json: command.json, root, stdout: output });
  }
  if (command.name === "browser") {
    const installBrowser =
      options.installBrowser ??
      (async (request: BrowserInstallRequest): Promise<void> => {
        const browser = await import("./browser-install.ts");
        await browser.installBrowser(request);
      });
    await installBrowser({ withDeps: command.withDeps });
    output.write(
      "Playwright Chromium is ready for Drever PDF export, rendered preflight, and design import.\n",
    );
    return;
  }
  if (command.name === "design") {
    const importDesign =
      options.importDesign ??
      (async (request: ImportWebsiteDesignOptions): Promise<DesignImportReceipt> => {
        const design = await import("./design-import.ts");
        return design.importWebsiteDesign(request);
      });
    const result = await importDesign({
      allowPrivate: command.allowPrivate,
      colorScheme: command.colorScheme,
      name: command.themeName,
      output: command.output,
      root,
      url: command.url,
    });
    if (command.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      const path = designImportPath(root, result.output);
      output.write(
        `Imported rendered design evidence to ${result.output}\n` +
          `Next: import theme from "${path}/theme.ts" in drever.config.ts, then run drever check --rendered.\n`,
      );
    }
    return;
  }
  if (command.name === "agent") {
    const syncAgentKit =
      options.syncAgentKit ??
      (async (request: SyncAgentKitOptions): Promise<AgentSyncResult> => {
        const agent = await import("./agent-sync.ts");
        return agent.syncAgentKit(request);
      });
    output.write(
      formatAgentSyncResult(
        await syncAgentKit({
          root,
          ...(command.target === undefined ? {} : { target: command.target }),
        }),
      ),
    );
    return;
  }

  if (command.name === "current") {
    const writeCurrentPosition =
      options.writeCurrentPosition ??
      (async (request: WriteCurrentPositionRequest): Promise<unknown> => {
        const current = await import("./current-position.ts");
        return current.writeCurrentPosition(request);
      });
    await writeCurrentPosition({ json: command.json, root, stdout: output });
    return;
  }
  if (command.name === "studio") {
    const runStudioCommand =
      options.runStudioCommand ??
      (async (request: RunStudioCommandRequest): Promise<void> => {
        const studio = await import("./studio-command.ts");
        await studio.runStudioCommand(request);
      });
    await runStudioCommand({ command, root, stdout: output });
    return;
  }

  const loaded = await loadDreverConfig({
    command: CONFIG_COMMAND[command.name],
    root,
  });
  if (command.name === "check") {
    const project = command.rendered
      ? await resolveDreverProject({
          config: loaded.config,
          ...(command.entry === undefined ? {} : { entry: command.entry }),
          includeSourceLocations: true,
          root,
        })
      : undefined;
    const entry =
      project?.entry ??
      (await resolveDreverEntry({
        config: loaded.config,
        ...(command.entry === undefined ? {} : { entry: command.entry }),
        root,
      }));
    const checkDeck =
      options.checkDeck ??
      (async (request: CheckDeckRequest): Promise<CheckExitCode> => {
        const checker = await import("./check.ts");
        return checker.checkDeck(request);
      });
    return checkDeck({
      entry,
      json: command.json,
      ...(project === undefined ? {} : { project }),
      root,
      stdout: output,
    });
  }
  if (command.name === "context") {
    const project = await resolveDreverPlan({
      config: loaded.config,
      ...(command.entry === undefined ? {} : { entry: command.entry }),
      root,
    });
    const writeAuthoringContext =
      options.writeAuthoringContext ??
      (async (request: WriteAuthoringContextRequest): Promise<unknown> => {
        const context = await import("./context.ts");
        return context.writeAuthoringContext(request);
      });
    await writeAuthoringContext({ project, json: command.json, stdout: output });
    return;
  }
  if (command.name === "mcp") {
    const project = await resolveDreverPlan({
      config: loaded.config,
      ...(command.entry === undefined ? {} : { entry: command.entry }),
      root,
    });
    const serveMcp =
      options.serveMcp ??
      (async (request: RunMcpServerRequest): Promise<void> => {
        const mcp = await import("./mcp-server.ts");
        await mcp.runMcpServer(request);
      });
    await serveMcp({
      input: options.stdin ?? process.stdin,
      output,
      project,
    });
    return;
  }
  const resolveProject =
    command.name === "dev" ? resolveDreverDevelopmentProject : resolveDreverProject;
  const project = await resolveProject({
    config: loaded.config,
    ...(command.entry === undefined ? {} : { entry: command.entry }),
    root,
  });
  if (command.name === "export") {
    const request = createPdfExportRequest(command, project);
    const exportPdf =
      options.exportPdf ??
      (async (value: PdfExportRequest): Promise<void> => {
        const exporter = await import("./export-pdf.ts");
        await exporter.exportPdf(value);
      });
    await exportPdf(request);
    if (command.json) {
      writeArtifactReceipt(
        createArtifactReceipt("export", project.entry, [
          {
            kind: "pdf",
            path: request.output,
            steps: request.steps,
            ...(request.slides === undefined ? {} : { slides: request.slides }),
          },
        ]),
        output,
      );
    } else {
      output.write(`Exported ${project.entry} to ${request.output}\n`);
    }
    return;
  }
  if (command.name === "build") {
    await buildDreverProject(project, { quiet: command.json });
    if (command.json) {
      writeArtifactReceipt(
        createArtifactReceipt("build", project.entry, [
          { entry: resolve(project.outDir, "index.html"), kind: "website", path: project.outDir },
        ]),
        output,
      );
    } else {
      output.write(`Built ${project.entry} to ${project.outDir}\n`);
    }
    return;
  }
  return serveDreverProject(project);
};

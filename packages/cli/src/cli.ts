import { basename, extname, resolve } from "node:path";
import type { ViteDevServer } from "vite";
import { loadDreverConfig, type LoadDreverConfigOptions } from "./config.ts";
import { DreverCliError } from "./errors.ts";
import {
  resolveDreverEntry,
  resolveDreverPlan,
  resolveDreverProject,
  type ResolvedDreverProject,
} from "./project.ts";
import { buildDreverProject, serveDreverProject } from "./vite-app.ts";
import type { CheckDeckRequest, CheckExitCode } from "./check.ts";
import type { AgentSyncResult, SyncAgentKitOptions } from "./agent-sync.ts";
import type { WriteAuthoringContextRequest } from "./context.ts";
import type { WriteCurrentPositionRequest } from "./current-position.ts";
import type { RunMcpServerRequest } from "./mcp-server.ts";

export type AgentCommand = Readonly<{
  action: "sync";
  name: "agent";
}>;

type ProjectCommand = Readonly<{
  entry?: string;
  name: "build" | "dev";
}>;

export type CheckCommand = Readonly<{
  entry?: string;
  json: boolean;
  name: "check";
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

export type McpCommand = Readonly<{
  entry?: string;
  name: "mcp";
}>;

export type ExportPdfCommand = Readonly<{
  entry?: string;
  format: "pdf";
  name: "export";
  output?: string;
  steps: boolean;
}>;

export type DreverCommand =
  | AgentCommand
  | CheckCommand
  | ContextCommand
  | CurrentCommand
  | ExportPdfCommand
  | McpCommand
  | ProjectCommand;

export type PdfExportRequest = Readonly<{
  output: string;
  project: ResolvedDreverProject;
  steps: boolean;
}>;

const EXPORT_PDF_USAGE = "Usage: drever export pdf [entry] [--steps] [-o|--output <path>]";
const CHECK_USAGE = "Usage: drever check [entry] [--json]";
const CONTEXT_USAGE = "Usage: drever context [entry] [--json]";
const CURRENT_USAGE = "Usage: drever current [--json]";
const MCP_USAGE = "Usage: drever mcp [entry]";
const AGENT_SYNC_USAGE = "Usage: drever agent sync";
const CONFIG_COMMAND = {
  build: "build",
  check: "check",
  context: "check",
  dev: "serve",
  export: "build",
  mcp: "check",
} as const satisfies Readonly<
  Record<
    Exclude<DreverCommand, AgentCommand | CurrentCommand>["name"],
    LoadDreverConfigOptions["command"]
  >
>;

const invalidArgument = (message: string, hint: string): never => {
  throw new DreverCliError("DREVER_ARGUMENT_INVALID", message, { hint });
};

const parsePdfExport = (arguments_: readonly string[]): ExportPdfCommand => {
  let entry: string | undefined;
  let output: string | undefined;
  let steps = false;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index] as string;
    if (argument === "--steps") {
      if (steps) {
        invalidArgument("--steps can be specified only once.", EXPORT_PDF_USAGE);
      }
      steps = true;
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
    name: "export",
    steps,
    ...(entry === undefined ? {} : { entry }),
    ...(output === undefined ? {} : { output }),
  });
};

const parseCheck = (arguments_: readonly string[]): CheckCommand => {
  let entry: string | undefined;
  let json = false;

  for (const argument of arguments_) {
    if (argument === "--json") {
      if (json) {
        invalidArgument("--json can be specified only once.", CHECK_USAGE);
      }
      json = true;
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

const parseAgent = (arguments_: readonly string[]): AgentCommand => {
  const [action, ...rest] = arguments_;
  if (action !== "sync") {
    invalidArgument(
      action === undefined ? "Agent action is required." : `Unknown agent action: ${action}`,
      AGENT_SYNC_USAGE,
    );
  }
  if (rest.length > 0) {
    invalidArgument("agent sync does not accept arguments.", AGENT_SYNC_USAGE);
  }
  return Object.freeze({ action: "sync", name: "agent" });
};

const parseMcp = (arguments_: readonly string[]): McpCommand => {
  const [entry, ...rest] = arguments_;
  if (rest.length > 0 || entry?.startsWith("-") === true) {
    invalidArgument("mcp accepts at most one deck entry path.", MCP_USAGE);
  }
  return Object.freeze({ name: "mcp", ...(entry === undefined ? {} : { entry }) });
};

export const HELP = `Drever — AI-first MDX presentations

Usage:
  drever dev [entry]
  drever build [entry]
  drever check [entry] [--json]
  drever context [entry] [--json]
  drever current [--json]
  drever mcp [entry]
  drever export pdf [entry] [--steps] [-o|--output <path>]
  drever agent sync

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
  if (command === "mcp") {
    return parseMcp(rest);
  }
  if (command === "agent") {
    return parseAgent(rest);
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
  if (command !== "dev" && command !== "build") {
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
  cwd?: string;
  exportPdf?: (request: PdfExportRequest) => Promise<void>;
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
  return Object.freeze({ output, project, steps: command.steps });
};

const formatAgentSyncResult = ({ files }: AgentSyncResult): string => {
  const count = (status: AgentSyncResult["files"][number]["status"]): number =>
    files.filter((file) => file.status === status).length;
  return `Synced Drever agent kit: ${count("created")} created, ${count("updated")} updated, ${count("unchanged")} unchanged.\n`;
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
    output.write("0.0.0\n");
    return;
  }

  const root = options.cwd ?? process.cwd();
  if (command.name === "agent") {
    const syncAgentKit =
      options.syncAgentKit ??
      (async (request: SyncAgentKitOptions): Promise<AgentSyncResult> => {
        const agent = await import("./agent-sync.ts");
        return agent.syncAgentKit(request);
      });
    output.write(formatAgentSyncResult(await syncAgentKit({ root })));
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

  const loaded = await loadDreverConfig({
    command: CONFIG_COMMAND[command.name],
    root,
  });
  if (command.name === "check") {
    const entry = await resolveDreverEntry({
      config: loaded.config,
      ...(command.entry === undefined ? {} : { entry: command.entry }),
      root,
    });
    const checkDeck =
      options.checkDeck ??
      (async (request: CheckDeckRequest): Promise<CheckExitCode> => {
        const checker = await import("./check.ts");
        return checker.checkDeck(request);
      });
    return checkDeck({ entry, json: command.json, stdout: output });
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
  const project = await resolveDreverProject({
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
    output.write(`Exported ${project.entry} to ${request.output}\n`);
    return;
  }
  if (command.name === "build") {
    await buildDreverProject(project);
    output.write(`Built ${project.entry} to ${project.outDir}\n`);
    return;
  }
  return serveDreverProject(project);
};

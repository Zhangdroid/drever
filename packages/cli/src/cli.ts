import { basename, extname, resolve } from "node:path";
import type { ViteDevServer } from "vite";
import { loadDreverConfig, type LoadDreverConfigOptions } from "./config.ts";
import { DreverCliError } from "./errors.ts";
import { resolveDreverEntry, resolveDreverProject, type ResolvedDreverProject } from "./project.ts";
import { buildDreverProject, serveDreverProject } from "./vite-app.ts";
import type { CheckDeckRequest, CheckExitCode } from "./check.ts";

type ProjectCommand = Readonly<{
  entry?: string;
  name: "build" | "dev";
}>;

export type CheckCommand = Readonly<{
  entry?: string;
  json: boolean;
  name: "check";
}>;

export type ExportPdfCommand = Readonly<{
  entry?: string;
  format: "pdf";
  name: "export";
  output?: string;
  steps: boolean;
}>;

export type DreverCommand = CheckCommand | ExportPdfCommand | ProjectCommand;

export type PdfExportRequest = Readonly<{
  output: string;
  project: ResolvedDreverProject;
  steps: boolean;
}>;

const EXPORT_PDF_USAGE = "Usage: drever export pdf [entry] [--steps] [-o|--output <path>]";
const CHECK_USAGE = "Usage: drever check [entry] [--json]";
const CONFIG_COMMAND = {
  build: "build",
  check: "check",
  dev: "serve",
  export: "build",
} as const satisfies Readonly<Record<DreverCommand["name"], LoadDreverConfigOptions["command"]>>;

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

export const HELP = `Drever — AI-first MDX presentations

Usage:
  drever dev [entry]
  drever build [entry]
  drever check [entry] [--json]
  drever export pdf [entry] [--steps] [-o|--output <path>]

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
  stdout?: Pick<NodeJS.WriteStream, "write">;
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

import type { ViteDevServer } from "vite";
import { loadDreverConfig } from "./config.ts";
import { DreverCliError } from "./errors.ts";
import { resolveDreverProject } from "./project.ts";
import { buildDreverProject, serveDreverProject } from "./vite-app.ts";

export type DreverCommand = Readonly<{
  entry?: string;
  name: "build" | "dev";
}>;

export const HELP = `Drever — AI-first MDX presentations

Usage:
  drever dev [entry]
  drever build [entry]

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
  cwd?: string;
  stdout?: Pick<NodeJS.WriteStream, "write">;
}>;

export const runCli = async (
  arguments_: readonly string[],
  options: RunCliOptions = {},
): Promise<void | ViteDevServer> => {
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
    command: command.name === "dev" ? "serve" : "build",
    root,
  });
  const project = await resolveDreverProject({
    config: loaded.config,
    ...(command.entry === undefined ? {} : { entry: command.entry }),
    root,
  });
  if (command.name === "build") {
    await buildDreverProject(project);
    output.write(`Built ${project.entry} to ${project.outDir}\n`);
    return;
  }
  return serveDreverProject(project);
};

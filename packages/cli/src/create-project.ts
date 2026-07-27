import { spawn } from "node:child_process";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  syncAgentKit as syncBundledAgentKit,
  type AgentSyncFileResult,
  type AgentSyncTarget,
  type SyncAgentKitOptions,
} from "./agent-sync.ts";
import { DreverCliError } from "./errors.ts";
import { DREVER_VERSION } from "./package-version.ts";

export type CreateAgentTarget = AgentSyncTarget | "none";
export type CreateOpenTarget = "claude" | "codex";
export type CreatePackageManager = "bun" | "npm" | "pnpm" | "yarn";

export type CreateCommand = Readonly<{
  agent: CreateAgentTarget;
  directory: string;
  help: boolean;
  install: boolean;
  json: boolean;
  name: "create";
  open?: CreateOpenTarget;
  packageManager?: CreatePackageManager;
}>;

export type CreateProjectResult = Readonly<{
  agentFiles: readonly AgentSyncFileResult[];
  files: readonly string[];
  installed: boolean;
  opened?: CreateOpenTarget;
  packageManager: CreatePackageManager;
  root: string;
  version: 1;
}>;

export type CreateProjectOptions = Readonly<{
  agent: CreateAgentTarget;
  dreverVersion?: string;
  environment?: NodeJS.ProcessEnv;
  install: boolean;
  installDependencies?: (request: InstallDependenciesRequest) => Promise<void>;
  open?: CreateOpenTarget;
  openAgent?: (target: CreateOpenTarget, root: string) => Promise<void>;
  packageManager?: CreatePackageManager;
  quiet?: boolean;
  root: string;
  syncAgentKit?: (
    options: SyncAgentKitOptions,
  ) => Promise<{ files: readonly AgentSyncFileResult[] }>;
  templateRoot?: string | URL;
}>;

export type InstallDependenciesRequest = Readonly<{
  packageManager: CreatePackageManager;
  quiet: boolean;
  root: string;
}>;

export type RunCreateCommandOptions = Readonly<{
  createProject?: (options: CreateProjectOptions) => Promise<CreateProjectResult>;
  cwd?: string;
  environment?: NodeJS.ProcessEnv;
  stdout?: Pick<NodeJS.WriteStream, "write">;
}>;

const CREATE_USAGE = "Usage: drever create [directory] [options]";

export const CREATE_HELP = `Create a Drever presentation

${CREATE_USAGE}

Options:
  --agent <all|auto|codex|claude|none>  Install project-local AI skills (default: all)
  --open <codex|claude>                 Open the project with a prepared prompt
  --package-manager <npm|pnpm|yarn|bun> Choose the installer
  --no-install                          Create files without installing dependencies
  --json                                Print a machine-readable result
  -h, --help                            Show this help
`;

const TEMPLATE_FILES = [
  "README.md",
  "brief.md",
  "drever.config.ts",
  "slides.mdx",
  "gitignore",
] as const;
const PROJECT_TEMPLATE_FILES = [
  "README.md",
  "brief.md",
  "drever.config.ts",
  "slides.mdx",
  ".gitignore",
] as const;
const CREATED_FILES = ["package.json", ...PROJECT_TEMPLATE_FILES] as const;
const AGENT_TARGETS = new Set<CreateAgentTarget>(["all", "auto", "claude", "codex", "none"]);
const OPEN_TARGETS = new Set<CreateOpenTarget>(["claude", "codex"]);
const PACKAGE_MANAGERS = new Set<CreatePackageManager>(["bun", "npm", "pnpm", "yarn"]);
const AGENT_PROMPT =
  "Use the project-local drever-create-deck skill to turn brief.md into an early live draft, then refine it into a complete presentation and deliver the requested outputs.";

const invalidArgument = (message: string): never => {
  throw new DreverCliError("DREVER_ARGUMENT_INVALID", message, { hint: CREATE_USAGE });
};

const parseChoice = <Value extends string>(
  argument: string,
  value: string | undefined,
  choices: ReadonlySet<Value>,
): Value => {
  if (value === undefined || value.startsWith("-") || !choices.has(value as Value)) {
    return invalidArgument(`${argument} requires one of: ${[...choices].join(", ")}.`);
  }
  return value as Value;
};

export const parseCreateArguments = (arguments_: readonly string[]): CreateCommand => {
  let agent: CreateAgentTarget = "all";
  let agentSet = false;
  let directory = ".";
  let directorySet = false;
  let help = false;
  let install = true;
  let json = false;
  let open: CreateOpenTarget | undefined;
  let packageManager: CreatePackageManager | undefined;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index] as string;
    if (argument === "-h" || argument === "--help") {
      help = true;
      continue;
    }
    if (argument === "--no-install") {
      if (!install) {
        invalidArgument("--no-install can be specified only once.");
      }
      install = false;
      continue;
    }
    if (argument === "--json") {
      if (json) {
        invalidArgument("--json can be specified only once.");
      }
      json = true;
      continue;
    }
    if (argument === "--agent") {
      if (agentSet) {
        invalidArgument("--agent can be specified only once.");
      }
      agent = parseChoice(argument, arguments_[index + 1], AGENT_TARGETS);
      agentSet = true;
      index += 1;
      continue;
    }
    if (argument === "--open") {
      if (open !== undefined) {
        invalidArgument("--open can be specified only once.");
      }
      open = parseChoice(argument, arguments_[index + 1], OPEN_TARGETS);
      index += 1;
      continue;
    }
    if (argument === "--package-manager") {
      if (packageManager !== undefined) {
        invalidArgument("--package-manager can be specified only once.");
      }
      packageManager = parseChoice(argument, arguments_[index + 1], PACKAGE_MANAGERS);
      index += 1;
      continue;
    }
    if (argument.startsWith("-")) {
      invalidArgument(`Unknown create flag: ${argument}`);
    }
    if (directorySet) {
      invalidArgument("create accepts at most one project directory.");
    }
    directory = argument;
    directorySet = true;
  }

  if (open !== undefined && agent !== "all" && agent !== open) {
    invalidArgument(`--open ${open} requires --agent ${open} or --agent all.`);
  }

  return Object.freeze({
    agent,
    directory,
    help,
    install,
    json,
    name: "create",
    ...(open === undefined ? {} : { open }),
    ...(packageManager === undefined ? {} : { packageManager }),
  });
};

const errorCode = (error: unknown): string | undefined =>
  error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      return false;
    }
    throw error;
  }
};

const ensureDirectoryTarget = async (root: string): Promise<void> => {
  try {
    const metadata = await lstat(root);
    if (!metadata.isDirectory()) {
      throw new DreverCliError(
        "DREVER_CREATE_TARGET_INVALID",
        `The project target is not a directory: ${root}`,
      );
    }
  } catch (error) {
    if (errorCode(error) !== "ENOENT") {
      throw error;
    }
  }
};

const templateRootPath = (templateRoot: string | URL | undefined): string =>
  typeof templateRoot === "string"
    ? templateRoot
    : fileURLToPath(templateRoot ?? new URL("../create-template/", import.meta.url));

const readTemplates = async (templateRoot: string): Promise<ReadonlyMap<string, string>> => {
  try {
    return new Map(
      await Promise.all(
        TEMPLATE_FILES.map(
          async (path) => [path, await readFile(join(templateRoot, path), "utf8")] as const,
        ),
      ),
    );
  } catch (cause) {
    throw new DreverCliError(
      "DREVER_CREATE_TEMPLATE_INVALID",
      "Could not read the bundled project template.",
      { cause, details: { templateRoot } },
    );
  }
};

const isPackageNameEdge = (character: string): boolean =>
  character === "." || character === "_" || character === "-";

const trimPackageNameEdges = (value: string): string => {
  let start = 0;
  let end = value.length;

  while (start < end && isPackageNameEdge(value.charAt(start))) {
    start += 1;
  }
  while (end > start && isPackageNameEdge(value.charAt(end - 1))) {
    end -= 1;
  }

  return value.slice(start, end);
};

const projectPackageName = (root: string): string => {
  const normalized = trimPackageNameEdges(
    basename(root)
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/gu, "-"),
  );
  return normalized.length === 0 ? "drever-presentation" : normalized;
};

const projectPackage = (root: string, dreverVersion: string): string =>
  `${JSON.stringify(
    {
      name: projectPackageName(root),
      version: "0.0.0",
      private: true,
      type: "module",
      scripts: {
        build: "drever build",
        check: "drever check",
        dev: "drever dev",
        export: "drever export pdf",
      },
      devDependencies: { drever: dreverVersion },
    },
    null,
    2,
  )}\n`;

const detectPackageManager = (environment: NodeJS.ProcessEnv): CreatePackageManager => {
  const name = environment.npm_config_user_agent?.split("/")[0];
  return PACKAGE_MANAGERS.has(name as CreatePackageManager)
    ? (name as CreatePackageManager)
    : "npm";
};

const processInvocation = (
  packageManager: CreatePackageManager,
): Readonly<{ arguments: readonly string[]; command: string }> => ({
  arguments: ["install"],
  command: packageManager,
});

const projectReadme = (template: string, packageManager: CreatePackageManager): string => {
  const scriptRunner = packageManager === "npm" ? "npm run" : `${packageManager} run`;
  return template.replaceAll("npm run", scriptRunner);
};

export const installProjectDependencies = async ({
  packageManager,
  quiet,
  root,
}: InstallDependenciesRequest): Promise<void> => {
  const invocation = processInvocation(packageManager);
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(invocation.command, invocation.arguments, {
      cwd: root,
      stdio: quiet ? ["ignore", "ignore", "inherit"] : "inherit",
    });
    child.once("error", rejectPromise);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(
        new Error(
          signal === null
            ? `${packageManager} install exited with code ${String(code)}.`
            : `${packageManager} install exited after ${signal}.`,
        ),
      );
    });
  });
};

export const createAgentDeepLink = (target: CreateOpenTarget, root: string): string => {
  const parameters =
    target === "codex"
      ? new URLSearchParams({ path: root, prompt: AGENT_PROMPT })
      : new URLSearchParams({ cwd: root, q: AGENT_PROMPT });
  return `${target === "codex" ? "codex://new" : "claude-cli://open"}?${parameters.toString()}`;
};

export const openProjectAgent = async (target: CreateOpenTarget, root: string): Promise<void> => {
  const url = createAgentDeepLink(target, root);
  const invocation =
    process.platform === "darwin"
      ? { arguments: [url], command: "open" }
      : process.platform === "win32"
        ? { arguments: ["url.dll,FileProtocolHandler", url], command: "rundll32.exe" }
        : { arguments: [url], command: "xdg-open" };

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(invocation.command, invocation.arguments, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.once("error", rejectPromise);
    child.once("spawn", () => {
      child.unref();
      resolvePromise();
    });
  });
};

export const createDreverProject = async ({
  agent,
  dreverVersion,
  environment = process.env,
  install,
  installDependencies = installProjectDependencies,
  open,
  openAgent = openProjectAgent,
  packageManager: requestedPackageManager,
  quiet = false,
  root,
  syncAgentKit = syncBundledAgentKit,
  templateRoot,
}: CreateProjectOptions): Promise<CreateProjectResult> => {
  if (open !== undefined && agent !== "all" && agent !== open) {
    invalidArgument(`Opening ${open} requires the matching agent adapter or the all target.`);
  }
  const resolvedRoot = resolve(root);
  await ensureDirectoryTarget(resolvedRoot);
  const sourceRoot = templateRootPath(templateRoot);
  const [templates, version] = await Promise.all([
    readTemplates(sourceRoot),
    Promise.resolve(dreverVersion ?? DREVER_VERSION),
  ]);
  const conflicts = (
    await Promise.all(
      CREATED_FILES.map(async (path) =>
        (await pathExists(join(resolvedRoot, path))) ? path : undefined,
      ),
    )
  ).flatMap((path) => (path === undefined ? [] : [path]));
  if (conflicts.length > 0) {
    throw new DreverCliError(
      "DREVER_CREATE_CONFLICT",
      `Project creation found existing files:\n${conflicts.map((path) => `- ${path}`).join("\n")}`,
      {
        details: { conflicts: Object.freeze(conflicts), root: resolvedRoot },
        hint: "Choose an empty directory or move the listed files before retrying.",
      },
    );
  }

  const packageManager = requestedPackageManager ?? detectPackageManager(environment);
  await mkdir(resolvedRoot, { recursive: true });
  const agentResult =
    agent === "none" ? { files: [] } : await syncAgentKit({ root: resolvedRoot, target: agent });
  const contents = new Map<string, string>([
    ["package.json", projectPackage(resolvedRoot, version)],
    ...TEMPLATE_FILES.map(
      (path) =>
        [
          path === "gitignore" ? ".gitignore" : path,
          path === "README.md"
            ? projectReadme(templates.get(path) as string, packageManager)
            : (templates.get(path) as string),
        ] as const,
    ),
  ]);
  for (const [path, value] of contents) {
    const destination = join(resolvedRoot, path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, value, "utf8");
  }

  if (install) {
    try {
      await installDependencies({ packageManager, quiet, root: resolvedRoot });
    } catch (cause) {
      throw new DreverCliError(
        "DREVER_CREATE_INSTALL_FAILED",
        `Created the project, but ${packageManager} could not install its dependencies.`,
        {
          cause,
          details: { packageManager, root: resolvedRoot },
          hint: `Run ${packageManager} install in ${resolvedRoot}.`,
        },
      );
    }
  }
  if (open !== undefined) {
    try {
      await openAgent(open, resolvedRoot);
    } catch (cause) {
      throw new DreverCliError(
        "DREVER_CREATE_OPEN_FAILED",
        `Created the project, but could not open it in ${open === "codex" ? "Codex" : "Claude Code"}.`,
        { cause, details: { root: resolvedRoot, target: open } },
      );
    }
  }

  return Object.freeze({
    agentFiles: Object.freeze(agentResult.files),
    files: Object.freeze([...CREATED_FILES]),
    installed: install,
    ...(open === undefined ? {} : { opened: open }),
    packageManager,
    root: resolvedRoot,
    version: 1,
  });
};

const formatCreateResult = (result: CreateProjectResult): string =>
  [
    `Created a Drever presentation in ${result.root}.`,
    "",
    ...(result.agentFiles.length === 0
      ? []
      : [
          "Open the project in Codex or Claude Code and say:",
          "  Use Drever to turn brief.md into a complete presentation and deliver the requested outputs.",
          "",
          "The project-local AI skills are ready.",
        ]),
    ...(result.installed
      ? []
      : [
          `${result.packageManager} dependencies were not installed. Run ${result.packageManager} install before using the project.`,
        ]),
    "Manual commands are documented in README.md.",
    "",
  ].join("\n");

export const runCreateCommand = async (
  command: CreateCommand,
  options: RunCreateCommandOptions = {},
): Promise<CreateProjectResult | void> => {
  const output = options.stdout ?? process.stdout;
  if (command.help) {
    output.write(CREATE_HELP);
    return;
  }
  const root = resolve(options.cwd ?? process.cwd(), command.directory);
  const createProject = options.createProject ?? createDreverProject;
  const result = await createProject({
    agent: command.agent,
    ...(options.environment === undefined ? {} : { environment: options.environment }),
    install: command.install,
    ...(command.open === undefined ? {} : { open: command.open }),
    ...(command.packageManager === undefined ? {} : { packageManager: command.packageManager }),
    quiet: command.json,
    root,
  });
  output.write(command.json ? `${JSON.stringify(result, null, 2)}\n` : formatCreateResult(result));
  return result;
};

export const runCreateCli = (
  arguments_: readonly string[],
  options: RunCreateCommandOptions = {},
): Promise<CreateProjectResult | void> =>
  runCreateCommand(parseCreateArguments(arguments_), options);

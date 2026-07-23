import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const COMMANDS = new Set(["build", "check", "dev"]);
const DEFAULT_THEME = "fieldnote";
const THEMES = ["fieldnote", "atlas", "ledger", "cinema", "construct"];

const usage = `Theme showcase

Usage:
  node scripts/run.mjs <dev|check|build> [--theme <name>] [--all] [-- <drever args>]

Themes:
  ${THEMES.join(", ")}

DREVER_THEME is the canonical selector. --theme is a cross-platform convenience
that sets DREVER_THEME for the Drever child process. --all is available for
check and build only.`;

const fail = (message) => {
  console.error(`[theme-showcase] ${message}\n\n${usage}`);
  return 2;
};

const parseArguments = (arguments_) => {
  const [command, ...rest] = arguments_;
  let all = false;
  let argumentError;
  let requestedTheme;
  const forwarded = [];

  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];

    if (argument === "--") {
      forwarded.push(...rest.slice(index + 1));
      break;
    }
    if (argument === "--all") {
      all = true;
      continue;
    }
    if (argument === "--theme") {
      const value = rest[index + 1];
      if (value === undefined || value.startsWith("--")) {
        argumentError = "--theme requires a theme name.";
        break;
      }
      requestedTheme = value;
      index += 1;
      continue;
    }
    if (argument.startsWith("--theme=")) {
      requestedTheme = argument.slice("--theme=".length);
      continue;
    }
    forwarded.push(argument);
  }

  return { all, argumentError, command, forwarded, requestedTheme };
};

const resolveTheme = (value) => {
  const theme = value.trim().toLowerCase();
  return THEMES.includes(theme) ? theme : undefined;
};

const resolveDreverBinary = async () => {
  const packageJsonUrl = import.meta.resolve("drever/package.json");
  const packageJson = JSON.parse(await readFile(fileURLToPath(packageJsonUrl), "utf8"));
  const binary = packageJson.bin?.drever;

  if (typeof binary !== "string") {
    throw new Error("The installed drever package does not publish its CLI binary.");
  }

  return fileURLToPath(new URL(binary, packageJsonUrl));
};

const runDrever = async ({ binary, command, forwarded, theme }) => {
  const commandArguments = [
    command,
    ...(command === "check" && !forwarded.includes("--json") ? ["--json"] : []),
    ...forwarded,
  ];

  console.error(`[theme-showcase] DREVER_THEME=${theme} · drever ${commandArguments.join(" ")}`);

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [binary, ...commandArguments], {
      env: { ...process.env, DREVER_THEME: theme },
      stdio: "inherit",
      windowsHide: true,
    });

    child.once("error", (error) => {
      console.error(`[theme-showcase] Could not start Drever: ${error.message}`);
      resolve(1);
    });
    child.once("exit", (code, signal) => {
      if (signal !== null) {
        console.error(`[theme-showcase] Drever exited after ${signal}.`);
      }
      resolve(code ?? 1);
    });
  });
};

const main = async () => {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(usage);
    return 0;
  }

  const options = parseArguments(process.argv.slice(2));

  if (options.argumentError !== undefined) {
    return fail(options.argumentError);
  }
  if (!COMMANDS.has(options.command)) {
    return fail(`Expected dev, check, or build; received "${options.command ?? ""}".`);
  }
  if (options.all && options.command === "dev") {
    return fail("--all cannot start five development servers. Select one theme for dev.");
  }
  if (options.all && options.requestedTheme !== undefined) {
    return fail("--all and --theme cannot be used together.");
  }
  if (options.requestedTheme === undefined && process.env.DREVER_THEME === "") {
    return fail("DREVER_THEME cannot be empty.");
  }

  const themeSource = options.requestedTheme ?? process.env.DREVER_THEME ?? DEFAULT_THEME;
  const selectedTheme = resolveTheme(themeSource);

  if (selectedTheme === undefined) {
    return fail(`Unsupported theme "${themeSource}".`);
  }

  let binary;
  try {
    binary = await resolveDreverBinary();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[theme-showcase] Could not resolve the Drever workspace dependency: ${message}\n` +
        "Install workspace dependencies and build Drever before running this example.",
    );
    return 1;
  }

  const themes = options.all ? THEMES : [selectedTheme];
  for (const theme of themes) {
    const exitCode = await runDrever({
      binary,
      command: options.command,
      forwarded: options.forwarded,
      theme,
    });
    if (exitCode !== 0) {
      return exitCode;
    }
  }

  return 0;
};

process.exitCode = await main();

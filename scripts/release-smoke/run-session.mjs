import { spawn } from "node:child_process";
import { lstat, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertReleaseSmokeGenerationTree,
  collectReleaseSmokeSource,
  createClaudePrintArguments,
  createCodexExecArguments,
  json,
  parseClaudeJson,
  parseCodexJsonl,
  readFirstExistingFile,
  RELEASE_SMOKE_MUTABLE_HANDOFF_PATHS,
  sanitizeTranscriptText,
  snapshotReleaseSmokeGenerationTree,
} from "./contract.mjs";
import { createProtectedAnthropicProxy } from "./anthropic-proxy.mjs";
import { getReleaseSmokeProvider } from "./providers.mjs";
import { getReleaseSmokeScenario } from "./scenarios.mjs";

const [version, providerId, scenarioId, projectArgument, artifactArgument] = process.argv.slice(2);
if (
  version === undefined ||
  providerId === undefined ||
  scenarioId === undefined ||
  projectArgument === undefined ||
  artifactArgument === undefined
) {
  throw new Error(
    "Usage: node scripts/release-smoke/run-session.mjs <version> <provider> <scenario> <project> <artifact>",
  );
}

const provider = getReleaseSmokeProvider(providerId);
const scenario = getReleaseSmokeScenario(scenarioId);
const projectRoot = resolve(projectArgument);
const artifactRoot = resolve(artifactArgument);
const privateRoot = join(projectRoot, ".release-smoke");
const rawRoot = join(dirname(artifactRoot), `.raw-${providerId}-${scenarioId}`);
const model = process.env.RELEASE_SMOKE_MODEL?.trim() || provider.model;
const shellGuardPath = fileURLToPath(new URL("./deny-shell.mjs", import.meta.url));
const providerHomeVariable = provider.id === "codex" ? "CODEX_HOME" : "CLAUDE_CONFIG_DIR";
const configuredProviderHome = process.env[providerHomeVariable]?.trim();
if (configuredProviderHome === undefined || configuredProviderHome === "") {
  throw new Error(`${providerHomeVariable} must identify the isolated release smoke runner home.`);
}
const providerHome = resolve(configuredProviderHome);
const workRoot = resolve(process.env.RELEASE_SMOKE_WORK_ROOT ?? dirname(dirname(projectRoot)));
if (
  provider.id === "claude" &&
  (providerHome === workRoot || !providerHome.startsWith(`${workRoot}${sep}`))
) {
  throw new Error("CLAUDE_CONFIG_DIR must be a dedicated child of RELEASE_SMOKE_WORK_ROOT.");
}
const apiKey = provider.id === "claude" ? process.env.CLAUDE_API_KEY?.trim() : undefined;
if (provider.id === "claude" && (apiKey === undefined || apiKey === "")) {
  throw new Error("CLAUDE_API_KEY must be provided only to the protected Claude generation step.");
}

const instructionPath = provider.id === "claude" ? "CLAUDE.md" : "AGENTS.md";
const skillRoot = provider.id === "claude" ? ".claude/skills" : ".agents/skills";
const configuration = await readFirstExistingFile(projectRoot, [
  "drever.config.ts",
  "drever.config.mjs",
  "drever.config.js",
]);
const harnessFiles = [
  [".release-smoke/prompt.md", "Public prompt"],
  [".release-smoke/constraints.md", "Generation boundary"],
  [instructionPath, "Project instructions"],
  [`${skillRoot}/drever-create-deck/SKILL.md`, "Creation skill"],
  [`${skillRoot}/drever-create-design/SKILL.md`, "Design skill"],
  [`${skillRoot}/drever-author-deck/SKILL.md`, "Authoring skill"],
  [`${skillRoot}/drever-review-deck/SKILL.md`, "Review skill"],
  ["package.json", "Scaffold package"],
  ...(configuration === undefined ? [] : [[configuration.path, "Scaffold configuration"]]),
  ["brief.md", "Scaffold brief"],
];
const harnessContext = (
  await Promise.all(
    harnessFiles.map(async ([path, label]) => {
      const content = await readFile(join(projectRoot, path), "utf8");
      return `## ${label}: ${path}\n\n${content}`;
    }),
  )
).join("\n\n");
if (Buffer.byteLength(harnessContext) > 500_000) {
  throw new Error("The release smoke harness context exceeds 500 kB.");
}
const immutableSnapshot = await snapshotReleaseSmokeGenerationTree(
  projectRoot,
  harnessFiles
    .map(([path]) => path)
    .filter((path) => !RELEASE_SMOKE_MUTABLE_HANDOFF_PATHS.includes(path)),
);
const requiredMutablePaths = configuration === undefined ? [] : [configuration.path];

const claudeContainerEnvironment = (proxy) => ({
  ANTHROPIC_API_KEY: proxy.token,
  ANTHROPIC_BASE_URL: proxy.baseUrl,
  CI: "true",
  CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS: "1",
  CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1",
  CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: "1",
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
  CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL: "1",
  CLAUDE_CONFIG_DIR: "/claude-home",
  DISABLE_AUTOUPDATER: "1",
  FORCE_COLOR: "0",
  HOME: "/claude-home",
  LANG: process.env.LANG ?? "C.UTF-8",
  NO_COLOR: "1",
  PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
  NO_PROXY: "127.0.0.1",
  TMPDIR: "/tmp",
});
const redactExact = (value, secrets) =>
  secrets.reduce(
    (sanitized, secret) =>
      secret === undefined || secret === ""
        ? sanitized
        : sanitized.replaceAll(secret, "[redacted]"),
    value,
  );

const createClaudeContainerArguments = (arguments_, proxy) => {
  const cliRoot = resolve(process.env.CLAUDE_CLI_ROOT ?? "");
  const image = process.env.RELEASE_SMOKE_GENERATION_IMAGE?.trim();
  if (cliRoot === resolve("") || image === undefined || image === "") {
    throw new Error("Claude release smoke requires a pinned CLI root and generation image.");
  }
  const user = `${String(process.getuid?.() ?? 1000)}:${String(process.getgid?.() ?? 1000)}`;
  const environment = claudeContainerEnvironment(proxy);
  const dockerEnvironment = Object.entries(environment).flatMap(([name, value]) => [
    "--env",
    `${name}=${value}`,
  ]);
  return [
    "run",
    "--rm",
    "--network",
    "host",
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--pids-limit",
    "256",
    "--memory",
    "4g",
    "--cpus",
    "2",
    "--user",
    user,
    "--workdir",
    "/workspace",
    "--mount",
    `type=bind,src=${projectRoot},dst=/workspace`,
    "--mount",
    `type=bind,src=${providerHome},dst=/claude-home`,
    "--mount",
    `type=bind,src=${cliRoot},dst=/claude-cli,readonly`,
    "--tmpfs",
    "/tmp:rw,nosuid,nodev,noexec,size=268435456",
    ...dockerEnvironment,
    image,
    "/claude-cli/bin/claude",
    ...arguments_,
  ];
};

const runProcess = (command, arguments_, outputPath, environment, secrets = []) =>
  new Promise((resolvePromise, rejectPromise) => {
    const output = [];
    const errors = [];
    const child = spawn(command, arguments_, {
      cwd: projectRoot,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let killTimer;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      killTimer = setTimeout(() => child.kill("SIGKILL"), 5_000);
    }, 12 * 60_000);
    child.stdout.on("data", (chunk) => output.push(chunk));
    child.stderr.on("data", (chunk) => errors.push(chunk));
    child.once("error", (error) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      rejectPromise(error);
    });
    child.once("exit", async (code, signal) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      try {
        const stdout = Buffer.concat(output).toString("utf8");
        await writeFile(outputPath, stdout, "utf8");
        if (code === 0) {
          resolvePromise(stdout);
          return;
        }
        const diagnostic = sanitizeTranscriptText(
          redactExact(
            [Buffer.concat(errors).toString("utf8"), stdout].filter(Boolean).join("\n"),
            secrets,
          ),
          projectRoot,
        ).slice(-4_000);
        rejectPromise(
          new Error(
            signal === null
              ? `${provider.label} exited with code ${String(code)}.\n${diagnostic}`
              : `${provider.label} was terminated by ${signal}.\n${diagnostic}`,
          ),
        );
      } catch (error) {
        rejectPromise(error);
      }
    });
  });

const readRunnerVersion = (command, arguments_, environment) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, [...arguments_, "--version"], {
      env: environment,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const output = [];
    child.stdout.on("data", (chunk) => output.push(chunk));
    child.once("error", rejectPromise);
    child.once("exit", (code) => {
      if (code !== 0) {
        rejectPromise(new Error(`Could not read the ${provider.label} CLI version.`));
        return;
      }
      resolvePromise(Buffer.concat(output).toString("utf8").trim());
    });
  });

const assertSecretAbsent = async (root, secret) => {
  if (secret === undefined || secret === "") return;
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
        continue;
      }
      if (!entry.isFile()) {
        throw new Error("A release smoke artifact contains a non-regular path.");
      }
      if ((await lstat(path)).size === 0) continue;
      if ((await readFile(path)).includes(Buffer.from(secret))) {
        throw new Error("A release smoke artifact contains the provider credential.");
      }
    }
  };
  await visit(root);
};

const run = async () => {
  await Promise.all([
    mkdir(privateRoot, { recursive: true }),
    rm(rawRoot, { force: true, recursive: true }),
    ...(provider.id === "claude" ? [rm(providerHome, { force: true, recursive: true })] : []),
  ]);
  await mkdir(rawRoot, { recursive: true });
  if (provider.id === "claude") await mkdir(providerHome, { recursive: true });
  if (provider.id === "codex") {
    await writeFile(
      join(providerHome, "hooks.json"),
      json({
        description: "Deny shell execution during secret-bearing release smoke generation.",
        hooks: {
          PreToolUse: [
            {
              matcher: "^Bash$",
              hooks: [
                {
                  type: "command",
                  command: `${JSON.stringify(process.execPath)} ${JSON.stringify(shellGuardPath)}`,
                  timeout: 5,
                  statusMessage: "Keeping generation non-executable",
                },
              ],
            },
          ],
        },
      }),
      "utf8",
    );
  }

  await assertReleaseSmokeGenerationTree(projectRoot, immutableSnapshot, requiredMutablePaths);
  const startedAt = new Date();
  const messages = [];
  const usage = [];
  let conversationId;
  const proxy =
    provider.id === "claude" ? await createProtectedAnthropicProxy({ apiKey, model }) : undefined;
  const environment =
    provider.id === "claude"
      ? {
          CI: "true",
          FORCE_COLOR: "0",
          LANG: process.env.LANG ?? "C.UTF-8",
          NO_COLOR: "1",
          PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
        }
      : { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" };
  const command = provider.id === "claude" ? "docker" : "codex";

  try {
    for (const [index, turn] of scenario.turns.entries()) {
      const rawPath = join(rawRoot, `turn-${String(index + 1)}.json`);
      const modelTurn =
        index === 0
          ? `${turn}

<release-smoke-harness>
The harness has already loaded the exact public prompt, installed project
contract, relevant Drever skills, and scaffold metadata below. Treat every
file as fully read. The seed slides.mdx is intentionally absent.

Shell and network tools are unavailable while the protected credential proxy
is active. Use only direct file-editing tools. Do not run or claim validation;
a separate no-secret job owns context, checks, builds, and browser review.

${harnessContext}
</release-smoke-harness>`
          : turn;
      const agentArguments =
        provider.id === "claude"
          ? createClaudePrintArguments({
              model,
              sessionId: conversationId,
              turn: modelTurn,
            })
          : createCodexExecArguments({
              model,
              threadId: conversationId,
              turn: modelTurn,
            });
      const arguments_ =
        provider.id === "claude"
          ? createClaudeContainerArguments(agentArguments, proxy)
          : agentArguments;
      const stdout = await runProcess(command, arguments_, rawPath, environment, [
        apiKey,
        proxy?.token,
      ]);
      const result = provider.id === "claude" ? parseClaudeJson(stdout) : parseCodexJsonl(stdout);
      const resultConversationId = provider.id === "claude" ? result.sessionId : result.threadId;
      await assertReleaseSmokeGenerationTree(projectRoot, immutableSnapshot, requiredMutablePaths);
      conversationId ??= resultConversationId;
      if (resultConversationId !== conversationId) {
        throw new Error(`${provider.label} changed conversation id during the release smoke.`);
      }
      messages.push(
        { content: sanitizeTranscriptText(turn, projectRoot), role: "user" },
        {
          content: sanitizeTranscriptText(
            redactExact(result.message, [apiKey, proxy?.token]),
            projectRoot,
          ),
          role: "assistant",
        },
      );
      if (result.usage !== undefined) usage.push(result.usage);
    }

    const source = await collectReleaseSmokeSource(projectRoot, join(artifactRoot, "source"));
    const completedAt = new Date();
    const versionArguments =
      provider.id === "claude" ? createClaudeContainerArguments([], proxy) : [];
    const runnerVersion = await readRunnerVersion(command, versionArguments, environment);
    const transcript = {
      schemaVersion: 1,
      providerId,
      scenarioId,
      mode: scenario.mode,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationSeconds: Math.max(
        0,
        Math.round((completedAt.getTime() - startedAt.getTime()) / 1_000),
      ),
      messages,
      usage,
    };
    await Promise.all([
      writeFile(join(artifactRoot, "transcript.json"), json(transcript), "utf8"),
      writeFile(
        join(artifactRoot, "generation.json"),
        json({
          schemaVersion: 1,
          provider: {
            id: provider.id,
            label: provider.label,
          },
          scenarioId,
          version,
          model,
          runnerVersion,
          nodeVersion: process.version,
          executionBoundary: {
            credential: "protected-provider-proxy",
            publication: "allowlisted-source-only",
            shell: "tool-surface-deny-configured",
          },
          source,
        }),
        "utf8",
      ),
    ]);
    await assertSecretAbsent(artifactRoot, apiKey);
    await assertSecretAbsent(artifactRoot, proxy?.token);
  } finally {
    await proxy?.close();
  }
};

try {
  await run();
} finally {
  await Promise.all([
    rm(privateRoot, { force: true, recursive: true }),
    rm(rawRoot, { force: true, recursive: true }),
    ...(provider.id === "claude" ? [rm(providerHome, { force: true, recursive: true })] : []),
  ]);
}

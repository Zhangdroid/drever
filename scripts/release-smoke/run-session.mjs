import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertReleaseSmokeGenerationTree,
  collectReleaseSmokeSource,
  createCodexExecArguments,
  json,
  parseCodexJsonl,
  readFirstExistingFile,
  sanitizeTranscriptText,
  snapshotReleaseSmokeGenerationTree,
} from "./contract.mjs";
import { getReleaseSmokeScenario } from "./scenarios.mjs";

const [version, scenarioId, projectArgument, artifactArgument] = process.argv.slice(2);
if (
  version === undefined ||
  scenarioId === undefined ||
  projectArgument === undefined ||
  artifactArgument === undefined
) {
  throw new Error(
    "Usage: node scripts/release-smoke/run-session.mjs <version> <scenario> <project> <artifact>",
  );
}
const scenario = getReleaseSmokeScenario(scenarioId);
const projectRoot = resolve(projectArgument);
const artifactRoot = resolve(artifactArgument);
const privateRoot = join(projectRoot, ".release-smoke");
const rawRoot = join(dirname(artifactRoot), `.raw-${scenarioId}`);
const model = process.env.RELEASE_SMOKE_MODEL?.trim();
if (process.env.CODEX_HOME === undefined || process.env.CODEX_HOME.trim() === "") {
  throw new Error("CODEX_HOME must match the directory bootstrapped by openai/codex-action.");
}
const codexHome = resolve(process.env.CODEX_HOME);
const shellGuardPath = fileURLToPath(new URL("./deny-shell.mjs", import.meta.url));
const configuration = await readFirstExistingFile(projectRoot, [
  "drever.config.ts",
  "drever.config.mjs",
  "drever.config.js",
]);
const harnessFiles = [
  [".release-smoke/prompt.md", "Public prompt"],
  [".release-smoke/constraints.md", "Generation boundary"],
  ["AGENTS.md", "Project instructions"],
  [".agents/skills/drever-create-deck/SKILL.md", "Creation skill"],
  [".agents/skills/drever-create-design/SKILL.md", "Design skill"],
  [".agents/skills/drever-author-deck/SKILL.md", "Authoring skill"],
  [".agents/skills/drever-review-deck/SKILL.md", "Review skill"],
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
  harnessFiles.map(([path]) => path).filter((path) => path !== "brief.md"),
);
await writeFile(
  join(codexHome, "hooks.json"),
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

const runCodex = (arguments_, outputPath) =>
  new Promise((resolvePromise, rejectPromise) => {
    const output = [];
    const errors = [];
    const child = spawn("codex", arguments_, {
      cwd: projectRoot,
      env: {
        ...process.env,
        FORCE_COLOR: "0",
        NO_COLOR: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let killTimer;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      killTimer = setTimeout(() => child.kill("SIGKILL"), 5_000);
    }, 12 * 60_000);
    child.stdout.on("data", (chunk) => output.push(chunk));
    child.stderr.on("data", (chunk) => {
      errors.push(chunk);
      process.stderr.write(chunk);
    });
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
        const stderr = Buffer.concat(errors).toString("utf8").slice(-4_000);
        rejectPromise(
          new Error(
            signal === null
              ? `Codex exited with code ${String(code)}.\n${stderr}`
              : `Codex was terminated by ${signal}.\n${stderr}`,
          ),
        );
      } catch (error) {
        rejectPromise(error);
      }
    });
  });

await Promise.all([
  mkdir(privateRoot, { recursive: true }),
  rm(rawRoot, { force: true, recursive: true }),
]);
await mkdir(rawRoot, { recursive: true });
await assertReleaseSmokeGenerationTree(projectRoot, immutableSnapshot);
const startedAt = new Date();
const messages = [];
const usage = [];
let threadId;

for (const [index, turn] of scenario.turns.entries()) {
  const rawPath = join(rawRoot, `turn-${String(index + 1)}.jsonl`);
  const modelTurn =
    index === 0
      ? `${turn}

<release-smoke-harness>
The harness has already loaded the exact public prompt, installed project
contract, relevant Drever skills, and scaffold metadata below. Treat every
file as fully read. The seed slides.mdx is intentionally absent.

Shell calls are deterministically blocked while the protected credential
proxy is active. Do not attempt them. Use apply_patch only to create or edit
authoring source. Do not run or claim validation; a separate no-secret job
owns context, checks, builds, and browser review.

${harnessContext}
</release-smoke-harness>`
      : turn;
  const arguments_ = createCodexExecArguments({ model, threadId, turn: modelTurn });
  const result = parseCodexJsonl(await runCodex(arguments_, rawPath));
  await assertReleaseSmokeGenerationTree(projectRoot, immutableSnapshot);
  threadId ??= result.threadId;
  if (result.threadId !== threadId) {
    throw new Error("Codex changed thread id during the release smoke conversation.");
  }
  messages.push(
    { content: sanitizeTranscriptText(turn, projectRoot), role: "user" },
    {
      content: sanitizeTranscriptText(result.message, projectRoot),
      role: "assistant",
    },
  );
  if (result.usage !== undefined) usage.push(result.usage);
}

const source = await collectReleaseSmokeSource(projectRoot, join(artifactRoot, "source"));
const completedAt = new Date();
const codexVersion = await new Promise((resolvePromise, rejectPromise) => {
  const child = spawn("codex", ["--version"], { stdio: ["ignore", "pipe", "inherit"] });
  const output = [];
  child.stdout.on("data", (chunk) => output.push(chunk));
  child.once("error", rejectPromise);
  child.once("exit", (code) => {
    if (code !== 0) {
      rejectPromise(new Error("Could not read the Codex CLI version."));
      return;
    }
    resolvePromise(Buffer.concat(output).toString("utf8").trim());
  });
});
const transcript = {
  schemaVersion: 1,
  scenarioId,
  mode: scenario.mode,
  startedAt: startedAt.toISOString(),
  completedAt: completedAt.toISOString(),
  durationSeconds: Math.max(0, Math.round((completedAt.getTime() - startedAt.getTime()) / 1_000)),
  messages,
  usage,
};
await Promise.all([
  writeFile(join(artifactRoot, "transcript.json"), json(transcript), "utf8"),
  writeFile(
    join(artifactRoot, "generation.json"),
    json({
      schemaVersion: 1,
      scenarioId,
      version,
      model: model === undefined || model === "" ? "Codex default" : model,
      codexVersion,
      nodeVersion: process.version,
      executionBoundary: {
        publication: "allowlisted-source-only",
        shell: "pre-tool-use-deny-configured",
      },
      source,
    }),
    "utf8",
  ),
]);
await Promise.all([
  rm(privateRoot, { force: true, recursive: true }),
  rm(rawRoot, { force: true, recursive: true }),
]);

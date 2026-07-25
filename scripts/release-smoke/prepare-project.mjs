import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { assertReleaseVersion } from "../release.mjs";
import { json } from "./contract.mjs";
import { getReleaseSmokeScenario } from "./scenarios.mjs";

const execute = promisify(execFile);
const [version, scenarioId, projectArgument, artifactArgument] = process.argv.slice(2);
if (
  version === undefined ||
  scenarioId === undefined ||
  projectArgument === undefined ||
  artifactArgument === undefined
) {
  throw new Error(
    "Usage: node scripts/release-smoke/prepare-project.mjs <version> <scenario> <project> <artifact>",
  );
}
assertReleaseVersion(version);
getReleaseSmokeScenario(scenarioId);

const projectRoot = resolve(projectArgument);
const artifactRoot = resolve(artifactArgument);
const promptUrl = "https://drever.dev/prompt.md";
const parseJsonOutput = (output) => {
  const start = output.search(/^\{/mu);
  if (start === -1) throw new Error("create-drever did not return a JSON receipt.");
  return JSON.parse(output.slice(start));
};

await Promise.all([
  rm(projectRoot, { force: true, recursive: true }),
  rm(artifactRoot, { force: true, recursive: true }),
]);
await mkdir(dirname(projectRoot), { recursive: true });

const scaffold = await execute(
  "npm",
  [
    "create",
    `drever@${version}`,
    projectRoot,
    "--",
    "--agent",
    "codex",
    "--package-manager",
    "npm",
    "--json",
  ],
  {
    env: {
      ...process.env,
      CI: "true",
      FORCE_COLOR: "0",
      npm_config_audit: "false",
      npm_config_fund: "false",
    },
    maxBuffer: 10 * 1024 * 1024,
    timeout: 300_000,
  },
);
const scaffoldReceipt = parseJsonOutput(scaffold.stdout);
const [projectPackage, installedPackage] = await Promise.all([
  readFile(join(projectRoot, "package.json"), "utf8").then(JSON.parse),
  readFile(join(projectRoot, "node_modules", "drever", "package.json"), "utf8").then(JSON.parse),
]);
if (
  scaffoldReceipt.installed !== true ||
  scaffoldReceipt.root !== projectRoot ||
  projectPackage.devDependencies?.drever !== version ||
  installedPackage.version !== version
) {
  throw new Error(`The release smoke project did not install Drever ${version} exactly.`);
}
await rm(join(projectRoot, "slides.mdx"), { force: true });

const response = await fetch(promptUrl, { signal: AbortSignal.timeout(30_000) });
if (!response.ok) {
  throw new Error(`Could not fetch ${promptUrl}: ${response.status} ${response.statusText}`);
}
const prompt = await response.text();
if (!prompt.startsWith("# Create a Drever presentation")) {
  throw new Error("The fetched Drever prompt does not have the expected heading.");
}

const privateRoot = join(projectRoot, ".release-smoke");
const agentInstructionsPath = join(projectRoot, "AGENTS.md");
const agentInstructions = await readFile(agentInstructionsPath, "utf8");
await Promise.all([
  mkdir(privateRoot, { recursive: true }),
  mkdir(join(artifactRoot, "receipts"), { recursive: true }),
]);
await Promise.all([
  writeFile(
    agentInstructionsPath,
    `${agentInstructions.trimEnd()}

## Release smoke generation boundary

- This job is authoring-only. Shell execution is blocked while the protected
  credential proxy is active.
- The release harness supplies the exact public prompt, project contract,
  relevant skills, and scaffold metadata as context.
- Use \`apply_patch\` to create \`slides.mdx\` and other authoring source.
- Do not run or claim checks, builds, servers, browsers, scripts, or generated
  project code. A separate job without the OpenAI secret owns validation.
`,
    "utf8",
  ),
  writeFile(join(privateRoot, "prompt.md"), prompt, "utf8"),
  writeFile(
    join(privateRoot, "constraints.md"),
    `# Release smoke generation boundary

This is a trusted, generation-only CI stage.

- Author no more than six slides.
- Do not export a PDF or create screenshots.
- Do not use remote images, fonts, video, audio, embeds, APIs, or other external assets.
- Do not add packages or edit package.json, lockfiles, agent instructions, or generated output.
- Use only local MDX, CSS, TypeScript, React, SVG, and the installed Drever capabilities.
- Shell execution is blocked by a deterministic \`PreToolUse\` hook while the credential proxy is active. The harness supplies the exact prompt, project contract, and relevant skills as context.
- Use \`apply_patch\` to create \`slides.mdx\` and any other authoring source. Do not attempt package-manager commands, checks, builds, servers, browsers, scripts, or generated project code. A separate job with no API secret owns all execution and validation.
- Edit authoring source only. Do not claim that checks, builds, or visual review ran in this stage.
`,
    "utf8",
  ),
  writeFile(join(artifactRoot, "receipts", "scaffold.json"), json(scaffoldReceipt), "utf8"),
  writeFile(
    join(artifactRoot, "prompt.json"),
    json({
      schemaVersion: 1,
      sha256: createHash("sha256").update(prompt).digest("hex"),
      url: promptUrl,
    }),
    "utf8",
  ),
]);

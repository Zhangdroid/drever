import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { assertReleaseVersion } from "../release.mjs";
import { copyReleaseSmokeHandoff, json } from "./contract.mjs";
import { getReleaseSmokeProvider } from "./providers.mjs";
import { getReleaseSmokeScenario } from "./scenarios.mjs";

const execute = promisify(execFile);
const [version, providerId, scenarioId, scaffoldArgument, projectArgument, artifactArgument] =
  process.argv.slice(2);
if (
  version === undefined ||
  providerId === undefined ||
  scenarioId === undefined ||
  scaffoldArgument === undefined ||
  projectArgument === undefined ||
  artifactArgument === undefined
) {
  throw new Error(
    "Usage: node scripts/release-smoke/prepare-project.mjs <version> <provider> <scenario> <scaffold> <project> <artifact>",
  );
}
assertReleaseVersion(version);
const provider = getReleaseSmokeProvider(providerId);
getReleaseSmokeScenario(scenarioId);

const scaffoldRoot = resolve(scaffoldArgument);
const projectRoot = resolve(projectArgument);
const artifactRoot = resolve(artifactArgument);
const promptUrl = "https://drever.dev/prompt.md";
const parseJsonOutput = (output) => {
  const start = output.search(/^\{/mu);
  if (start === -1) throw new Error("create-drever did not return a JSON receipt.");
  return JSON.parse(output.slice(start));
};

await Promise.all([
  rm(scaffoldRoot, { force: true, recursive: true }),
  rm(projectRoot, { force: true, recursive: true }),
  rm(artifactRoot, { force: true, recursive: true }),
]);
await mkdir(dirname(scaffoldRoot), { recursive: true });

const scaffold = await execute(
  "npm",
  [
    "create",
    `drever@${version}`,
    scaffoldRoot,
    "--",
    "--agent",
    provider.agent,
    "--package-manager",
    "npm",
    "--json",
  ],
  {
    cwd: dirname(scaffoldRoot),
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
  readFile(join(scaffoldRoot, "package.json"), "utf8").then(JSON.parse),
  readFile(join(scaffoldRoot, "node_modules", "drever", "package.json"), "utf8").then(JSON.parse),
]);
if (
  scaffoldReceipt.installed !== true ||
  scaffoldReceipt.root !== scaffoldRoot ||
  projectPackage.devDependencies?.drever !== version ||
  installedPackage.version !== version
) {
  throw new Error(`The release smoke project did not install Drever ${version} exactly.`);
}
await rm(join(scaffoldRoot, "slides.mdx"), { force: true });

const response = await fetch(promptUrl, { signal: AbortSignal.timeout(30_000) });
if (!response.ok) {
  throw new Error(`Could not fetch ${promptUrl}: ${response.status} ${response.statusText}`);
}
const prompt = await response.text();
if (!prompt.startsWith("# Create a Drever presentation")) {
  throw new Error("The fetched Drever prompt does not have the expected heading.");
}

const handoff = await copyReleaseSmokeHandoff(scaffoldRoot, projectRoot, { providerId });
const privateRoot = join(projectRoot, ".release-smoke");
const instructionPaths = [provider.id === "claude" ? "CLAUDE.md" : "AGENTS.md"];
const instructions = await Promise.all(
  instructionPaths.map(async (path) => [path, await readFile(join(projectRoot, path), "utf8")]),
);
await Promise.all([
  mkdir(privateRoot, { recursive: true }),
  mkdir(join(artifactRoot, "receipts"), { recursive: true }),
]);
await Promise.all([
  ...instructions.map(([path, content]) =>
    writeFile(
      join(projectRoot, path),
      `${content.trimEnd()}

## Release smoke generation boundary

- This job is authoring-only. Shell execution is blocked while the protected
  model credential is active.
- The release harness supplies the exact public prompt, project contract,
  relevant skills, and scaffold metadata as context.
- Use direct file-editing tools to create \`slides.mdx\` and other authoring source.
- Do not run or claim checks, builds, servers, browsers, scripts, or generated
  project code. A separate job without a model credential owns validation.
`,
      "utf8",
    ),
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
- Shell execution is removed or deterministically denied while a model credential is active. The harness supplies the exact prompt, project contract, and relevant skills as context.
- Use direct file-editing tools to create \`slides.mdx\` and any other authoring source. Do not attempt package-manager commands, checks, builds, servers, browsers, scripts, or generated project code. A separate job with no model credential owns all execution and validation.
- Edit authoring source only. Do not claim that checks, builds, or visual review ran in this stage.
`,
    "utf8",
  ),
  writeFile(join(artifactRoot, "receipts", "scaffold.json"), json(scaffoldReceipt), "utf8"),
  writeFile(join(artifactRoot, "receipts", "handoff.json"), json(handoff), "utf8"),
  writeFile(
    join(artifactRoot, "prompt.json"),
    json({
      schemaVersion: 1,
      providerId,
      sha256: createHash("sha256").update(prompt).digest("hex"),
      url: promptUrl,
    }),
    "utf8",
  ),
]);

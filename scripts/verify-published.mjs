import { execFile } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { assertDistTag, assertReleaseVersion, readPublicPackages } from "./release.mjs";

const execute = promisify(execFile);
const [version, tag] = process.argv.slice(2);
if (version === undefined || tag === undefined) {
  throw new Error("Usage: node scripts/verify-published.mjs <version> <dist-tag>");
}
assertReleaseVersion(version);
assertDistTag(tag);

const packageNames = (await readPublicPackages())
  .map(({ manifest }) => manifest.name)
  .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));

const root = await realpath(await mkdtemp(join(tmpdir(), "drever-registry-consumer-")));
const deckRoot = join(root, "registry-deck");
const run = (command, arguments_, cwd = root, timeout = 240_000) =>
  execute(command, arguments_, {
    cwd,
    env: {
      ...process.env,
      CI: "true",
      FORCE_COLOR: "0",
      npm_config_cache: join(root, "npm-cache"),
    },
    maxBuffer: 10 * 1024 * 1024,
    timeout,
  });
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const installPublishedPackages = async () => {
  const delays = [0, 3_000, 6_000, 12_000, 24_000];
  let lastError;
  for (const [attempt, delay] of delays.entries()) {
    if (delay > 0) await wait(delay);
    await Promise.all([
      rm(join(root, "node_modules"), { force: true, recursive: true }),
      rm(join(root, "package-lock.json"), { force: true }),
    ]);
    try {
      const taggedVersions = await Promise.all(
        packageNames.map(async (name) => {
          const { stdout } = await run(
            "npm",
            [
              "view",
              `${name}@${tag}`,
              "version",
              "--json",
              "--registry=https://registry.npmjs.org",
            ],
            root,
            90_000,
          );
          return JSON.parse(stdout);
        }),
      );
      if (taggedVersions.some((taggedVersion) => taggedVersion !== version)) {
        throw new Error(`The npm dist-tag ${tag} does not resolve to Drever ${version}.`);
      }
      await run(
        "npm",
        [
          "install",
          "--ignore-scripts",
          "--no-audit",
          "--no-fund",
          "--prefer-online",
          "--registry=https://registry.npmjs.org",
        ],
        root,
        90_000,
      );
      return;
    } catch (error) {
      lastError = error;
      if (attempt < delays.length - 1) {
        process.stdout.write(`Registry install attempt ${attempt + 1} was not ready; retrying.\n`);
      }
    }
  }
  throw new Error(
    `The npm registry did not make every Drever ${version} package installable in time.`,
    {
      cause: lastError,
    },
  );
};

try {
  await writeFile(
    join(root, "package.json"),
    `${JSON.stringify(
      {
        name: "drever-registry-consumer",
        private: true,
        version: "0.0.0",
        type: "module",
        dependencies: Object.fromEntries(packageNames.map((name) => [name, version])),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await installPublishedPackages();

  const modules = join(root, "node_modules");
  const moduleRoot = (name) => join(modules, ...name.split("/"));
  const packageRoots = {
    agent: moduleRoot("@drever/agent"),
    create: moduleRoot("create-drever"),
    drever: moduleRoot("drever"),
  };
  const installedVersions = await Promise.all(
    packageNames.map(async (name) =>
      readJson(join(moduleRoot(name), "package.json")).then((manifest) => manifest.version),
    ),
  );
  if (installedVersions.some((installedVersion) => installedVersion !== version)) {
    throw new Error(`The registry consumer did not install every Drever package at ${version}.`);
  }

  const createCli = join(packageRoots.create, "dist", "bin.mjs");
  const dreverCli = join(packageRoots.drever, "dist", "bin.mjs");
  const created = await run(process.execPath, [
    createCli,
    "registry-deck",
    "--no-install",
    "--json",
  ]);
  const createReceipt = JSON.parse(created.stdout);
  if (createReceipt.root !== deckRoot || createReceipt.version !== 1) {
    throw new Error("The published create-drever returned an invalid receipt.");
  }

  const checked = await run(process.execPath, [dreverCli, "check", "--json"], deckRoot);
  if (JSON.parse(checked.stdout).summary?.errors !== 0) {
    throw new Error("The published Drever CLI did not validate its generated deck.");
  }
  const built = await run(process.execPath, [dreverCli, "build", "--json"], deckRoot);
  if (JSON.parse(built.stdout).artifacts?.[0]?.path !== join(deckRoot, "dist")) {
    throw new Error("The published Drever CLI returned an invalid build receipt.");
  }
  await stat(join(deckRoot, "dist", "index.html"));

  const [codexPlugin, claudePlugin] = await Promise.all([
    readJson(join(packageRoots.agent, ".codex-plugin", "plugin.json")),
    readJson(join(packageRoots.agent, ".claude-plugin", "plugin.json")),
  ]);
  if (codexPlugin.version !== version || claudePlugin.version !== version) {
    throw new Error("The published agent plugin versions are out of sync.");
  }

  process.stdout.write(`Verified Drever ${version} from the public npm registry.\n`);
} finally {
  await rm(root, { force: true, recursive: true });
}

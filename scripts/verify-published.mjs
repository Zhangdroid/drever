import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
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
const packageConsumerRoot = join(root, "all-packages");
const journeyRoot = join(root, "first-user");
const deckRoot = join(journeyRoot, "registry-deck");
const run = (command, arguments_, cwd = root, timeout = 240_000) =>
  execute(command, arguments_, {
    cwd,
    env: {
      ...process.env,
      CI: "true",
      FORCE_COLOR: "0",
      npm_config_cache: join(root, "npm-cache"),
      npm_config_registry: "https://registry.npmjs.org",
    },
    maxBuffer: 10 * 1024 * 1024,
    timeout,
  });
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const readCreateReceipt = (output) => {
  const start = output.search(/^\{/mu);
  if (start === -1) {
    throw new Error("The public npm create command did not return a JSON receipt.");
  }
  return JSON.parse(output.slice(start));
};
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const installPublishedPackages = async () => {
  const delays = [0, 3_000, 6_000, 12_000, 24_000];
  let lastError;
  for (const [attempt, delay] of delays.entries()) {
    if (delay > 0) await wait(delay);
    await Promise.all([
      rm(join(packageConsumerRoot, "node_modules"), { force: true, recursive: true }),
      rm(join(packageConsumerRoot, "package-lock.json"), { force: true }),
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
        packageConsumerRoot,
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
  await mkdir(packageConsumerRoot);
  await writeFile(
    join(packageConsumerRoot, "package.json"),
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

  const modules = join(packageConsumerRoot, "node_modules");
  const moduleRoot = (name) => join(modules, ...name.split("/"));
  const publishedSchema = await import(
    pathToFileURL(join(moduleRoot("@drever/schema"), "dist", "index.mjs")).href
  );
  const packageRoots = {
    agent: moduleRoot("@drever/agent"),
  };
  const installedVersions = await Promise.all(
    packageNames.map(async (name) =>
      readJson(join(moduleRoot(name), "package.json")).then((manifest) => manifest.version),
    ),
  );
  if (installedVersions.some((installedVersion) => installedVersion !== version)) {
    throw new Error(`The registry consumer did not install every Drever package at ${version}.`);
  }

  await mkdir(journeyRoot);
  const created = await run(
    "npm",
    ["create", `drever@${version}`, "registry-deck", "--", "--json"],
    journeyRoot,
    300_000,
  );
  const createReceipt = readCreateReceipt(created.stdout);
  if (
    createReceipt.installed !== true ||
    createReceipt.packageManager !== "npm" ||
    createReceipt.root !== deckRoot ||
    createReceipt.version !== 1
  ) {
    throw new Error("The public npm create command returned an invalid receipt.");
  }
  const [generatedPackage, generatedDrever] = await Promise.all([
    readJson(join(deckRoot, "package.json")),
    readJson(join(deckRoot, "node_modules", "drever", "package.json")),
  ]);
  if (generatedPackage.devDependencies?.drever !== version || generatedDrever.version !== version) {
    throw new Error(`The public npm create command did not install Drever ${version}.`);
  }
  await writeFile(
    join(deckRoot, "slides.mdx"),
    `import { Note, Step } from "drever";

# Published root import

<Step>Browser-safe runtime import.</Step>

<Note>The registry consumer resolves authoring primitives from the root package.</Note>
`,
    "utf8",
  );

  const contextResult = await run("npm", ["exec", "--", "drever", "context", "--json"], deckRoot);
  const context = JSON.parse(contextResult.stdout);
  if (
    context.version !== publishedSchema.DREVER_AUTHORING_CONTEXT_VERSION ||
    context.sourcePath !== join(deckRoot, "slides.mdx") ||
    context.deck?.slides?.length !== 1
  ) {
    throw new Error("The project-local npm exec invocation returned invalid authoring context.");
  }
  await run("npm", ["run", "check"], deckRoot);
  await run("npm", ["run", "build"], deckRoot);
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

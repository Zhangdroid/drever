import { execFile, spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify, stripVTControlCharacters } from "node:util";
import { chromium } from "@playwright/test";

const execute = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const packageRoots = [join(root, "packages"), join(root, "plugins")];
const temporaryRoot = await realpath(await mkdtemp(join(tmpdir(), "drever-consumer-")));
const packsRoot = join(temporaryRoot, "packs");
const consumerRoot = join(temporaryRoot, "consumer");
const deckRoot = join(consumerRoot, "customer-story");
const canonicalSkillRoot = join(root, "packages", "cli", "agent-kit", "skills");

const run = (command, arguments_, cwd, timeout = 120_000) =>
  execute(command, arguments_, {
    cwd,
    env: { ...process.env, CI: "true", FORCE_COLOR: "0" },
    maxBuffer: 10 * 1024 * 1024,
    timeout,
  });

const availablePort = () =>
  new Promise((resolvePromise, rejectPromise) => {
    const server = createServer();
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address !== "object" || address === null) {
        server.close();
        rejectPromise(new TypeError("Could not allocate a local port for the packed dev server."));
        return;
      }
      server.close((error) => {
        if (error === undefined) resolvePromise(address.port);
        else rejectPromise(error);
      });
    });
  });

const startDevServer = (cli, cwd) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [cli, "dev"], {
      cwd,
      env: { ...process.env, CI: "true", FORCE_COLOR: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const timeout = setTimeout(() => {
      child.kill();
      rejectPromise(new Error(`The packed dev server did not start.\n${output}`));
    }, 30_000);
    const inspect = (chunk) => {
      output += chunk;
      const match = stripVTControlCharacters(output).match(/Local:\s+(https?:\/\/[^\s]+)/u);
      if (match === null) return;
      clearTimeout(timeout);
      resolvePromise({ child, url: match[1] });
    };
    child.stdout.on("data", inspect);
    child.stderr.on("data", inspect);
    child.once("error", (error) => {
      clearTimeout(timeout);
      rejectPromise(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      rejectPromise(
        new Error(
          `The packed dev server exited with ${signal === null ? `code ${code}` : signal}.\n${output}`,
        ),
      );
    });
  });

const stopDevServer = async (child) => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolvePromise) => child.once("exit", resolvePromise));
  child.kill();
  await Promise.race([exited, new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000))]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await exited;
  }
};

const verifyDevRuntime = async (cli, root) => {
  const port = await availablePort();
  await writeFile(
    join(root, "drever.config.ts"),
    `export default { server: { host: "127.0.0.1", port: ${port}, strictPort: true } };\n`,
  );
  const server = await startDevServer(cli, root);
  let browser;
  try {
    browser = await chromium.launch({ channel: "chromium", headless: true });
    const page = await browser.newPage();
    const failures = [];
    page.on("console", (message) => {
      if (message.type() === "error") failures.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => failures.push(`pageerror: ${error.stack ?? error.message}`));
    await page.goto(server.url, { waitUntil: "networkidle" });
    await page.locator("[data-drever-ready]").waitFor({ state: "attached" });
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("[data-drever-ready]").waitFor({ state: "attached" });
    if (failures.length > 0) {
      throw new Error(`The packed dev runtime reported browser failures:\n${failures.join("\n")}`);
    }
  } finally {
    await browser?.close();
    await stopDevServer(server.child);
  }
};

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const listTreeFiles = async (directory, current = directory) => {
  const entries = await readdir(current, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => {
        const path = join(current, entry.name);
        if (entry.isDirectory()) return listTreeFiles(directory, path);
        if (!entry.isFile()) {
          throw new Error(`Expected a regular file in the skill tree: ${path}`);
        }
        return [relative(directory, path).split(sep).join("/")];
      }),
  );
  return files.flat();
};

const readTree = async (directory) => {
  const paths = await listTreeFiles(directory);
  return new Map(
    await Promise.all(paths.map(async (path) => [path, await readFile(join(directory, path))])),
  );
};

const compareTrees = async (expectedRoot, actualRoot, label) => {
  const [expected, actual] = await Promise.all([readTree(expectedRoot), readTree(actualRoot)]);
  const expectedPaths = [...expected.keys()];
  const actualPaths = [...actual.keys()];
  if (
    expectedPaths.length !== actualPaths.length ||
    expectedPaths.some((path, index) => path !== actualPaths[index])
  ) {
    throw new Error(`${label} does not contain the complete canonical skill tree.`);
  }
  for (const path of expectedPaths) {
    if (!actual.get(path)?.equals(expected.get(path))) {
      throw new Error(`${label} is out of sync at ${path}.`);
    }
  }
};

const publicPackages = (
  await Promise.all(
    packageRoots.map(async (packageRoot) =>
      Promise.all(
        (await readdir(packageRoot, { withFileTypes: true }))
          .filter((entry) => entry.isDirectory())
          .map(async (entry) => ({
            directory: join(packageRoot, entry.name),
            manifest: await readJson(join(packageRoot, entry.name, "package.json")),
          })),
      ),
    ),
  )
)
  .flat()
  .filter(({ manifest }) => manifest.private !== true);

try {
  await mkdir(packsRoot, { recursive: true });
  const tarballs = new Map();
  for (const { directory, manifest } of publicPackages) {
    const { stdout } = await run("pnpm", ["pack", "--pack-destination", packsRoot], directory);
    const path = stdout.trim().split("\n").at(-1);
    if (path === undefined || !path.endsWith(".tgz")) {
      throw new Error(`Could not locate the packed tarball for ${manifest.name}.`);
    }
    tarballs.set(manifest.name, path);
  }

  const overrides = Object.fromEntries([...tarballs].map(([name, path]) => [name, `file:${path}`]));
  const { stdout: storeOutput } = await run("vp", ["exec", "pnpm", "store", "path"], root);
  const store = storeOutput.trim();
  await mkdir(consumerRoot, { recursive: true });
  await writeFile(
    join(consumerRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "drever-clean-consumer",
        private: true,
        version: "0.0.0",
        type: "module",
        dependencies: {
          "@drever/agent": overrides["@drever/agent"],
          "create-drever": overrides["create-drever"],
          drever: overrides.drever,
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    join(consumerRoot, "pnpm-workspace.yaml"),
    [
      'packages: ["."]',
      "overrides:",
      ...Object.entries(overrides).map(
        ([name, path]) => `  ${JSON.stringify(name)}: ${JSON.stringify(path)}`,
      ),
      "",
    ].join("\n"),
  );
  await run(
    "vp",
    ["exec", "pnpm", "install", "--no-frozen-lockfile", "--store-dir", store],
    consumerRoot,
  );

  const createCli = join(consumerRoot, "node_modules", "create-drever", "dist", "bin.mjs");
  const dreverCli = join(consumerRoot, "node_modules", "drever", "dist", "bin.mjs");
  const dreverPackage = join(consumerRoot, "node_modules", "drever");
  const agentPlugin = join(consumerRoot, "node_modules", "@drever", "agent");
  const [codexPlugin, claudePlugin] = await Promise.all([
    readJson(join(agentPlugin, ".codex-plugin", "plugin.json")),
    readJson(join(agentPlugin, ".claude-plugin", "plugin.json")),
  ]);
  if (
    codexPlugin.name !== "drever" ||
    claudePlugin.name !== "drever" ||
    codexPlugin.version !== claudePlugin.version
  ) {
    throw new Error("The packed @drever/agent plugin is incomplete or out of sync.");
  }
  await Promise.all([
    compareTrees(
      canonicalSkillRoot,
      join(dreverPackage, "agent-kit", "skills"),
      "The packed drever agent kit",
    ),
    compareTrees(
      canonicalSkillRoot,
      join(agentPlugin, "skills"),
      "The packed @drever/agent plugin",
    ),
  ]);
  const created = await run(
    process.execPath,
    [createCli, "customer-story", "--no-install", "--json"],
    consumerRoot,
  );
  const createReceipt = JSON.parse(created.stdout);
  if (createReceipt.root !== deckRoot || createReceipt.version !== 1) {
    throw new Error("The packed create-drever binary returned an invalid receipt.");
  }
  await writeFile(
    join(deckRoot, "slides.mdx"),
    `import { Note, Step } from "drever";

# Packed root import

<Step>Browser-safe runtime import.</Step>

<Note>The packed consumer resolves authoring primitives from the root package.</Note>
`,
  );

  const checked = await run(process.execPath, [dreverCli, "check", "--json"], deckRoot);
  const checkReceipt = JSON.parse(checked.stdout);
  if (checkReceipt.summary?.errors !== 0 || checkReceipt.slideCount !== 1) {
    throw new Error("The packed Drever CLI did not validate the generated deck.");
  }

  const built = await run(process.execPath, [dreverCli, "build", "--json"], deckRoot);
  const buildReceipt = JSON.parse(built.stdout);
  if (buildReceipt.artifacts?.[0]?.path !== join(deckRoot, "dist")) {
    throw new Error("The packed Drever CLI returned an invalid build receipt.");
  }
  await stat(join(deckRoot, "dist", "index.html"));
  await verifyDevRuntime(dreverCli, deckRoot);

  process.stdout.write(
    `Verified packed create, check, build, and dev flows across ${publicPackages.length} packages.\n`,
  );
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}

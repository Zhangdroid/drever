import { lstat, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultPluginRoot = fileURLToPath(new URL("../", import.meta.url));
const defaultSourceRoot = resolve(defaultPluginRoot, "../../packages/cli/agent-kit/skills");
const generatedRoots = [".claude-plugin", ".codex-plugin", "skills"];

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

const codexManifest = (version) =>
  json({
    name: "drever",
    version,
    description: "Create, refine, validate, and deliver AI-first Drever presentations.",
    author: { name: "DREVER" },
    license: "MIT",
    keywords: ["ai", "mdx", "presentations", "slides"],
    skills: "./skills/",
    interface: {
      displayName: "Drever",
      shortDescription: "Create and deliver AI-first presentations",
      longDescription:
        "Turn a brief into a clear, visual Drever presentation, review every addressable state, and deliver a verified website or PDF.",
      developerName: "DREVER",
      category: "Productivity",
      capabilities: ["Create", "Review", "Write"],
      defaultPrompt: [
        "Create a presentation from this brief and deliver a PDF.",
        "Turn these notes into a clear, visual Drever deck.",
        "Review this presentation and make it ready to present.",
      ],
      brandColor: "#5B45D8",
    },
  });

const claudeManifest = (version) =>
  json({
    name: "drever",
    version,
    description: "Create, refine, validate, and deliver AI-first Drever presentations.",
    author: { name: "DREVER" },
    license: "MIT",
    keywords: ["ai", "mdx", "presentations", "slides"],
    skills: "./skills/",
  });

const rejectSymbolicLink = (path) => {
  throw new Error(`Drever agent skill projection does not support symbolic links: ${path}`);
};

const listFiles = async (root, current = root) => {
  if ((await lstat(current)).isSymbolicLink()) {
    rejectSymbolicLink(current);
  }
  const entries = await readdir(current, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => {
        const path = join(current, entry.name);
        if (entry.isSymbolicLink()) {
          rejectSymbolicLink(path);
        }
        return entry.isDirectory() ? listFiles(root, path) : [relative(root, path)];
      }),
  );
  return files.flat();
};

const expectedFiles = async (pluginRoot, sourceRoot) => {
  const packageManifest = JSON.parse(await readFile(join(pluginRoot, "package.json"), "utf8"));
  const expected = new Map([
    [".claude-plugin/plugin.json", claudeManifest(packageManifest.version)],
    [".codex-plugin/plugin.json", codexManifest(packageManifest.version)],
  ]);
  for (const path of await listFiles(sourceRoot)) {
    expected.set(join("skills", path), await readFile(join(sourceRoot, path), "utf8"));
  }
  return expected;
};

const actualGeneratedFiles = async (pluginRoot) => {
  const files = await Promise.all(
    generatedRoots.map(async (root) => {
      try {
        return (await listFiles(join(pluginRoot, root))).map((path) => join(root, path));
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          return [];
        }
        throw error;
      }
    }),
  );
  return files.flat().sort((left, right) => left.localeCompare(right));
};

const assertSynchronized = async (pluginRoot, expected) => {
  const actualPaths = await actualGeneratedFiles(pluginRoot);
  const expectedPaths = [...expected.keys()].sort((left, right) => left.localeCompare(right));
  const actual = new Set(actualPaths);
  const wanted = new Set(expectedPaths);
  const missing = expectedPaths.filter((path) => !actual.has(path));
  const extra = actualPaths.filter((path) => !wanted.has(path));
  const changed = [];
  for (const path of expectedPaths.filter((path) => actual.has(path))) {
    if ((await readFile(join(pluginRoot, path), "utf8")) !== expected.get(path)) {
      changed.push(path);
    }
  }
  if (missing.length + extra.length + changed.length > 0) {
    const details = [
      ...missing.map((path) => `missing: ${path}`),
      ...extra.map((path) => `extra: ${path}`),
      ...changed.map((path) => `changed: ${path}`),
    ];
    throw new Error(
      `Drever agent plugin is out of sync. Run its sync script.\n${details.join("\n")}`,
    );
  }
};

const writeExpectedFiles = async (pluginRoot, expected) => {
  await Promise.all(
    generatedRoots.map((root) => rm(join(pluginRoot, root), { force: true, recursive: true })),
  );
  for (const [path, contents] of expected) {
    const destination = join(pluginRoot, path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, contents, "utf8");
  }
};

export const synchronizePlugin = async ({
  mode,
  pluginRoot = defaultPluginRoot,
  sourceRoot = defaultSourceRoot,
}) => {
  const expected = await expectedFiles(pluginRoot, sourceRoot);
  if (mode === "write") {
    await actualGeneratedFiles(pluginRoot);
    await writeExpectedFiles(pluginRoot, expected);
    return;
  }
  await assertSynchronized(pluginRoot, expected);
};

const argument = process.argv[2];
if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  if (argument !== "--check" && argument !== "--write") {
    throw new Error("Usage: node scripts/sync-plugin.mjs <--check|--write>");
  }
  await synchronizePlugin({ mode: argument.slice(2) });
}

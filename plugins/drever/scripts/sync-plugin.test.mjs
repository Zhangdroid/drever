import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";
import { synchronizePlugin } from "./sync-plugin.mjs";

const temporaryRoots = [];

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "drever-agent-plugin-"));
  const pluginRoot = join(root, "plugin");
  const sourceRoot = join(root, "canonical-skills");
  temporaryRoots.push(root);
  await mkdir(pluginRoot, { recursive: true });
  await mkdir(join(sourceRoot, "drever-create-deck", "agents"), { recursive: true });
  await writeFile(
    join(pluginRoot, "package.json"),
    '{"name":"@drever/agent","version":"1.2.3"}\n',
    "utf8",
  );
  await writeFile(
    join(sourceRoot, "drever-create-deck", "SKILL.md"),
    "---\nname: drever-create-deck\ndescription: Create a deck.\n---\n",
    "utf8",
  );
  await writeFile(
    join(sourceRoot, "drever-create-deck", "agents", "openai.yaml"),
    'interface:\n  display_name: "Drever Create Deck"\n  short_description: "Create a complete Drever presentation"\n',
    "utf8",
  );
  await synchronizePlugin({ mode: "write", pluginRoot, sourceRoot });
  return { pluginRoot, sourceRoot };
};

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

test("writes a byte-identical plugin and validates it", async () => {
  const { pluginRoot, sourceRoot } = await fixture();

  await synchronizePlugin({ mode: "check", pluginRoot, sourceRoot });

  assert.equal(
    await readFile(join(pluginRoot, "skills/drever-create-deck/SKILL.md"), "utf8"),
    await readFile(join(sourceRoot, "drever-create-deck/SKILL.md"), "utf8"),
  );
  assert.equal(
    JSON.parse(await readFile(join(pluginRoot, ".codex-plugin/plugin.json"), "utf8")).version,
    "1.2.3",
  );
});

for (const [label, failure, mutate] of [
  [
    "a changed",
    "changed",
    (root) => writeFile(join(root, "skills/drever-create-deck/SKILL.md"), "changed\n", "utf8"),
  ],
  ["a missing", "missing", (root) => rm(join(root, "skills/drever-create-deck/SKILL.md"))],
  [
    "an extra",
    "extra",
    async (root) => {
      const path = join(root, "skills/unowned/SKILL.md");
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, "extra\n", "utf8");
    },
  ],
]) {
  test(`rejects ${label} generated file`, async () => {
    const { pluginRoot, sourceRoot } = await fixture();
    await mutate(pluginRoot);

    await assert.rejects(
      synchronizePlugin({ mode: "check", pluginRoot, sourceRoot }),
      new RegExp(`${failure}: skills/`, "u"),
    );
  });
}

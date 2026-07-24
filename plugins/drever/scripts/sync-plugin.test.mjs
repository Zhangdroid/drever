import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";
import { synchronizePlugin } from "./sync-plugin.mjs";

const temporaryRoots = [];

const createFixture = async () => {
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
  return { pluginRoot, root, sourceRoot };
};

const fixture = async () => {
  const result = await createFixture();
  const { pluginRoot, sourceRoot } = result;
  await synchronizePlugin({ mode: "write", pluginRoot, sourceRoot });
  return result;
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

const driftCases = [
  {
    label: "a changed",
    marker: "changed",
    mutate: (root) =>
      writeFile(join(root, "skills/drever-create-deck/SKILL.md"), "changed\n", "utf8"),
  },
  {
    label: "a missing",
    marker: "missing",
    mutate: (root) => rm(join(root, "skills/drever-create-deck/SKILL.md")),
  },
  {
    label: "an extra",
    marker: "extra",
    mutate: async (root) => {
      const path = join(root, "skills/unowned/SKILL.md");
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, "extra\n", "utf8");
    },
  },
];

for (const { label, marker, mutate } of driftCases) {
  test(`rejects ${label} generated file`, async () => {
    const { pluginRoot, sourceRoot } = await fixture();
    await mutate(pluginRoot);

    await assert.rejects(
      synchronizePlugin({ mode: "check", pluginRoot, sourceRoot }),
      new RegExp(`${marker}: skills/`, "u"),
    );
  });
}

test("rejects a symbolic canonical skill root", async () => {
  const { pluginRoot, root, sourceRoot } = await createFixture();
  const linkedSourceRoot = join(root, "linked-canonical-skills");
  await symlink(sourceRoot, linkedSourceRoot, "dir");

  await assert.rejects(
    synchronizePlugin({ mode: "write", pluginRoot, sourceRoot: linkedSourceRoot }),
    /does not support symbolic links: .*linked-canonical-skills/u,
  );
});

test("rejects a symbolic file inside the canonical skill tree", async () => {
  const { pluginRoot, root, sourceRoot } = await createFixture();
  const linkedFile = join(sourceRoot, "drever-create-deck", "REFERENCE.md");
  await writeFile(join(root, "reference.md"), "canonical reference\n", "utf8");
  await symlink(join(root, "reference.md"), linkedFile);

  await assert.rejects(
    synchronizePlugin({ mode: "write", pluginRoot, sourceRoot }),
    /does not support symbolic links: .*REFERENCE\.md/u,
  );
});

test("rejects a symbolic generated skills root before rewriting it", async () => {
  const { pluginRoot, sourceRoot } = await fixture();
  const generatedSkillsRoot = join(pluginRoot, "skills");
  await rm(generatedSkillsRoot, { force: true, recursive: true });
  await symlink(sourceRoot, generatedSkillsRoot, "dir");

  await assert.rejects(
    synchronizePlugin({ mode: "write", pluginRoot, sourceRoot }),
    /does not support symbolic links: .*skills/u,
  );
});

test("rejects a byte-identical symbolic file in the generated skill tree", async () => {
  const { pluginRoot, sourceRoot } = await fixture();
  const generatedSkill = join(pluginRoot, "skills", "drever-create-deck", "SKILL.md");
  await rm(generatedSkill);
  await symlink(join(sourceRoot, "drever-create-deck", "SKILL.md"), generatedSkill);

  await assert.rejects(
    synchronizePlugin({ mode: "check", pluginRoot, sourceRoot }),
    /does not support symbolic links: .*SKILL\.md/u,
  );
});

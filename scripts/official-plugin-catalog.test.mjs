import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const packagesDirectory = new URL("packages/", root);
const catalogFiles = [
  "docs/official-plugins.md",
  "examples/feature-gallery/slides.mdx",
  "website/content/docs/plugins.mdx",
];
const read = (path) => readFile(new URL(path, root), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("every official plugin is documented and demonstrated", async () => {
  const directories = (await readdir(packagesDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("plugin-"))
    .map((entry) => entry.name)
    .sort();
  const plugins = await Promise.all(
    directories.map(async (directory) => {
      const manifest = await readJson(`packages/${directory}/package.json`);
      return { directory, id: manifest.name };
    }),
  );
  const catalogs = await Promise.all(catalogFiles.map(async (path) => [path, await read(path)]));
  const [
    cliManifest,
    cliFacade,
    cliProject,
    featureConfig,
    featureManifest,
    releaseSource,
    visualCatalog,
  ] = await Promise.all([
    readJson("packages/cli/package.json"),
    read("packages/cli/src/index.ts"),
    read("packages/cli/src/project.ts"),
    read("examples/feature-gallery/drever.config.ts"),
    readJson("examples/feature-gallery/package.json"),
    read("scripts/release.mjs"),
    read("website/src/components/doc-showcase.tsx"),
  ]);

  for (const { directory, id } of plugins) {
    assert.equal(typeof id, "string", "Official plugin packages must have a package name.");
    for (const [path, source] of catalogs) {
      assert.ok(source.includes(id), `${id} is missing from ${path}`);
    }

    assert.ok(visualCatalog.includes(id), `${id} is missing from the visual website catalog`);
    assert.ok(
      releaseSource.includes(`packages/${directory}/src/index.ts`),
      `${id} is missing from release runtime version metadata`,
    );

    const includedByDefault = Object.hasOwn(cliManifest.dependencies, id);
    if (includedByDefault) {
      assert.ok(cliProject.includes(id), `${id} is not wired into the CLI defaults`);
      assert.ok(cliFacade.includes(id), `${id} is not exported by the drever facade`);
    } else {
      assert.ok(
        Object.hasOwn(featureManifest.devDependencies, id),
        `${id} is missing from the Feature Gallery dependencies`,
      );
      assert.ok(featureConfig.includes(id), `${id} is not enabled by the Feature Gallery`);
    }
  }
});

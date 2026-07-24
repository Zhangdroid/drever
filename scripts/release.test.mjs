import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, test } from "node:test";
import { promisify } from "node:util";
import {
  assertDistTag,
  cleanReleaseOutputs,
  commitVersion,
  normalizePackedManifest,
  orderPublicPackages,
  planRelease,
  repositoryUrl,
  runtimeVersionFiles,
  setReleaseVersion,
  publishRelease,
  verifyPackedManifest,
} from "./release.mjs";

const temporaryRoots = [];
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const execute = promisify(execFile);

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

test("creates a stable commit prerelease version", () => {
  assert.equal(
    commitVersion("0123456789abcdef0123456789abcdef01234567"),
    "0.0.0-commit.g0123456789ab",
  );
  assert.throws(() => commitVersion("main"), /Invalid Git commit/u);
  assert.throws(() => commitVersion("0123456789a"), /Invalid Git commit/u);
  assert.doesNotThrow(() => assertDistTag("commit"));
  assert.throws(() => assertDistTag("latest;id"), /Invalid npm dist-tag/u);
});

test("plans commit, next, and latest releases with their matching npm tags", () => {
  const commit = "0123456789abcdef0123456789abcdef01234567";

  assert.deepEqual(planRelease({ channel: "commit", commit }), {
    version: "0.0.0-commit.g0123456789ab",
    tag: "commit",
    prerelease: true,
  });
  assert.deepEqual(planRelease({ channel: "next", commit, requestedVersion: "1.2.0-beta.3" }), {
    version: "1.2.0-beta.3",
    tag: "next",
    prerelease: true,
  });
  assert.deepEqual(planRelease({ channel: "latest", commit, requestedVersion: " 1.2.0 " }), {
    version: "1.2.0",
    tag: "latest",
    prerelease: false,
  });
});

test("rejects versions that do not match the selected release channel", () => {
  const commit = "0123456789abcdef0123456789abcdef01234567";

  assert.throws(
    () => planRelease({ channel: "commit", commit, requestedVersion: "1.2.0" }),
    /do not accept an explicit version/u,
  );
  assert.throws(
    () => planRelease({ channel: "next", commit, requestedVersion: "1.2.0" }),
    /require a prerelease version/u,
  );
  assert.throws(
    () => planRelease({ channel: "latest", commit, requestedVersion: "1.2.0-rc.1" }),
    /require a non-prerelease version/u,
  );
  assert.throws(
    () => planRelease({ channel: "next", commit, requestedVersion: "1.02.0-beta.1" }),
    /Invalid release version/u,
  );
  assert.throws(() => planRelease({ channel: "latest", commit }), /require an explicit version/u);
  assert.throws(
    () => planRelease({ channel: "stable", commit, requestedVersion: "1.2.0" }),
    /Unsupported release channel/u,
  );
  assert.throws(
    () => planRelease({ channel: "latest", commit: "main", requestedVersion: "1.2.0" }),
    /Invalid Git commit/u,
  );
});

test("prints a release plan as JSON from the command line", async () => {
  const releaseScript = fileURLToPath(new URL("./release.mjs", import.meta.url));
  const { stdout } = await execute(process.execPath, [
    releaseScript,
    "plan",
    "next",
    "0123456789abcdef0123456789abcdef01234567",
    "2.0.0-rc.1",
  ]);

  assert.deepEqual(JSON.parse(stdout), {
    version: "2.0.0-rc.1",
    tag: "next",
    prerelease: true,
  });
});

test("orders internal dependencies before public entry packages", () => {
  const packages = [
    { manifest: { name: "create-drever", dependencies: { drever: "workspace:*" } } },
    { manifest: { name: "drever", dependencies: { "@drever/core": "workspace:*" } } },
    { manifest: { name: "@drever/core", dependencies: { "@drever/schema": "workspace:*" } } },
    { manifest: { name: "@drever/schema" } },
  ];
  assert.deepEqual(
    orderPublicPackages(packages).map(({ manifest }) => manifest.name),
    ["@drever/schema", "@drever/core", "drever", "create-drever"],
  );
});

test("rejects unresolved or mismatched packed dependencies", () => {
  const packageNames = new Set(["@drever/core", "@drever/schema"]);
  const manifest = {
    name: "@drever/core",
    version: "0.0.0-commit.g0123456789ab",
    repository: { url: repositoryUrl, directory: "packages/core" },
    dependencies: { "@drever/schema": "workspace:*" },
  };
  assert.throws(
    () =>
      verifyPackedManifest({
        manifest,
        packageDirectory: "packages/core",
        packageNames,
        version: manifest.version,
      }),
    /unresolved dependency/u,
  );
  manifest.dependencies["@drever/schema"] = "0.0.0";
  assert.throws(
    () =>
      verifyPackedManifest({
        manifest,
        packageDirectory: "packages/core",
        packageNames,
        version: manifest.version,
      }),
    /packed internal dependency/u,
  );
});

test("normalizes dependency order without changing conditional export order", () => {
  const first = normalizePackedManifest({
    dependencies: { zeta: "1.0.0", alpha: "1.0.0" },
    exports: { ".": { browser: "./browser.mjs", default: "./index.mjs" } },
  });
  const second = normalizePackedManifest({
    dependencies: { alpha: "1.0.0", zeta: "1.0.0" },
    exports: { ".": { browser: "./browser.mjs", default: "./index.mjs" } },
  });

  assert.equal(json(first), json(second));
  assert.deepEqual(Object.keys(first.dependencies), ["alpha", "zeta"]);
  assert.deepEqual(Object.keys(first.exports["."]), ["browser", "default"]);
});

test("rejects release receipt tarballs outside the audited directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "drever-release-receipt-"));
  temporaryRoots.push(root);
  const receiptPath = join(root, "release.json");
  await writeFile(
    receiptPath,
    json({
      schemaVersion: 1,
      version: "0.0.0-commit.g0123456789ab",
      packages: [
        {
          name: "drever",
          tarball: "../outside.tgz",
          integrity: "sha512-invalid",
          size: 1,
        },
      ],
    }),
    "utf8",
  );

  await assert.rejects(
    publishRelease({ dryRun: true, receiptPath, tag: "commit" }),
    /escapes its artifact directory/u,
  );
});

test("updates every lockstep and mirrored runtime version", async () => {
  const root = await mkdtemp(join(tmpdir(), "drever-release-version-"));
  temporaryRoots.push(root);
  const version = "0.0.0-commit.g0123456789ab";
  const packageDirectories = new Set([
    "packages/core",
    "plugins/drever",
    ...runtimeVersionFiles.map((path) => path.split("/").slice(0, 2).join("/")),
  ]);
  const manifests = [...packageDirectories].map((directory) => [
    `${directory}/package.json`,
    {
      name: directory === "plugins/drever" ? "@drever/agent" : `@drever/${directory.slice(9)}`,
      version: "0.0.0",
    },
  ]);
  for (const [path, value] of manifests) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), json(value), "utf8");
  }
  await mkdir(join(root, ".claude-plugin"), { recursive: true });
  await writeFile(
    join(root, ".claude-plugin", "marketplace.json"),
    json({ plugins: [{ name: "drever", version: "0.0.0" }] }),
    "utf8",
  );
  for (const path of [
    "plugins/drever/.claude-plugin/plugin.json",
    "plugins/drever/.codex-plugin/plugin.json",
  ]) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), json({ name: "drever", version: "0.0.0" }), "utf8");
  }
  for (const path of runtimeVersionFiles) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), 'export const value = {\n  version: "0.0.0",\n};\n', "utf8");
  }

  await setReleaseVersion(root, version);

  for (const [path] of manifests) {
    assert.equal(JSON.parse(await readFile(join(root, path), "utf8")).version, version);
  }
  for (const path of runtimeVersionFiles) {
    assert.match(
      await readFile(join(root, path), "utf8"),
      new RegExp(`version: "${version}"`, "u"),
    );
  }
  const marketplace = JSON.parse(
    await readFile(join(root, ".claude-plugin", "marketplace.json"), "utf8"),
  );
  assert.equal(marketplace.plugins[0].version, version);

  const staleOutput = join(root, "packages", "core", "dist", "stale.mjs");
  await mkdir(dirname(staleOutput), { recursive: true });
  await writeFile(staleOutput, "stale\n", "utf8");
  await cleanReleaseOutputs(root);
  await assert.rejects(readFile(staleOutput, "utf8"), { code: "ENOENT" });
  assert.equal(
    JSON.parse(await readFile(join(root, "packages/core/package.json"), "utf8")).version,
    version,
  );
});

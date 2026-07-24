import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
const defaultRoot = fileURLToPath(new URL("../", import.meta.url));
const packageRootNames = ["packages", "plugins"];
const dependencyFields = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

export const repositoryUrl = "git+https://github.com/Zhangdroid/drever.git";
export const runtimeVersionFiles = [
  "packages/plugin-charts/src/index.ts",
  "packages/plugin-gfm/src/index.ts",
  "packages/plugin-math/src/index.ts",
  "packages/plugin-media/src/index.ts",
  "packages/plugin-shiki/src/index.ts",
  "packages/plugin-tailwindcss/src/index.ts",
  "packages/designs/src/atlas/index.ts",
  "packages/designs/src/cinema/index.ts",
  "packages/designs/src/construct/index.ts",
  "packages/designs/src/default/index.ts",
  "packages/designs/src/editorial/index.ts",
  "packages/designs/src/fieldnote/index.ts",
  "packages/designs/src/ledger/index.ts",
  "packages/designs/src/studio/index.ts",
];

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const portablePath = (path) => path.split(sep).join("/");
const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

export function assertReleaseVersion(version) {
  const separator = version.indexOf("-");
  const core = separator === -1 ? version : version.slice(0, separator);
  const prerelease = separator === -1 ? undefined : version.slice(separator + 1);
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(core)) {
    throw new Error(`Invalid release version: ${version}`);
  }
  if (prerelease === undefined) return;
  const identifiers = prerelease.split(".");
  if (
    identifiers.some(
      (identifier) =>
        !/^[0-9A-Za-z-]+$/u.test(identifier) ||
        (/^\d+$/u.test(identifier) && identifier.length > 1 && identifier.startsWith("0")),
    )
  ) {
    throw new Error(`Invalid release version: ${version}`);
  }
}

export function commitVersion(commit) {
  if (!/^[0-9a-f]{12,40}$/u.test(commit)) {
    throw new Error(`Invalid Git commit: ${commit}`);
  }
  return `0.0.0-commit.g${commit.slice(0, 12)}`;
}

export function planRelease({ channel, commit, requestedVersion }) {
  const commitReleaseVersion = commitVersion(commit);
  const version = typeof requestedVersion === "string" ? requestedVersion.trim() : requestedVersion;

  if (channel === "commit") {
    if (version !== undefined && version !== "") {
      throw new Error("Commit releases do not accept an explicit version.");
    }
    return {
      version: commitReleaseVersion,
      tag: channel,
      prerelease: true,
    };
  }

  if (channel !== "next" && channel !== "latest") {
    throw new Error(`Unsupported release channel: ${channel}`);
  }
  if (typeof version !== "string" || version.length === 0) {
    throw new Error(`${channel} releases require an explicit version.`);
  }

  assertReleaseVersion(version);
  const hasPrerelease = version.includes("-");
  if (channel === "next" && !hasPrerelease) {
    throw new Error("Next releases require a prerelease version.");
  }
  if (channel === "latest" && hasPrerelease) {
    throw new Error("Latest releases require a non-prerelease version.");
  }

  return {
    version,
    tag: channel,
    prerelease: channel !== "latest",
  };
}

export function assertDistTag(tag) {
  if (!/^[a-z][a-z0-9-]*$/u.test(tag)) throw new Error(`Invalid npm dist-tag: ${tag}`);
}

export async function readPublicPackages(root = defaultRoot) {
  const packages = (
    await Promise.all(
      packageRootNames.map(async (packageRootName) => {
        const packageRoot = join(root, packageRootName);
        return Promise.all(
          (await readdir(packageRoot, { withFileTypes: true }))
            .filter((entry) => entry.isDirectory())
            .map(async (entry) => {
              const directory = join(packageRoot, entry.name);
              return {
                directory,
                relativeDirectory: portablePath(relative(root, directory)),
                manifest: await readJson(join(directory, "package.json")),
              };
            }),
        );
      }),
    )
  ).flat();
  return packages.filter(({ manifest }) => manifest.private !== true);
}

export async function cleanReleaseOutputs(root = defaultRoot) {
  const packages = await readPublicPackages(root);
  await Promise.all(
    packages.map(({ directory }) => rm(join(directory, "dist"), { force: true, recursive: true })),
  );
}

const internalDependencies = (manifest, names) =>
  new Set(
    dependencyFields.flatMap((field) =>
      Object.keys(manifest[field] ?? {}).filter((name) => names.has(name)),
    ),
  );

export function orderPublicPackages(packages) {
  const names = new Set(packages.map(({ manifest }) => manifest.name));
  const packagesByName = new Map(packages.map((value) => [value.manifest.name, value]));
  const pending = new Map(
    packages.map((value) => [value.manifest.name, internalDependencies(value.manifest, names)]),
  );
  const ordered = [];

  while (pending.size > 0) {
    const ready = [...pending]
      .filter(([, dependencies]) => dependencies.size === 0)
      .map(([name]) => name)
      .sort(compareText);
    if (ready.length === 0) {
      throw new Error(`Release package dependency cycle: ${[...pending.keys()].join(", ")}`);
    }
    for (const name of ready) {
      ordered.push(packagesByName.get(name));
      pending.delete(name);
      for (const dependencies of pending.values()) dependencies.delete(name);
    }
  }

  return ordered;
}

const updateVersionFile = async (path, version) => {
  const source = await readFile(path, "utf8");
  const pattern = /("version":\s*")[^"]+(")/gu;
  if ([...source.matchAll(pattern)].length !== 1) {
    throw new Error(`Expected one package version in ${path}.`);
  }
  await writeFile(path, source.replace(pattern, `$1${version}$2`), "utf8");
};

const updateRuntimeVersion = async (path, version) => {
  const source = await readFile(path, "utf8");
  const pattern = /(\n\s*version:\s*")[^"]+("[,\n])/gu;
  if ([...source.matchAll(pattern)].length !== 1) {
    throw new Error(`Expected one runtime version in ${path}.`);
  }
  await writeFile(path, source.replace(pattern, `$1${version}$2`), "utf8");
};

export async function setReleaseVersion(root = defaultRoot, version) {
  assertReleaseVersion(version);
  const packages = await readPublicPackages(root);
  await Promise.all(
    packages.map(({ directory }) => updateVersionFile(join(directory, "package.json"), version)),
  );

  const marketplacePath = join(root, ".claude-plugin", "marketplace.json");
  const marketplace = await readJson(marketplacePath);
  const marketplacePlugin = marketplace.plugins?.find(({ name }) => name === "drever");
  if (marketplacePlugin === undefined) {
    throw new Error("The Claude marketplace is missing the Drever plugin.");
  }
  await updateVersionFile(marketplacePath, version);

  await Promise.all(
    [
      join(root, "plugins", "drever", ".claude-plugin", "plugin.json"),
      join(root, "plugins", "drever", ".codex-plugin", "plugin.json"),
    ].map((path) => updateVersionFile(path, version)),
  );
  await Promise.all(
    runtimeVersionFiles.map((path) => updateRuntimeVersion(join(root, path), version)),
  );

  return packages;
}

const dependencyEntries = (manifest) =>
  dependencyFields.flatMap((field) => Object.entries(manifest[field] ?? {}));

export function normalizePackedManifest(manifest) {
  const normalized = { ...manifest };
  for (const field of dependencyFields) {
    if (normalized[field] === undefined) continue;
    normalized[field] = Object.fromEntries(
      Object.entries(normalized[field]).sort(([left], [right]) => compareText(left, right)),
    );
  }
  return normalized;
}

export function verifyPackedManifest({ manifest, packageDirectory, packageNames, version }) {
  if (manifest.version !== version) {
    throw new Error(`${manifest.name} packed version ${manifest.version} instead of ${version}.`);
  }
  if (
    manifest.repository?.url !== repositoryUrl ||
    manifest.repository?.directory !== packageDirectory
  ) {
    throw new Error(`${manifest.name} has incorrect repository metadata.`);
  }
  for (const [name, range] of dependencyEntries(manifest)) {
    if (typeof range === "string" && /^(?:catalog|workspace):/u.test(range)) {
      throw new Error(`${manifest.name} packed unresolved dependency ${name}@${range}.`);
    }
    if (packageNames.has(name) && range !== version) {
      throw new Error(`${manifest.name} packed internal dependency ${name}@${range}.`);
    }
  }
}

const packedManifest = async (tarball) => {
  const { stdout } = await execute("tar", ["-xOf", tarball, "package/package.json"], {
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(stdout);
};

const resolvePackedPath = (directory, stdout) => {
  const value = stdout
    .trim()
    .split("\n")
    .findLast((line) => line.trim().endsWith(".tgz"))
    ?.trim();
  if (value === undefined)
    throw new Error(`Could not locate the tarball packed from ${directory}.`);
  return isAbsolute(value) ? value : resolve(directory, value);
};

const repackDeterministically = async ({ output, temporaryRoot, tarball }) => {
  const unpacked = join(temporaryRoot, "unpacked");
  await mkdir(unpacked, { recursive: true });
  await execute("tar", ["-xzf", tarball, "-C", unpacked]);

  const packageRoot = join(unpacked, "package");
  const manifestPath = join(packageRoot, "package.json");
  await writeFile(
    manifestPath,
    json(normalizePackedManifest(await readJson(manifestPath))),
    "utf8",
  );

  const { stdout } = await execute(
    "npm",
    ["pack", packageRoot, `--pack-destination=${output}`, "--ignore-scripts", "--json"],
    {
      cwd: temporaryRoot,
      env: {
        ...process.env,
        FORCE_COLOR: "0",
        npm_config_cache: join(temporaryRoot, "npm-cache"),
      },
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  const result = JSON.parse(stdout);
  if (result.length !== 1 || typeof result[0]?.filename !== "string") {
    throw new Error(`npm did not return one packed tarball for ${tarball}.`);
  }
  return resolve(output, result[0].filename);
};

export async function packRelease({ output, root = defaultRoot }) {
  await mkdir(output, { recursive: true });
  if ((await readdir(output)).length > 0) {
    throw new Error(`Release output directory must be empty: ${output}`);
  }

  const packages = await readPublicPackages(root);
  const versions = new Set(packages.map(({ manifest }) => manifest.version));
  if (versions.size !== 1) throw new Error("Public packages must use one lockstep version.");
  const [version] = versions;
  assertReleaseVersion(version);
  const packageNames = new Set(packages.map(({ manifest }) => manifest.name));
  const ordered = orderPublicPackages(packages);
  const packed = [];
  const temporaryRoot = await mkdtemp(join(tmpdir(), "drever-pack-"));

  try {
    for (const [index, value] of ordered.entries()) {
      const packageRoot = join(temporaryRoot, String(index));
      const intermediate = join(packageRoot, "intermediate");
      await mkdir(intermediate, { recursive: true });
      const { stdout } = await execute("vp", ["pm", "pack", "--pack-destination", intermediate], {
        cwd: value.directory,
        env: { ...process.env, CI: "true", FORCE_COLOR: "0" },
        maxBuffer: 10 * 1024 * 1024,
      });
      const intermediateTarball = resolvePackedPath(value.directory, stdout);
      const intermediateManifest = await packedManifest(intermediateTarball);
      verifyPackedManifest({
        manifest: intermediateManifest,
        packageDirectory: value.relativeDirectory,
        packageNames,
        version,
      });

      const tarball = await repackDeterministically({
        output,
        temporaryRoot: packageRoot,
        tarball: intermediateTarball,
      });
      const manifest = await packedManifest(tarball);
      verifyPackedManifest({
        manifest,
        packageDirectory: value.relativeDirectory,
        packageNames,
        version,
      });
      const bytes = await readFile(tarball);
      packed.push({
        name: manifest.name,
        tarball: relative(output, tarball),
        integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
        size: bytes.byteLength,
      });
    }
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }

  const { stdout: commit } = await execute("git", ["rev-parse", "HEAD"], { cwd: root });
  const receipt = {
    schemaVersion: 1,
    version,
    commit: commit.trim(),
    packages: packed,
  };
  const receiptPath = join(output, "release.json");
  await writeFile(receiptPath, json(receipt), "utf8");
  return receiptPath;
}

const registryIntegrity = async (cwd, name, version) => {
  const environment = {
    ...process.env,
    FORCE_COLOR: "0",
    npm_config_cache: join(cwd, "npm-cache"),
  };
  try {
    const { stdout } = await execute(
      "npm",
      [
        "view",
        `${name}@${version}`,
        "dist.integrity",
        "--json",
        "--registry=https://registry.npmjs.org",
      ],
      { cwd, env: environment },
    );
    return JSON.parse(stdout);
  } catch (error) {
    if (error instanceof Error && "stderr" in error && String(error.stderr).includes("E404")) {
      return undefined;
    }
    throw error;
  }
};

const registryTagVersion = async (cwd, name, tag) => {
  const environment = {
    ...process.env,
    FORCE_COLOR: "0",
    npm_config_cache: join(cwd, "npm-cache"),
  };
  try {
    const { stdout } = await execute(
      "npm",
      ["view", `${name}@${tag}`, "version", "--json", "--registry=https://registry.npmjs.org"],
      { cwd, env: environment },
    );
    return JSON.parse(stdout);
  } catch (error) {
    if (error instanceof Error && "stderr" in error && String(error.stderr).includes("E404")) {
      return undefined;
    }
    throw error;
  }
};

const assertReceiptTarballs = async (receiptPath, receipt) => {
  const releaseRoot = dirname(receiptPath);
  const expectedNames = new Set(
    (await readPublicPackages(defaultRoot)).map(({ manifest }) => manifest.name),
  );
  const names = new Set();
  const tarballs = new Set();
  for (const value of receipt.packages) {
    if (
      typeof value.name !== "string" ||
      typeof value.tarball !== "string" ||
      typeof value.integrity !== "string" ||
      typeof value.size !== "number"
    ) {
      throw new Error("Invalid release receipt package entry.");
    }
    const tarballPath = resolve(releaseRoot, value.tarball);
    const relativePath = relative(releaseRoot, tarballPath);
    if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
      throw new Error(`Release tarball escapes its artifact directory: ${value.tarball}.`);
    }
    if (names.has(value.name) || tarballs.has(tarballPath)) {
      throw new Error(`Duplicate package in release receipt: ${value.name}.`);
    }
    names.add(value.name);
    tarballs.add(tarballPath);

    const manifest = await packedManifest(tarballPath);
    if (manifest.name !== value.name || manifest.version !== receipt.version) {
      throw new Error(`Release tarball manifest does not match ${value.name}@${receipt.version}.`);
    }
    const bytes = await readFile(tarballPath);
    const integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
    if (integrity !== value.integrity || bytes.byteLength !== value.size) {
      throw new Error(`Release tarball integrity changed for ${value.name}.`);
    }
  }
  if (names.size !== expectedNames.size || [...expectedNames].some((name) => !names.has(name))) {
    throw new Error("Release receipt does not contain every public package exactly once.");
  }
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const assertRegistryTags = async (cwd, packages, tag, version) => {
  const delays = [0, 2_000, 4_000, 8_000, 16_000];
  let mismatches = [];
  for (const [attempt, delay] of delays.entries()) {
    if (delay > 0) await wait(delay);
    try {
      const versions = await Promise.all(
        packages.map(({ name }) => registryTagVersion(cwd, name, tag)),
      );
      mismatches = packages
        .filter((_, index) => versions[index] !== version)
        .map(({ name }) => name);
      if (mismatches.length === 0) return;
    } catch (error) {
      if (attempt === delays.length - 1) {
        throw new Error(`Could not verify npm dist-tag ${tag}.`, { cause: error });
      }
    }
  }
  throw new Error(
    `npm dist-tag ${tag} does not resolve to ${version} for: ${mismatches.join(", ")}.`,
  );
};

export async function publishRelease({ dryRun = false, receiptPath, tag }) {
  assertDistTag(tag);
  const receipt = await readJson(receiptPath);
  if (receipt.schemaVersion !== 1 || !Array.isArray(receipt.packages)) {
    throw new Error("Invalid release receipt.");
  }
  assertReleaseVersion(receipt.version);
  await assertReceiptTarballs(receiptPath, receipt);

  const cwd = await mkdtemp(join(tmpdir(), "drever-publish-"));
  const environment = {
    ...process.env,
    FORCE_COLOR: "0",
    npm_config_cache: join(cwd, "npm-cache"),
  };
  try {
    if (dryRun) {
      for (const value of receipt.packages) {
        await execute(
          "npm",
          [
            "publish",
            resolve(dirname(receiptPath), value.tarball),
            "--access=public",
            `--tag=${tag}`,
            "--dry-run",
          ],
          { cwd, env: environment, maxBuffer: 10 * 1024 * 1024 },
        );
      }
      return { published: [], skipped: [] };
    }

    const existing = new Set();
    for (const value of receipt.packages) {
      const integrity = await registryIntegrity(cwd, value.name, receipt.version);
      if (integrity === undefined) continue;
      if (integrity !== value.integrity) {
        throw new Error(`${value.name}@${receipt.version} already exists with different contents.`);
      }
      existing.add(value.name);
    }

    const published = [];
    for (const value of receipt.packages) {
      if (existing.has(value.name)) continue;
      const arguments_ = [
        "publish",
        resolve(dirname(receiptPath), value.tarball),
        "--access=public",
        `--tag=${tag}`,
      ];
      await execute("npm", arguments_, {
        cwd,
        env: environment,
        maxBuffer: 10 * 1024 * 1024,
      });
      published.push(value.name);
      process.stdout.write(`Published ${value.name}@${receipt.version} with tag ${tag}.\n`);
    }
    await assertRegistryTags(cwd, receipt.packages, tag, receipt.version);
    return { published, skipped: [...existing] };
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
}

const usage =
  "Usage: node scripts/release.mjs <packages|clean|commit-version SHA|validate-version VERSION|plan CHANNEL COMMIT [VERSION]|prepare VERSION|pack DIRECTORY|publish RECEIPT TAG [--dry-run]>";

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const [command, ...arguments_] = process.argv.slice(2);
  if (command === "packages" && arguments_.length === 0) {
    const names = (await readPublicPackages(defaultRoot))
      .map(({ manifest }) => manifest.name)
      .sort((left, right) => left.localeCompare(right));
    process.stdout.write(`${names.join("\n")}\n`);
  } else if (command === "clean" && arguments_.length === 0) {
    await cleanReleaseOutputs(defaultRoot);
  } else if (command === "commit-version" && arguments_.length === 1) {
    process.stdout.write(`${commitVersion(arguments_[0])}\n`);
  } else if (command === "validate-version" && arguments_.length === 1) {
    assertReleaseVersion(arguments_[0]);
  } else if (command === "plan" && (arguments_.length === 2 || arguments_.length === 3)) {
    const [channel, commit, requestedVersion] = arguments_;
    process.stdout.write(json(planRelease({ channel, commit, requestedVersion })));
  } else if (command === "prepare" && arguments_.length === 1) {
    const packages = await setReleaseVersion(defaultRoot, arguments_[0]);
    process.stdout.write(`Prepared ${packages.length} packages at ${arguments_[0]}.\n`);
  } else if (command === "pack" && arguments_.length === 1) {
    process.stdout.write(`${await packRelease({ output: resolve(arguments_[0]) })}\n`);
  } else if (command === "publish" && (arguments_.length === 2 || arguments_.length === 3)) {
    const [receiptPath, tag, flag] = arguments_;
    if (flag !== undefined && flag !== "--dry-run") throw new Error(usage);
    await publishRelease({
      dryRun: flag === "--dry-run",
      receiptPath: resolve(receiptPath),
      tag,
    });
  } else {
    throw new Error(usage);
  }
}

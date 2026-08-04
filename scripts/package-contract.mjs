import { execFile } from "node:child_process";
import { isAbsolute, matchesGlob, posix } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);

const collectPublishedTargets = (value, targets, allowBare = false) => {
  if (typeof value === "string") {
    const target = value.startsWith("./") ? value.slice(2) : allowBare ? value : undefined;
    if (
      target !== undefined &&
      !isAbsolute(target) &&
      !target.startsWith("#") &&
      !/^[a-z][a-z\d+.-]*:/iu.test(target)
    ) {
      targets.add(target);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectPublishedTargets(item, targets, allowBare);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) collectPublishedTargets(item, targets, allowBare);
  }
};

export function publishedPackageTargets(manifest) {
  const targets = new Set();
  collectPublishedTargets(manifest.exports, targets);
  collectPublishedTargets(manifest.browser, targets, typeof manifest.browser === "string");
  for (const value of [
    manifest.bin,
    manifest.main,
    manifest.module,
    manifest.types,
    manifest.typings,
    manifest.style,
  ]) {
    collectPublishedTargets(value, targets, true);
  }
  return targets;
}

const packedPathMatches = (files, target) => {
  if (target.includes("*")) return [...files].some((path) => matchesGlob(path, target));
  return files.has(target);
};

export function verifyPackedContents({ files: packedFiles, manifest }) {
  const files = new Set(
    [...packedFiles].map((path) => path.replace(/^\.\//u, "").replace(/\/$/u, "")).filter(Boolean),
  );
  for (const target of publishedPackageTargets(manifest)) {
    if (!packedPathMatches(files, target)) {
      throw new Error(`${manifest.name} tarball is missing published target ${target}.`);
    }
  }
  for (const selector of manifest.files ?? []) {
    if (typeof selector !== "string" || selector.startsWith("!")) continue;
    const target = selector.replace(/^\.\//u, "").replace(/\/$/u, "");
    const included = target.includes("*")
      ? [...files].some((path) => matchesGlob(path, target))
      : files.has(target) || [...files].some((path) => path.startsWith(`${target}/`));
    if (!included) {
      throw new Error(
        `${manifest.name} tarball does not contain declared files entry ${selector}.`,
      );
    }
  }
}

const readPackedManifest = async (tarball) => {
  const { stdout } = await execute("tar", ["-xOf", tarball, "package/package.json"], {
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(stdout);
};

const readPackedFiles = async (tarball) => {
  const { stdout } = await execute("tar", ["-tzf", tarball], {
    maxBuffer: 10 * 1024 * 1024,
  });
  return new Set(
    stdout
      .split("\n")
      .filter((path) => path.startsWith("package/") && path !== "package/")
      .map((path) => path.slice("package/".length)),
  );
};

const packedStyleSheets = (manifest, files) =>
  [...publishedPackageTargets(manifest)].flatMap((target) => {
    if (!target.endsWith(".css")) return [];
    if (!target.includes("*")) return [target];
    return [...files].filter((path) => matchesGlob(path, target));
  });

const verifyPackedStyleAssets = async ({ files, manifest, tarball }) => {
  for (const stylesheet of packedStyleSheets(manifest, files)) {
    const { stdout: css } = await execute("tar", ["-xOf", tarball, `package/${stylesheet}`], {
      maxBuffer: 10 * 1024 * 1024,
    });
    for (const match of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gu)) {
      const reference = (match[1] ?? match[2] ?? match[3] ?? "").trim();
      if (
        reference.length === 0 ||
        reference.startsWith("#") ||
        reference.startsWith("/") ||
        reference.startsWith("var(") ||
        /^[a-z][a-z\d+.-]*:/iu.test(reference)
      ) {
        continue;
      }
      const path = posix.normalize(
        posix.join(posix.dirname(stylesheet), reference.split(/[?#]/u, 1)[0]),
      );
      if (!files.has(path)) {
        throw new Error(
          `${manifest.name} tarball is missing ${path}, referenced by ${stylesheet}.`,
        );
      }
    }
  }
};

export async function verifyPackedTarball(tarball) {
  const [manifest, files] = await Promise.all([
    readPackedManifest(tarball),
    readPackedFiles(tarball),
  ]);
  verifyPackedContents({ files, manifest });
  await verifyPackedStyleAssets({ files, manifest, tarball });
  return manifest;
}

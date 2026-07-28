import { execFile } from "node:child_process";
import { lstat, readdir } from "node:fs/promises";
import { getgid, getuid } from "node:process";
import { isAbsolute, posix, resolve } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);

export const RELEASE_SMOKE_BUILD_IMAGE =
  "node@sha256:d45d78e7929b46875bbd4e29bea672d5bc48186c6c3588306521c815e78352d6";
export const ISOLATED_BUILD_RECEIPT_PREFIX = "drever-release-smoke-receipt:";
export const ISOLATED_BUILD_AUTHORING_FAILURE_PREFIX = "drever-release-smoke-authoring-failure:";
export const MAX_BUILD_FILES = 1_000;
export const MAX_BUILD_BYTES = 64 * 1024 * 1024;

const assertBindSource = (path, label) => {
  const absolutePath = resolve(path);
  if (absolutePath.includes(",")) {
    throw new Error(`${label} cannot contain a comma because it is used as a Docker bind source.`);
  }
  return absolutePath;
};

export const createReleaseSmokeContainerArguments = ({
  image = RELEASE_SMOKE_BUILD_IMAGE,
  projectRoot,
  runnerPath,
  user = `${String(getuid())}:${String(getgid())}`,
}) => {
  if (image !== RELEASE_SMOKE_BUILD_IMAGE) {
    throw new Error(`Unexpected release smoke build image: ${image}`);
  }
  if (!/^\d+:\d+$/u.test(user) || user.startsWith("0:")) {
    throw new Error(`Release smoke build container must use a non-root numeric user: ${user}`);
  }
  const project = assertBindSource(projectRoot, "Release smoke project path");
  const runner = assertBindSource(runnerPath, "Release smoke runner path");

  return [
    "run",
    "--rm",
    "--init",
    "--network",
    "none",
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--pids-limit",
    "256",
    "--memory",
    "2g",
    "--cpus",
    "2",
    "--user",
    user,
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,nodev,size=256m",
    "--mount",
    `type=bind,source=${project},target=/project`,
    "--mount",
    `type=bind,source=${runner},target=/harness/isolated-build.mjs,readonly`,
    "--workdir",
    "/project",
    "--env",
    "CI=true",
    "--env",
    "FORCE_COLOR=0",
    "--env",
    "HOME=/tmp/home",
    "--env",
    "npm_config_audit=false",
    "--env",
    "npm_config_cache=/tmp/npm-cache",
    "--env",
    "npm_config_fund=false",
    "--env",
    "npm_config_offline=true",
    image,
    "node",
    "/harness/isolated-build.mjs",
  ];
};

export const parseIsolatedBuildReceipt = (output) => {
  const line = output
    .split(/\r?\n/u)
    .findLast((candidate) => candidate.startsWith(ISOLATED_BUILD_RECEIPT_PREFIX));
  if (line === undefined) {
    throw new Error("The isolated release smoke build did not return a receipt.");
  }
  const receipt = JSON.parse(line.slice(ISOLATED_BUILD_RECEIPT_PREFIX.length));
  if (
    typeof receipt !== "object" ||
    receipt === null ||
    typeof receipt.context !== "object" ||
    typeof receipt.check !== "object" ||
    typeof receipt.build !== "object"
  ) {
    throw new Error("The isolated release smoke build returned an invalid receipt.");
  }
  return receipt;
};

export class ReleaseSmokeAuthoringFailure extends Error {
  constructor(evidence) {
    super(
      `Generated presentation failed isolated Drever validation: ${
        typeof evidence?.message === "string" && evidence.message !== ""
          ? evidence.message
          : "unknown authoring failure"
      }`,
    );
    this.name = "ReleaseSmokeAuthoringFailure";
    this.evidence = evidence;
  }
}

export const parseIsolatedBuildAuthoringFailure = (output) => {
  const line = output
    .split(/\r?\n/u)
    .findLast((candidate) => candidate.startsWith(ISOLATED_BUILD_AUTHORING_FAILURE_PREFIX));
  if (line === undefined) return undefined;
  const evidence = JSON.parse(line.slice(ISOLATED_BUILD_AUTHORING_FAILURE_PREFIX.length));
  if (typeof evidence !== "object" || evidence === null || typeof evidence.message !== "string") {
    throw new Error("The isolated release smoke build returned invalid authoring diagnostics.");
  }
  return evidence;
};

export const runReleaseSmokeBuildInContainer = async ({ projectRoot, runnerPath }) => {
  const arguments_ = createReleaseSmokeContainerArguments({ projectRoot, runnerPath });
  try {
    const { stdout } = await execute("docker", arguments_, {
      env: {
        PATH: process.env.PATH,
      },
      maxBuffer: 20 * 1024 * 1024,
      timeout: 360_000,
    });
    return parseIsolatedBuildReceipt(stdout);
  } catch (error) {
    if (error instanceof Error && "stdout" in error && typeof error.stdout === "string") {
      const evidence = parseIsolatedBuildAuthoringFailure(error.stdout);
      if (evidence !== undefined) throw new ReleaseSmokeAuthoringFailure(evidence);
      process.stdout.write(error.stdout);
    }
    throw error;
  }
};

export const resolveIsolatedProjectPath = (projectRoot, containerPath) => {
  if (typeof containerPath !== "string" || !isAbsolute(containerPath)) {
    throw new Error("The isolated build returned a non-absolute website path.");
  }
  const relativePath = posix.relative("/project", containerPath);
  if (relativePath === ".." || relativePath.startsWith("../") || posix.isAbsolute(relativePath)) {
    throw new Error(`The isolated build returned a path outside /project: ${containerPath}`);
  }
  return resolve(projectRoot, ...relativePath.split("/"));
};

export const assertSafeReleaseSmokeBuildOutput = async (directory) => {
  const root = resolve(directory);
  let bytes = 0;
  let files = 0;

  const walk = async (path) => {
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink()) {
      throw new Error(`Release smoke build output cannot contain a symlink: ${path}`);
    }
    if (metadata.isDirectory()) {
      for (const entry of await readdir(path)) await walk(resolve(path, entry));
      return;
    }
    if (!metadata.isFile()) {
      throw new Error(`Release smoke build output must contain regular files only: ${path}`);
    }
    files += 1;
    bytes += metadata.size;
    if (files > MAX_BUILD_FILES) {
      throw new Error(`Release smoke build output exceeds the ${MAX_BUILD_FILES} file limit.`);
    }
    if (bytes > MAX_BUILD_BYTES) {
      throw new Error(`Release smoke build output exceeds the ${MAX_BUILD_BYTES} byte limit.`);
    }
  };

  await walk(root);
  return Object.freeze({ bytes, files });
};

import { execFile, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { readPublicPackages } from "./release.mjs";

const execute = promisify(execFile);
const defaultRoot = fileURLToPath(new URL("../", import.meta.url));
const registry = "https://registry.npmjs.org";
const minimumNpmVersion = [11, 15, 0];

export const trustedPublisher = {
  type: "github",
  repository: "Zhangdroid/drever",
  file: "publish.yml",
  environment: "npm",
  permissions: ["createPackage"],
};

const wait = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

export function parseTrustList(stdout, packageName) {
  const output = stdout.trim();
  if (output === "") return [];
  let value;
  try {
    value = JSON.parse(output);
  } catch (error) {
    throw new Error(`npm returned invalid trust JSON for ${packageName}.`, { cause: error });
  }
  return Array.isArray(value) ? value : [value];
}

export function isExpectedTrust(configuration) {
  const permissions = [...(configuration.permissions ?? [])].sort((left, right) =>
    left.localeCompare(right),
  );
  return (
    configuration.type === trustedPublisher.type &&
    configuration.repository === trustedPublisher.repository &&
    configuration.file === trustedPublisher.file &&
    configuration.environment === trustedPublisher.environment &&
    permissions.length === trustedPublisher.permissions.length &&
    permissions.every((permission, index) => permission === trustedPublisher.permissions[index])
  );
}

const assertNpmVersion = (version) => {
  const values = version.trim().split(".").map(Number);
  if (values.length < 3 || values.some(Number.isNaN)) {
    throw new Error("Trusted publishing setup requires npm 11.15.0 or newer.");
  }
  for (const [index, minimum] of minimumNpmVersion.entries()) {
    if (values[index] > minimum) return;
    if (values[index] < minimum) {
      throw new Error("Trusted publishing setup requires npm 11.15.0 or newer.");
    }
  }
};

const formatConflict = (packageName, configurations) =>
  `${packageName} already has a different trusted publisher:\n${JSON.stringify(configurations, null, 2)}\n` +
  "Review it manually. This script will not revoke or replace trust policies.";

export async function configureTrustedPublishing({
  packageNames,
  run,
  sleep = wait,
  delay = 2_000,
  verifyOnly = false,
  output = process.stdout,
}) {
  const configurations = new Map();

  // Inspect every package before making any changes. A conflict therefore causes
  // a clean stop rather than a partially replaced set of policies.
  for (const packageName of packageNames) {
    const result = await run(["trust", "list", packageName, "--json", `--registry=${registry}`]);
    configurations.set(packageName, parseTrustList(result.stdout, packageName));
    await sleep(delay);
  }

  for (const [packageName, values] of configurations) {
    if (values.length > 1 || (values.length === 1 && !isExpectedTrust(values[0]))) {
      throw new Error(formatConflict(packageName, values));
    }
  }

  const missing = packageNames.filter(
    (packageName) => configurations.get(packageName).length === 0,
  );
  if (verifyOnly && missing.length > 0) {
    throw new Error(`Missing trusted publishers for: ${missing.join(", ")}.`);
  }

  const created = [];
  for (const packageName of missing) {
    await run([
      "trust",
      "github",
      packageName,
      `--repo=${trustedPublisher.repository}`,
      `--file=${trustedPublisher.file}`,
      `--env=${trustedPublisher.environment}`,
      "--allow-publish",
      "--yes",
      `--registry=${registry}`,
    ]);
    created.push(packageName);
    output.write(`Configured trusted publishing for ${packageName}.\n`);
    await sleep(delay);
  }

  // Re-read all policies so success means the registry, not only the POST
  // response, contains the complete expected configuration.
  for (const packageName of packageNames) {
    const result = await run(["trust", "list", packageName, "--json", `--registry=${registry}`]);
    const values = parseTrustList(result.stdout, packageName);
    if (values.length !== 1 || !isExpectedTrust(values[0])) {
      throw new Error(`Trusted publisher verification failed for ${packageName}.`);
    }
    await sleep(delay);
  }

  return {
    created,
    unchanged: packageNames.filter((packageName) => !created.includes(packageName)),
  };
}

const runInteractive = (arguments_, options) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn("npm", arguments_, { ...options, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else
        reject(
          new Error(`npm exited with ${signal === null ? `code ${code}` : `signal ${signal}`}.`),
        );
    });
  });

export async function main(arguments_ = process.argv.slice(2)) {
  if (arguments_.some((value) => value !== "--verify-only")) {
    throw new Error("Usage: node scripts/configure-trusted-publishing.mjs [--verify-only]");
  }
  if (process.env.NPM_TOKEN || process.env.NODE_AUTH_TOKEN) {
    throw new Error(
      "Do not pass NPM_TOKEN or NODE_AUTH_TOKEN. npm trust requires an interactive login session with 2FA.",
    );
  }

  const temporaryRoot = await mkdtemp(join(tmpdir(), "drever-npm-trust-"));
  const environment = {
    ...process.env,
    FORCE_COLOR: "0",
  };
  try {
    const version = await execute("npm", ["--version"], { cwd: temporaryRoot, env: environment });
    assertNpmVersion(version.stdout);
    const packageNames = (await readPublicPackages(defaultRoot))
      .map(({ manifest }) => manifest.name)
      .sort((left, right) => left.localeCompare(right));

    process.stdout.write(
      "npm will request 2FA in the browser. Select the option to skip additional 2FA checks for five minutes.\n",
    );
    await runInteractive(["trust", "list", packageNames[0], `--registry=${registry}`], {
      cwd: temporaryRoot,
      env: environment,
    });

    const result = await configureTrustedPublishing({
      packageNames,
      verifyOnly: arguments_.includes("--verify-only"),
      run: (npmArguments) =>
        execute("npm", npmArguments, {
          cwd: temporaryRoot,
          env: environment,
          maxBuffer: 10 * 1024 * 1024,
        }),
    });
    process.stdout.write(
      `Trusted publishing verified for ${packageNames.length} packages (${result.created.length} created, ${result.unchanged.length} unchanged).\n`,
    );
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await main();
}

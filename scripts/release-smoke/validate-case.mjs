import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_CAPTURE_BYTES = 12 * 1024;
const MAX_DIAGNOSTIC_BYTES = 8 * 1024;
const MAX_RECEIPT_BYTES = 200 * 1024;
const repairableFailurePrefix = "drever-release-smoke-repairable:";
const repairableFailurePattern = /^drever-release-smoke-repairable:[^\r\n]*(?:\r?\n|$)/gmu;
const secretPatterns = [
  /\b(?:sk|sess)-[A-Za-z0-9_-]{16,}\b/gu,
  /\bnpm_[A-Za-z0-9]{16,}\b/gu,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{16,}\b/gu,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/giu,
];
const ansiPattern = new RegExp(
  `${String.fromCodePoint(0x1b)}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`,
  "gu",
);
const stripControlCharacters = (value) =>
  [...value]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return (
        (codePoint > 31 || codePoint === 9 || codePoint === 10 || codePoint === 13) &&
        codePoint !== 127
      );
    })
    .join("");
const usage =
  "Usage: node scripts/release-smoke/validate-case.mjs <version> <provider> <scenario> <run-id> <source-commit> <generation-artifact> <output>";

const arguments_ = process.argv.slice(2);
if (arguments_.length !== 7 || arguments_.some((argument) => argument === "")) {
  throw new Error(usage);
}

const [version, providerId, scenarioId, runId, sourceCommit, projectArgument, outputArgument] =
  arguments_;
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/u.test(version)) {
  throw new Error(`Invalid release version: ${version}`);
}
if (!/^[a-z0-9][a-z0-9-]*$/u.test(providerId)) {
  throw new Error(`Invalid release smoke provider id: ${providerId}`);
}
if (!/^[a-z0-9][a-z0-9-]*$/u.test(scenarioId)) {
  throw new Error(`Invalid release smoke scenario id: ${scenarioId}`);
}
if (!/^\d+$/u.test(runId)) throw new Error(`Invalid GitHub Actions run id: ${runId}`);
if (!/^[0-9a-f]{40}$/u.test(sourceCommit)) {
  throw new Error(`Invalid release source commit: ${sourceCommit}`);
}

const projectRoot = resolve(projectArgument);
const outputRoot = resolve(outputArgument);
if (projectRoot === outputRoot) {
  throw new Error("Release smoke project and output roots must be separate.");
}

const createCapture = () => {
  let bytes = Buffer.alloc(0);
  let truncated = false;
  return {
    append(chunk) {
      const next = Buffer.concat([bytes, chunk]);
      if (next.length > MAX_CAPTURE_BYTES) {
        truncated = true;
        bytes = next.subarray(next.length - MAX_CAPTURE_BYTES);
      } else {
        bytes = next;
      }
    },
    text() {
      return `${truncated ? "[earlier output truncated]\n" : ""}${bytes.toString("utf8")}`.trim();
    },
  };
};

const runBuildCase = () =>
  new Promise((resolvePromise, rejectPromise) => {
    const stdout = createCapture();
    const stderr = createCapture();
    const child = spawn(
      process.execPath,
      [
        fileURLToPath(new URL("./build-case.mjs", import.meta.url)),
        version,
        providerId,
        scenarioId,
        runId,
        sourceCommit,
        projectRoot,
        outputRoot,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    child.stdout.on("data", (chunk) => stdout.append(chunk));
    child.stderr.on("data", (chunk) => stderr.append(chunk));
    child.once("error", rejectPromise);
    child.once("close", (exitCode, signal) => {
      resolvePromise({ exitCode, signal, stderr: stderr.text(), stdout: stdout.text() });
    });
  });

const sanitize = (value) => {
  let sanitized = stripControlCharacters(value.replaceAll(ansiPattern, ""))
    .replaceAll(projectRoot, "<project>")
    .replaceAll(outputRoot, "<output>")
    .replaceAll(repairableFailurePattern, "");
  for (const pattern of secretPatterns) sanitized = sanitized.replaceAll(pattern, "[redacted]");
  return sanitized;
};

const boundedDiagnostic = (stdout, stderr) => {
  const evidence = [
    ...(stdout === "" ? [] : [`stdout:\n${stdout}`]),
    ...(stderr === "" ? [] : [`stderr:\n${stderr}`]),
  ].join("\n\n");
  if (evidence === "") return "The keyless validation process failed without diagnostic output.";
  const bytes = Buffer.from(evidence);
  if (bytes.length <= MAX_DIAGNOSTIC_BYTES) return evidence;
  return `[earlier diagnostic output truncated]\n${bytes
    .subarray(bytes.length - MAX_DIAGNOSTIC_BYTES)
    .toString("utf8")}`;
};

const result = await runBuildCase();
if (result.signal !== null) {
  throw new Error(`Release smoke validation terminated by signal ${result.signal}.`);
}
if (result.exitCode === null) {
  throw new Error("Release smoke validation ended without an exit code.");
}
const stdout = sanitize(result.stdout);
const stderr = sanitize(result.stderr);
const passed = result.exitCode === 0;
const repairable =
  !passed && `${result.stdout}\n${result.stderr}`.includes(repairableFailurePrefix);

if (!passed && !repairable) {
  if (stdout !== "") process.stdout.write(`${stdout}\n`);
  if (stderr !== "") process.stderr.write(`${stderr}\n`);
  process.exitCode = result.exitCode;
} else {
  const receipt = {
    schemaVersion: 1,
    version,
    providerId,
    scenarioId,
    runId,
    sourceCommit,
    status: passed ? "passed" : "repairable-failure",
    exitCode: result.exitCode,
    signal: result.signal,
    summary: {
      errors: passed ? 0 : 1,
      warnings: 0,
    },
    diagnostics: passed
      ? []
      : [
          {
            code: "RELEASE_SMOKE_VALIDATION_FAILED",
            severity: "error",
            message: boundedDiagnostic(stdout, stderr),
          },
        ],
    stdout,
    stderr,
  };
  const serializedReceipt = `${JSON.stringify(receipt, null, 2)}\n`;
  if (Buffer.byteLength(serializedReceipt) > MAX_RECEIPT_BYTES) {
    throw new Error("Release smoke validation receipt exceeds the 200 kB limit.");
  }

  await mkdir(outputRoot, { recursive: true });
  await writeFile(resolve(outputRoot, "validation.json"), serializedReceipt, "utf8");

  if (receipt.stdout !== "") process.stdout.write(`${receipt.stdout}\n`);
  if (receipt.stderr !== "") process.stderr.write(`${receipt.stderr}\n`);
  process.stdout.write(`Release smoke validation: ${receipt.status}\n`);
}

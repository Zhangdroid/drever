import { lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const [validationArgument, version, providerId, scenarioId, runId, sourceCommit] =
  process.argv.slice(2);
if (
  validationArgument === undefined ||
  version === undefined ||
  providerId === undefined ||
  scenarioId === undefined ||
  runId === undefined ||
  sourceCommit === undefined
) {
  throw new Error(
    "Usage: node scripts/release-smoke/read-validation-status.mjs <validation-json> <version> <provider> <scenario> <run-id> <source-commit>",
  );
}

const validationPath = resolve(validationArgument);
const metadata = await lstat(validationPath);
if (!metadata.isFile() || metadata.size === 0 || metadata.size > 256_000) {
  throw new Error("Release smoke validation must be a regular JSON file no larger than 256 kB.");
}

const validation = JSON.parse(await readFile(validationPath, "utf8"));
const validVisualEvidence =
  typeof validation?.visualEvidence === "object" &&
  validation.visualEvidence !== null &&
  /^[0-9a-f]{64}$/u.test(validation.visualEvidence.contactSheets?.settled?.sha256 ?? "") &&
  /^[0-9a-f]{64}$/u.test(validation.visualEvidence.contactSheets?.transitions?.sha256 ?? "") &&
  Array.isArray(validation.visualEvidence.attachments) &&
  validation.visualEvidence.attachments.length === 2 &&
  validation.visualEvidence.attachments[0] === "settled-contact-sheet.png" &&
  validation.visualEvidence.attachments[1] === "transition-contact-sheet.png";
if (
  validation?.schemaVersion !== 1 ||
  validation.version !== version ||
  validation.providerId !== providerId ||
  validation.scenarioId !== scenarioId ||
  validation.runId !== runId ||
  validation.sourceCommit !== sourceCommit ||
  !/^[0-9a-f]{64}$/u.test(validation.sourceSha256 ?? "") ||
  !["review-required", "repairable-failure"].includes(validation.status) ||
  !Array.isArray(validation.diagnostics) ||
  (validation.status === "review-required" &&
    (validation.diagnostics.length !== 0 || !validVisualEvidence)) ||
  (validation.status === "repairable-failure" &&
    (validation.diagnostics.length === 0 ||
      validation.diagnostics.length > 50 ||
      (validation.visualEvidence !== null && !validVisualEvidence) ||
      validation.diagnostics.some(
        (diagnostic) =>
          typeof diagnostic !== "object" ||
          diagnostic === null ||
          Array.isArray(diagnostic) ||
          typeof diagnostic.message !== "string" ||
          diagnostic.message.trim() === "",
      )))
) {
  throw new Error("Release smoke validation has an invalid status contract.");
}

process.stdout.write(validation.status);

import { lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const [
  generationArgument,
  validationArgument,
  version,
  providerId,
  scenarioId,
  runId,
  sourceCommit,
] = process.argv.slice(2);
if (
  generationArgument === undefined ||
  validationArgument === undefined ||
  version === undefined ||
  providerId === undefined ||
  scenarioId === undefined ||
  runId === undefined ||
  sourceCommit === undefined
) {
  throw new Error(
    "Usage: node scripts/release-smoke/read-review-stage.mjs <generation-json> <validation-json> <version> <provider> <scenario> <run-id> <source-commit>",
  );
}

const readBoundedJson = async (argument, label, maxBytes) => {
  const path = resolve(argument);
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.size === 0 || metadata.size > maxBytes) {
    throw new Error(`Release smoke ${label} must be a bounded regular JSON file.`);
  }
  return JSON.parse(await readFile(path, "utf8"));
};

const [generation, validation] = await Promise.all([
  readBoundedJson(generationArgument, "generation", 1_000_000),
  readBoundedJson(validationArgument, "review validation", 256_000),
]);
if (
  generation?.schemaVersion !== 1 ||
  generation.version !== version ||
  generation.provider?.id !== providerId ||
  generation.scenarioId !== scenarioId ||
  validation?.schemaVersion !== 1 ||
  validation.version !== version ||
  validation.providerId !== providerId ||
  validation.scenarioId !== scenarioId ||
  validation.runId !== runId ||
  validation.sourceCommit !== sourceCommit ||
  !/^[0-9a-f]{64}$/u.test(validation.sourceSha256 ?? "") ||
  !/^[0-9a-f]{64}$/u.test(generation.source?.sha256 ?? "") ||
  validation.sourceSha256 !== generation.source.sha256 ||
  !["review-required", "repairable-failure"].includes(validation.status) ||
  !Array.isArray(validation.diagnostics) ||
  (validation.status === "review-required" && validation.diagnostics.length !== 0) ||
  (validation.status === "repairable-failure" &&
    (validation.diagnostics.length === 0 ||
      validation.diagnostics.length > 50 ||
      validation.diagnostics.some(
        (diagnostic) =>
          typeof diagnostic !== "object" ||
          diagnostic === null ||
          typeof diagnostic.message !== "string" ||
          diagnostic.message.trim() === "",
      ))) ||
  validation.visualEvidence?.attachments?.[0] !== "settled-contact-sheet.png" ||
  validation.visualEvidence?.attachments?.[1] !== "transition-contact-sheet.png" ||
  !/^[0-9a-f]{64}$/u.test(validation.visualEvidence?.contactSheets?.settled?.sha256 ?? "") ||
  !/^[0-9a-f]{64}$/u.test(validation.visualEvidence?.contactSheets?.transitions?.sha256 ?? "")
) {
  throw new Error(
    "Release smoke visual-review stage has an invalid binding or validation receipt.",
  );
}

const mechanicalHistoryValid =
  generation.repair === undefined ||
  (generation.repair?.kind === "mechanical-repair" &&
    generation.repair.visualEvidence === null &&
    /^[0-9a-f]{64}$/u.test(generation.repair.inputSourceSha256 ?? "") &&
    generation.repair.outputSourceSha256 === generation.visualReview?.evidenceSourceSha256);
const visualReviewComplete =
  generation.visualReview?.kind === "visual-review" &&
  mechanicalHistoryValid &&
  generation.visualReview.visualEvidence?.attachments === 2 &&
  /^[0-9a-f]{64}$/u.test(generation.visualReview.visualEvidence.settledContactSheetSha256 ?? "") &&
  /^[0-9a-f]{64}$/u.test(
    generation.visualReview.visualEvidence.transitionContactSheetSha256 ?? "",
  ) &&
  /^[0-9a-f]{64}$/u.test(generation.visualReview.evidenceSourceSha256 ?? "") &&
  generation.visualReview.outputSourceSha256 === generation.source.sha256;
const visualReviewRequired =
  generation.visualReview === undefined &&
  generation.repair?.kind === "mechanical-repair" &&
  generation.repair.visualEvidence === null &&
  /^[0-9a-f]{64}$/u.test(generation.repair.inputSourceSha256 ?? "") &&
  generation.repair.outputSourceSha256 === generation.source.sha256;
if (
  visualReviewComplete === visualReviewRequired ||
  (visualReviewComplete && validation.status !== "review-required")
) {
  throw new Error("Release smoke candidate has an invalid refinement history.");
}

process.stdout.write(visualReviewComplete ? "complete" : "required");

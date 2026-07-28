import { appendFile, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const [websiteArgument, resultsArgument, summaryArgument] = process.argv.slice(2);
if (
  websiteArgument === undefined ||
  resultsArgument === undefined ||
  summaryArgument === undefined
) {
  throw new Error("Usage: node disclose-recovered-run.mjs <website-root> <results-root> <summary>");
}

const websiteRoot = resolve(websiteArgument);
const resultsRoot = resolve(resultsArgument);
const sourceRunId = process.env.SOURCE_RUN_ID;
const recoveryRunId = process.env.GITHUB_RUN_ID;
if (sourceRunId === undefined || recoveryRunId === undefined) {
  throw new Error("SOURCE_RUN_ID and GITHUB_RUN_ID are required.");
}

const runPath = join(websiteRoot, "public", "release-smoke", "runs", sourceRunId, "run.json");
const recovery = JSON.parse(
  await readFile(join(resultsRoot, "claude-guided", "receipts", "recovery.json"), "utf8"),
);
const run = JSON.parse(await readFile(runPath, "utf8"));
run.recovery = {
  ...recovery,
  workflowUrl: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${recoveryRunId}`,
};
await Promise.all([
  writeFile(runPath, `${JSON.stringify(run, null, 2)}\n`, "utf8"),
  appendFile(
    resolve(summaryArgument),
    `\n> Recovery disclosure: Claude Guided failed only because slides 4 and 12 shared a heading. Slide 12 was renamed and rebuilt without invoking either AI provider. Original generation run: ${sourceRunId}; recovery run: ${recoveryRunId}.\n`,
    "utf8",
  ),
]);

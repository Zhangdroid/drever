import { readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const [generationArgument] = process.argv.slice(2);
if (generationArgument === undefined) {
  throw new Error("Usage: node recover-generated-title.mjs <generation-artifact>");
}

const generationRoot = resolve(generationArgument);
const slidesPath = join(generationRoot, "source", "slides.mdx");
const generationPath = join(generationRoot, "generation.json");
const before = "# Same mass, same distance, same pull";
const after = "# Keep the rule. Lose the myth.";
const source = await readFile(slidesPath, "utf8");
const lines = source.split(/\r?\n/u);
const matches = lines.map((line, index) => ({ index, line })).filter(({ line }) => line === before);

if (matches.length !== 1) {
  throw new Error(`Expected one duplicate closing H1, found ${String(matches.length)}.`);
}

const match = matches[0];
if (match === undefined) throw new Error("The duplicate closing H1 was not found.");
const slide = lines.slice(0, match.index).filter((line) => line === "---").length + 1;
if (slide !== 12) {
  throw new Error(`Expected the repaired heading on slide 12, found slide ${String(slide)}.`);
}

lines[match.index] = after;
await writeFile(slidesPath, lines.join("\n"), "utf8");

const generation = JSON.parse(await readFile(generationPath, "utf8"));
const originalSourceBytes = generation.source.bytes;
const repairedSourceBytes = (
  await Promise.all(
    generation.source.files.map((file) => stat(join(generationRoot, "source", file))),
  )
).reduce((total, file) => total + file.size, 0);
const recovery = {
  schemaVersion: 1,
  kind: "maintainer-source-repair",
  sourceRunId: process.env.SOURCE_RUN_ID,
  recoveryRunId: process.env.GITHUB_RUN_ID,
  recoveryWorkflowCommit: process.env.GITHUB_SHA,
  providerId: "claude",
  scenarioId: "guided",
  diagnosticCode: "DREVER_A11Y_SLIDE_TITLE_DUPLICATE",
  file: "source/slides.mdx",
  slide,
  before,
  after,
  modelInvoked: false,
  originalSourceBytes,
  repairedSourceBytes,
  repairedAt: new Date().toISOString(),
};

generation.source.bytes = repairedSourceBytes;
generation.repair = recovery;
await Promise.all([
  writeFile(generationPath, `${JSON.stringify(generation, null, 2)}\n`, "utf8"),
  writeFile(
    join(generationRoot, "recovery.json"),
    `${JSON.stringify(recovery, null, 2)}\n`,
    "utf8",
  ),
]);

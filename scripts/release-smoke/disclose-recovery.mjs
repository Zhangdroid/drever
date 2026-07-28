import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const [generationArgument, caseArgument] = process.argv.slice(2);
if (generationArgument === undefined || caseArgument === undefined) {
  throw new Error("Usage: node disclose-recovery.mjs <generation-artifact> <case-root>");
}

const generationRoot = resolve(generationArgument);
const caseRoot = resolve(caseArgument);
const recovery = JSON.parse(await readFile(join(generationRoot, "recovery.json"), "utf8"));
const casePath = join(caseRoot, "case.json");
const result = JSON.parse(await readFile(casePath, "utf8"));

result.repair = recovery;
result.checks.push(
  "Maintainer repaired slide 12 after generation: “Same mass, same distance, same pull” → “Keep the rule. Lose the myth.” No AI provider was invoked.",
);
await mkdir(join(caseRoot, "receipts"), { recursive: true });
await Promise.all([
  copyFile(join(generationRoot, "recovery.json"), join(caseRoot, "receipts", "recovery.json")),
  writeFile(casePath, `${JSON.stringify(result, null, 2)}\n`, "utf8"),
]);

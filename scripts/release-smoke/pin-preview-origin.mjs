import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const [repositoryArgument, runId, previewBranch, deploymentOrigin, bodyArgument] =
  process.argv.slice(2);
if (
  repositoryArgument === undefined ||
  runId === undefined ||
  previewBranch === undefined ||
  deploymentOrigin === undefined ||
  bodyArgument === undefined
) {
  throw new Error(
    "Usage: node scripts/release-smoke/pin-preview-origin.mjs <repository-root> <run-id> <preview-branch> <deployment-origin> <pr-body>",
  );
}
if (!/^\d+$/u.test(runId)) throw new Error(`Invalid GitHub Actions run id: ${runId}`);
if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(previewBranch)) {
  throw new Error(`Invalid preview branch: ${previewBranch}`);
}

const previewAlias = previewBranch
  .toLowerCase()
  .replaceAll(/[^a-z0-9-]+/gu, "-")
  .replaceAll(/^-+|-+$/gu, "");
if (previewAlias === "") throw new Error(`Invalid preview branch alias: ${previewBranch}`);
const branchOrigin = `https://${previewAlias}.drever-website.pages.dev`;
const immutableOrigin = new URL(deploymentOrigin);
if (
  immutableOrigin.protocol !== "https:" ||
  !/^[0-9a-f]{8}\.drever-website\.pages\.dev$/u.test(immutableOrigin.hostname) ||
  immutableOrigin.username !== "" ||
  immutableOrigin.password !== "" ||
  immutableOrigin.port !== "" ||
  immutableOrigin.pathname !== "/" ||
  immutableOrigin.search !== "" ||
  immutableOrigin.hash !== ""
) {
  throw new Error(`Invalid immutable Cloudflare Pages origin: ${deploymentOrigin}`);
}

const repositoryRoot = resolve(repositoryArgument);
const bodyPath = resolve(bodyArgument);
const contentRunPath = join(
  repositoryRoot,
  "website",
  "content",
  "release-smoke",
  "runs",
  `${runId}.json`,
);
const publicRunRoot = join(repositoryRoot, "website", "public", "release-smoke", "runs", runId);
const run = JSON.parse(await readFile(contentRunPath, "utf8"));
const caseIds = run.cases.map(({ id }) => {
  if (typeof id !== "string" || !/^[a-z0-9][a-z0-9-]*$/u.test(id)) {
    throw new Error(`Invalid release smoke case id: ${String(id)}`);
  }
  return id;
});
const paths = [
  contentRunPath,
  join(publicRunRoot, "run.json"),
  ...caseIds.map((id) => join(publicRunRoot, id, "case.json")),
  bodyPath,
];

for (const path of paths) {
  const source = await readFile(path, "utf8");
  const matches = source.split(branchOrigin).length - 1;
  const alreadyPinned = source.includes(immutableOrigin.origin);
  if (matches > 0 && alreadyPinned) {
    throw new Error(`Release smoke output mixes branch and immutable origins: ${path}`);
  }
  if (matches === 0 && !alreadyPinned) {
    throw new Error(`Release smoke output does not contain a preview origin: ${path}`);
  }
  await writeFile(path, source.replaceAll(branchOrigin, immutableOrigin.origin), "utf8");
}

process.stdout.write(`${immutableOrigin.origin}\n`);

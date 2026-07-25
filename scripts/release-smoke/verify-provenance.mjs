import { pathToFileURL } from "node:url";
import { assertReleaseVersion } from "../release.mjs";
import { json } from "./contract.mjs";

const GITHUB_JSON = "application/vnd.github+json";

export const requestJson = async (url, { accept = "application/json", token } = {}) => {
  const response = await fetch(url, {
    headers: {
      accept,
      ...(token === undefined || token === "" ? {} : { authorization: `Bearer ${token}` }),
      "user-agent": "drever-release-smoke",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Release provenance request failed: ${response.status} ${url}`);
  }
  return response.json();
};

const resolveTagCommit = async ({ repository, tag, token }) => {
  const reference = await requestJson(
    `https://api.github.com/repos/${repository}/git/ref/tags/${encodeURIComponent(tag)}`,
    { accept: GITHUB_JSON, token },
  );
  let object = reference.object;
  for (let depth = 0; depth < 4 && object?.type === "tag"; depth += 1) {
    const annotatedTag = await requestJson(
      `https://api.github.com/repos/${repository}/git/tags/${object.sha}`,
      { accept: GITHUB_JSON, token },
    );
    object = annotatedTag.object;
  }
  if (object?.type !== "commit" || !/^[0-9a-f]{40}$/u.test(object.sha)) {
    throw new Error(`Git tag ${tag} does not resolve to a commit.`);
  }
  return object.sha;
};

export const assertReleaseSmokeProvenance = ({
  npmPackage,
  release,
  repository,
  sourceCommit,
  tagCommit,
  version,
  workflowRef,
}) => {
  assertReleaseVersion(version);
  if (workflowRef !== "refs/heads/main") {
    throw new Error(`AI release smoke must be dispatched from refs/heads/main: ${workflowRef}`);
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) {
    throw new Error(`Invalid GitHub repository: ${repository}`);
  }
  if (!/^[0-9a-f]{40}$/u.test(sourceCommit)) {
    throw new Error(`Invalid release source commit: ${sourceCommit}`);
  }
  const npmGitHead = npmPackage?.gitHead;
  const hasNpmGitHead = typeof npmGitHead === "string" && npmGitHead !== "";
  const hasInvalidNpmGitHead =
    npmGitHead !== undefined && npmGitHead !== null && typeof npmGitHead !== "string";
  if (
    npmPackage?.name !== "drever" ||
    npmPackage.version !== version ||
    hasInvalidNpmGitHead ||
    (hasNpmGitHead && npmGitHead !== sourceCommit)
  ) {
    throw new Error(`npm drever@${version} does not match release source ${sourceCommit}.`);
  }
  if (
    release?.tag_name !== `v${version}` ||
    release.target_commitish !== sourceCommit ||
    tagCommit !== sourceCommit
  ) {
    throw new Error(`GitHub release v${version} does not match release source ${sourceCommit}.`);
  }
  return {
    npm: `drever@${version}`,
    release: release.html_url,
    repository,
    sourceCommit,
    tag: `v${version}`,
    workflowRef,
  };
};

export const verifyReleaseSmokeProvenance = async ({
  repository,
  sourceCommit,
  token,
  version,
  workflowRef,
}) => {
  const tag = `v${version}`;
  const [npmPackage, release, tagCommit] = await Promise.all([
    requestJson(`https://registry.npmjs.org/drever/${encodeURIComponent(version)}`),
    requestJson(`https://api.github.com/repos/${repository}/releases/tags/${tag}`, {
      accept: GITHUB_JSON,
      token,
    }),
    resolveTagCommit({ repository, tag, token }),
  ]);
  return assertReleaseSmokeProvenance({
    npmPackage,
    release,
    repository,
    sourceCommit,
    tagCommit,
    version,
    workflowRef,
  });
};

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [version, sourceCommit, repository, workflowRef] = process.argv.slice(2);
  if (
    version === undefined ||
    sourceCommit === undefined ||
    repository === undefined ||
    workflowRef === undefined
  ) {
    throw new Error(
      "Usage: node scripts/release-smoke/verify-provenance.mjs <version> <source-commit> <repository> <workflow-ref>",
    );
  }
  const receipt = await verifyReleaseSmokeProvenance({
    repository,
    sourceCommit,
    token: process.env.GH_TOKEN,
    version,
    workflowRef,
  });
  process.stdout.write(json(receipt));
}

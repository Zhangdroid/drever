import { fileURLToPath } from "node:url";

const sectionStart = "<!-- drever-release-smoke:start -->";
const sectionEnd = "<!-- drever-release-smoke:end -->";

export const releaseSmokeSection = (reportOrigin, workflowUrl) => {
  const report = new URL(reportOrigin);
  const workflow = new URL(workflowUrl);
  if (
    report.protocol !== "https:" ||
    !/^[0-9a-f]{8}\.drever-release-smoke\.pages\.dev$/u.test(report.hostname) ||
    report.pathname !== "/" ||
    report.search !== "" ||
    report.hash !== ""
  ) {
    throw new Error(`Invalid immutable release smoke origin: ${reportOrigin}`);
  }
  if (workflow.protocol !== "https:" || workflow.hostname !== "github.com") {
    throw new Error(`Invalid release smoke workflow URL: ${workflowUrl}`);
  }
  return `${sectionStart}
### AI release smoke

[Inspect the real Codex conversations and generated decks](${report.origin}/release-smoke/) · [Workflow run](${workflow.href})
${sectionEnd}`;
};

export const upsertReleaseSmokeSection = (body, section) => {
  const pattern = new RegExp(
    `${sectionStart.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&")}[\\s\\S]*?${sectionEnd.replaceAll(
      /[.*+?^${}()|[\]\\]/gu,
      "\\$&",
    )}`,
    "u",
  );
  const withoutPrevious = body.replace(pattern, "").trimEnd();
  return `${withoutPrevious}${withoutPrevious === "" ? "" : "\n\n"}${section}\n`;
};

const githubJson = async (url, init = {}) => {
  const token = process.env.GH_TOKEN;
  if (token === undefined) throw new Error("GH_TOKEN is required to update the GitHub release.");
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "drever-release-smoke",
      "x-github-api-version": "2022-11-28",
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`GitHub release request returned HTTP ${response.status}.`);
  return response.json();
};

const main = async () => {
  const [repository, version, reportOrigin, workflowUrl] = process.argv.slice(2);
  if (
    repository === undefined ||
    version === undefined ||
    reportOrigin === undefined ||
    workflowUrl === undefined
  ) {
    throw new Error(
      "Usage: node scripts/release-smoke/record-release-link.mjs <owner/repository> <version> <report-origin> <workflow-url>",
    );
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) {
    throw new Error(`Invalid GitHub repository: ${repository}`);
  }
  if (!/^[0-9A-Za-z.-]+$/u.test(version)) throw new Error(`Invalid release version: ${version}`);
  const release = await githubJson(
    `https://api.github.com/repos/${repository}/releases/tags/v${version}`,
  );
  if (typeof release.id !== "number" || typeof release.body !== "string") {
    throw new Error("GitHub returned an invalid release.");
  }
  const body = upsertReleaseSmokeSection(
    release.body,
    releaseSmokeSection(reportOrigin, workflowUrl),
  );
  await githubJson(`https://api.github.com/repos/${repository}/releases/${release.id}`, {
    body: JSON.stringify({ body }),
    method: "PATCH",
  });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();

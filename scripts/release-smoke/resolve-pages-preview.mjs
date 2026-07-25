import { fileURLToPath } from "node:url";

const pagesHost = "drever-website.pages.dev";

export const immutablePagesOrigin = (summary) => {
  const rows = [...summary.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/giu)].filter(({ 0: row }) =>
    /<strong>\s*Preview URL:\s*<\/strong>/iu.test(row),
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) throw new Error("Cloudflare Pages reported multiple preview URL rows.");
  const links = [...rows[0][0].matchAll(/<a\b[^>]*\bhref=(['"])(.*?)\1/giu)];
  if (links.length !== 1) {
    throw new Error("Cloudflare Pages preview URL row must contain exactly one link.");
  }
  const url = new URL(links[0][2]);
  if (
    url.protocol !== "https:" ||
    !new RegExp(`^[0-9a-f]{8}\\.${pagesHost.replaceAll(".", "\\.")}$`, "u").test(url.hostname) ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error(`Cloudflare Pages reported an invalid immutable preview URL: ${links[0][2]}`);
  }
  return url.origin;
};

const wait = (milliseconds) =>
  new Promise((resolveWait) => {
    setTimeout(resolveWait, milliseconds);
  });

export const resolvePagesPreview = async ({
  commit,
  fetchChecks,
  attempts = 90,
  intervalMilliseconds = 10_000,
}) => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const checks = await fetchChecks();
    const deployment = checks
      .filter(
        (check) =>
          check.name === "Cloudflare Pages" && check.app?.slug === "cloudflare-workers-and-pages",
      )
      .sort((left, right) => String(left.started_at).localeCompare(String(right.started_at)))
      .at(-1);

    if (deployment?.status === "completed" && deployment.conclusion === "success") {
      const origin = immutablePagesOrigin(deployment.output?.summary ?? "");
      if (origin === null) {
        throw new Error(`Cloudflare Pages did not report an immutable preview for ${commit}.`);
      }
      return origin;
    }
    if (deployment?.status === "completed") {
      throw new Error(
        `Cloudflare Pages completed ${commit} with conclusion ${String(deployment.conclusion)}.`,
      );
    }
    if (attempt < attempts) await wait(intervalMilliseconds);
  }
  throw new Error(`Timed out waiting for Cloudflare Pages to deploy ${commit}.`);
};

const main = async () => {
  const [repository, commit] = process.argv.slice(2);
  if (
    repository === undefined ||
    commit === undefined ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository) ||
    !/^[0-9a-f]{40}$/u.test(commit)
  ) {
    throw new Error(
      "Usage: node scripts/release-smoke/resolve-pages-preview.mjs <owner/repository> <commit>",
    );
  }
  const token = process.env.GH_TOKEN;
  if (token === undefined || token === "") throw new Error("GH_TOKEN is required.");

  const origin = await resolvePagesPreview({
    commit,
    fetchChecks: async () => {
      const response = await fetch(
        `https://api.github.com/repos/${repository}/commits/${commit}/check-runs`,
        {
          headers: {
            accept: "application/vnd.github+json",
            authorization: `Bearer ${token}`,
            "x-github-api-version": "2022-11-28",
          },
        },
      );
      if (!response.ok) {
        throw new Error(`GitHub checks request failed with ${response.status}.`);
      }
      const payload = await response.json();
      if (!Array.isArray(payload.check_runs)) {
        throw new Error("GitHub checks response has no check_runs array.");
      }
      return payload.check_runs;
    },
  });
  process.stdout.write(`${origin}\n`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();

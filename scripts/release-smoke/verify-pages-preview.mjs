import { fileURLToPath } from "node:url";

const exactOrigin = (value, context) => {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".drever-release-smoke.pages.dev") ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error(`${context} must be an isolated Cloudflare Pages origin.`);
  }
  return url.origin;
};

const transientStatus = (status) =>
  status === 404 || status === 408 || status === 425 || status === 429 || status >= 500;

const retryDelay = (attempt) => Math.min(1_000 * 2 ** attempt, 10_000);

const wait = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const fetchOk = async (fetchResource, url, context, { attempts, waitForRetry }) => {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let response;
    try {
      response = await fetchResource(url, {
        cache: "no-store",
        redirect: "error",
      });
    } catch (error) {
      lastError = error;
    }

    if (response !== undefined) {
      if (response.ok) return response;
      const error = new Error(`${context} returned HTTP ${response.status}.`);
      if (!transientStatus(response.status)) throw error;
      lastError = error;
    }

    if (attempt < attempts - 1) await waitForRetry(retryDelay(attempt));
  }
  throw new Error(`${context} remained unavailable after ${attempts} attempts.`, {
    cause: lastError,
  });
};

export const verifyPagesPreview = async ({
  origin,
  deckOrigin,
  artifactOrigin = deckOrigin,
  runId,
  version,
  releaseCommit,
  harnessCommit,
  fetchResource = fetch,
  fetchAttempts = 10,
  waitForRetry = wait,
}) => {
  const previewOrigin = exactOrigin(origin, "Preview origin");
  const expectedDeckOrigin = exactOrigin(deckOrigin, "Deck origin");
  const deployedArtifactOrigin = exactOrigin(artifactOrigin, "Artifact origin");
  const runPath = `/release-smoke/runs/${runId}/run.json`;
  const runResponse = await fetchOk(
    fetchResource,
    `${previewOrigin}${runPath}`,
    "Release smoke run",
    { attempts: fetchAttempts, waitForRetry },
  );
  const run = await runResponse.json();
  if (
    run.id !== runId ||
    run.release?.version !== version ||
    run.release?.commit !== releaseCommit ||
    run.harness?.commit !== harnessCommit ||
    !Array.isArray(run.cases) ||
    run.cases.length === 0
  ) {
    throw new Error("Cloudflare Pages preview does not match the release smoke provenance.");
  }

  await fetchOk(fetchResource, `${previewOrigin}/release-smoke/`, "Release smoke report", {
    attempts: fetchAttempts,
    waitForRetry,
  });
  for (const scenario of run.cases) {
    if (
      typeof scenario.id !== "string" ||
      !/^[a-z0-9][a-z0-9-]*$/u.test(scenario.id) ||
      scenario.deck === null ||
      typeof scenario.deck !== "object"
    ) {
      throw new Error("Cloudflare Pages preview contains an invalid release smoke case.");
    }
    const requiredPaths = {
      audience: `/release-smoke/runs/${runId}/${scenario.id}/deck/`,
      document: `/release-smoke/runs/${runId}/${scenario.id}/deck/document/`,
      source: `/release-smoke/runs/${runId}/${scenario.id}/source/slides.mdx`,
    };
    for (const [surface, path] of Object.entries(requiredPaths)) {
      const expected = `${expectedDeckOrigin}${path}`;
      if (scenario.deck[surface] !== expected) {
        throw new Error(
          `Cloudflare Pages preview has an unexpected ${scenario.id} ${surface} URL.`,
        );
      }
      await fetchOk(
        fetchResource,
        `${deployedArtifactOrigin}${path}`,
        `${scenario.id} ${surface}`,
        { attempts: fetchAttempts, waitForRetry },
      );
    }
  }
};

const main = async () => {
  const [origin, deckOrigin, runId, version, releaseCommit, harnessCommit, artifactOrigin] =
    process.argv.slice(2);
  if (
    origin === undefined ||
    deckOrigin === undefined ||
    runId === undefined ||
    version === undefined ||
    releaseCommit === undefined ||
    harnessCommit === undefined ||
    !/^\d+$/u.test(runId) ||
    !/^[0-9A-Za-z.-]+$/u.test(version) ||
    !/^[0-9a-f]{40}$/u.test(releaseCommit) ||
    !/^[0-9a-f]{40}$/u.test(harnessCommit)
  ) {
    throw new Error(
      "Usage: node scripts/release-smoke/verify-pages-preview.mjs <origin> <deck-origin> <run-id> <version> <release-commit> <harness-commit> [artifact-origin]",
    );
  }
  await verifyPagesPreview({
    origin,
    deckOrigin,
    artifactOrigin,
    runId,
    version,
    releaseCommit,
    harnessCommit,
  });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();

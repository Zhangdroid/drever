import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { cp, mkdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { assertReleaseVersion } from "../release.mjs";
import {
  assertSafeReleaseSmokeBuildOutput,
  ReleaseSmokeAuthoringFailure,
  resolveIsolatedProjectPath,
  runReleaseSmokeBuildInContainer,
} from "./build-isolation.mjs";
import {
  assertReleaseSmokeSourceReceipt,
  assertReleaseSmokeCheck,
  assertReleaseSmokeContext,
  collectReleaseSmokeSource,
  copyReleaseSmokeSource,
  json,
  redactStructuredPaths,
  relativeMountedPathname,
  releaseSmokeDeckMount,
  releaseSmokeVisualReviewProvenance,
  RELEASE_SMOKE_RUN_SCHEMA_VERSION,
  RELEASE_SMOKE_SCHEMA_VERSION,
  RELEASE_SMOKE_VISUAL_REVIEW_RECEIPT,
} from "./contract.mjs";
import {
  captureReleaseSmokeFrame,
  releaseSmokeAudienceStates,
  releaseSmokeStatePath,
  releaseSmokeTextSafeAreaIssues,
  releaseSmokeTransitionIssues,
} from "./browser-audit.mjs";
import { getReleaseSmokeScenario } from "./scenarios.mjs";
import { getReleaseSmokeProvider, releaseSmokeCaseId } from "./providers.mjs";

const execute = promisify(execFile);
const [version, providerId, scenarioId, runId, sourceCommit, generationArgument, outputArgument] =
  process.argv.slice(2);
if (
  version === undefined ||
  providerId === undefined ||
  scenarioId === undefined ||
  runId === undefined ||
  sourceCommit === undefined ||
  generationArgument === undefined ||
  outputArgument === undefined
) {
  throw new Error(
    "Usage: node scripts/release-smoke/build-case.mjs <version> <provider> <scenario> <run-id> <source-commit> <generation-artifact> <output>",
  );
}
assertReleaseVersion(version);
const provider = getReleaseSmokeProvider(providerId);
const scenario = getReleaseSmokeScenario(scenarioId);
const caseId = releaseSmokeCaseId(providerId, scenarioId);
if (!/^\d+$/u.test(runId)) throw new Error(`Invalid GitHub Actions run id: ${runId}`);
if (!/^[0-9a-f]{40}$/u.test(sourceCommit)) {
  throw new Error(`Invalid release source commit: ${sourceCommit}`);
}

const generationRoot = resolve(generationArgument);
const outputRoot = resolve(outputArgument);
const captureVisualEvidence = process.env.RELEASE_SMOKE_CAPTURE_VISUAL_EVIDENCE === "1";
const workspaceRoot = resolve(
  process.env.RUNNER_TEMP ?? join(outputRoot, ".workspace"),
  `drever-release-smoke-build-${caseId}`,
);
const projectRoot = join(workspaceRoot, "deck");
const validatedSourceRoot = join(workspaceRoot, "validated-source");
const npmCache = join(workspaceRoot, "npm-cache");
const caseRoot = join(outputRoot, caseId);
const receiptsRoot = join(caseRoot, "receipts");
const repairableFailurePrefix = "drever-release-smoke-repairable:";
const markRepairableFailure = (error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${repairableFailurePrefix}${JSON.stringify({ message })}\n`);
};
const parseJsonOutput = (output, command) => {
  const start = output.search(/^\{/mu);
  if (start === -1) throw new Error(`${command} did not return a JSON receipt.`);
  return JSON.parse(output.slice(start));
};
const run = async (command, arguments_, cwd = projectRoot, timeout = 300_000) => {
  try {
    return await execute(command, arguments_, {
      cwd,
      env: {
        ...process.env,
        CI: "true",
        FORCE_COLOR: "0",
        npm_config_audit: "false",
        npm_config_cache: npmCache,
        npm_config_fund: "false",
      },
      maxBuffer: 20 * 1024 * 1024,
      timeout,
    });
  } catch (error) {
    if (error instanceof Error && "stdout" in error && typeof error.stdout === "string") {
      process.stdout.write(error.stdout);
    }
    throw error;
  }
};

const visualEvidenceEntry = (path, content, details = {}) => ({
  ...details,
  bytes: content.length,
  path,
  sha256: createHash("sha256").update(content).digest("hex"),
});

const renderContactSheet = async (browser, captures, { columns, describe }) => {
  const sheet = await browser.newPage({ viewport: { height: 900, width: 1600 } });
  try {
    const figures = captures
      .map(
        (capture) => `<figure>
  <img alt="${describe(capture)}" src="data:image/png;base64,${capture.content.toString("base64")}" />
  <figcaption>${describe(capture)}</figcaption>
</figure>`,
      )
      .join("\n");
    await sheet.setContent(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; background: #101014; color: #f4f2ed; }
      body { font: 600 18px/1.3 ui-sans-serif, system-ui, sans-serif; padding: 32px; }
      main { display: grid; grid-template-columns: repeat(${String(columns)}, minmax(0, 1fr)); gap: 28px 24px; }
      figure { margin: 0; min-width: 0; }
      img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: contain; background: #050507; border: 1px solid #393941; }
      figcaption { padding-top: 10px; color: #cbc8d2; letter-spacing: 0.01em; }
    </style>
  </head>
  <body><main>${figures}</main></body>
</html>`);
    await sheet.waitForFunction(() => [...document.images].every((image) => image.complete));
    return await sheet.screenshot({ fullPage: true, type: "png" });
  } finally {
    await sheet.close();
  }
};

const writeVisualEvidence = async (
  browser,
  settledCaptures,
  transitionCaptures,
  evidenceRoot,
  sourceSha256,
) => {
  const [settledContactSheet, transitionContactSheet] = await Promise.all([
    renderContactSheet(browser, settledCaptures, {
      columns: 2,
      describe: ({ slide, step }) => `Slide ${String(slide)} · final settled Step ${String(step)}`,
    }),
    renderContactSheet(browser, transitionCaptures, {
      columns: 3,
      describe: ({ from, to }) => `80 ms transition · ${from} → ${to}`,
    }),
  ]);
  const settledContactSheetPath = "settled-contact-sheet.png";
  const transitionContactSheetPath = "transition-contact-sheet.png";
  await Promise.all([
    writeFile(join(evidenceRoot, settledContactSheetPath), settledContactSheet),
    writeFile(join(evidenceRoot, transitionContactSheetPath), transitionContactSheet),
  ]);
  const slides = settledCaptures.map(({ content, path, slide, step }) =>
    visualEvidenceEntry(path, content, { slide, step }),
  );
  const manifest = {
    schemaVersion: 1,
    sourceSha256,
    viewport: { height: 900, width: 1600 },
    contactSheets: {
      settled: visualEvidenceEntry(settledContactSheetPath, settledContactSheet),
      transitions: visualEvidenceEntry(transitionContactSheetPath, transitionContactSheet),
    },
    transitions: transitionCaptures.map(({ from, to }) => ({
      from,
      sampledAtMilliseconds: 80,
      to,
    })),
    slides,
    attachments: [settledContactSheetPath, transitionContactSheetPath],
    reviewImages: [
      settledContactSheetPath,
      transitionContactSheetPath,
      ...slides.map(({ path }) => path),
    ],
  };
  await writeFile(join(evidenceRoot, "manifest.json"), json(manifest), "utf8");
  return manifest;
};

const contentTypes = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
});
const fileExists = async (path) => {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
};
const startStaticServer = async (directory, mountPath) => {
  const root = await realpath(directory);
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
      const relativePath = relativeMountedPathname(pathname, mountPath);
      if (relativePath === undefined) {
        response.writeHead(404).end("Not found");
        return;
      }
      const candidate = resolve(root, `.${relativePath}`);
      if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
        response.writeHead(404).end("Not found");
        return;
      }
      const path = (await fileExists(candidate))
        ? candidate
        : (await fileExists(join(candidate, "index.html")))
          ? join(candidate, "index.html")
          : undefined;
      if (path === undefined) {
        response.writeHead(404).end("Not found");
        return;
      }
      const body = await readFile(path);
      response.writeHead(200, {
        "content-length": body.length,
        "content-type": contentTypes[extname(path)] ?? "application/octet-stream",
      });
      response.end(body);
    } catch {
      response.writeHead(500).end("Internal server error");
    }
  });
  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("Could not resolve the release smoke server address.");
  }
  return {
    close: () => new Promise((resolvePromise) => server.close(resolvePromise)),
    origin: `http://127.0.0.1:${String(address.port)}`,
  };
};

const runBrowserSmoke = async (distRoot, context, mountPath, evidenceRoot, sourceSha256) => {
  const { chromium } = await import("@playwright/test");
  const server = await startStaticServer(distRoot, mountPath);
  const browser = await chromium.launch({ channel: "chromium", headless: true });
  const failures = [];
  const page = await browser.newPage({ viewport: { height: 900, width: 1600 } });
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) =>
    failures.push(`request: ${request.method()} ${request.url()}`),
  );
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === server.origin) {
      await route.continue();
    } else {
      failures.push(`external request: ${url.href}`);
      await route.abort();
    }
  });

  try {
    const settleMilliseconds = 1_250;
    const states = releaseSmokeAudienceStates(context.deck.slides);
    const stateReceipts = [];
    const transitionReceipts = [];
    const finalStateCaptures = [];
    const transitionCaptures = [];
    const audienceResponse = await page.goto(`${server.origin}${mountPath}/`, {
      waitUntil: "networkidle",
    });
    if (audienceResponse === null || !audienceResponse.ok()) {
      throw new Error("The built audience route did not return a successful response.");
    }
    await page.locator("#drever-root[data-drever-ready]").waitFor({ state: "attached" });
    const audienceSlides = await page.locator("[data-drever-slide]").count();
    if (audienceSlides !== context.deck.slides.length) {
      throw new Error(
        `Audience rendered ${audienceSlides} slides; context reported ${context.deck.slides.length}.`,
      );
    }
    await page.waitForTimeout(settleMilliseconds);

    let settledFrame;
    for (const [index, state] of states.entries()) {
      const path = releaseSmokeStatePath(mountPath, state);
      await page.waitForFunction((expectedPath) => window.location.pathname === expectedPath, path);
      settledFrame ??= await page.evaluate(captureReleaseSmokeFrame);
      const stateIssues = [...settledFrame.issues, ...releaseSmokeTextSafeAreaIssues(settledFrame)];
      if (settledFrame.slide.index !== state.slideIndex || settledFrame.slide.step !== state.step) {
        stateIssues.push({
          type: "audience-state-mismatch",
          actual: {
            slideIndex: settledFrame.slide.index,
            step: settledFrame.slide.step,
          },
          expected: {
            slideIndex: state.slideIndex,
            step: state.step,
          },
        });
      }
      stateReceipts.push({
        path,
        slide: state.slideNumber,
        step: state.step,
        visibleElements: settledFrame.visibleElementCount,
        issues: stateIssues,
      });

      const next = states[index + 1];
      if (captureVisualEvidence && (next === undefined || next.slideIndex !== state.slideIndex)) {
        const path = `states/slide-${String(state.slideNumber).padStart(2, "0")}.png`;
        const content = await page.screenshot({ type: "png" });
        await writeFile(join(evidenceRoot, path), content);
        finalStateCaptures.push({ content, path, slide: state.slideNumber, step: state.step });
      }
      if (next === undefined) continue;
      const nextPath = releaseSmokeStatePath(mountPath, next);
      const navigation = page.waitForFunction(
        (expectedPath) => window.location.pathname === expectedPath,
        nextPath,
      );
      await page.keyboard.press("ArrowRight");
      await navigation;
      await page.waitForTimeout(80);
      if (captureVisualEvidence) {
        const transitionContent = await page.screenshot({ type: "png" });
        transitionCaptures.push({ content: transitionContent, from: path, to: nextPath });
      }
      const transition = await page.evaluate(captureReleaseSmokeFrame);
      await page.waitForTimeout(settleMilliseconds);
      const transitionSettled = await page.evaluate(captureReleaseSmokeFrame);
      const transitionIssues = releaseSmokeTransitionIssues(transition, transitionSettled);
      if (transition.slide.index !== next.slideIndex || transition.slide.step !== next.step) {
        transitionIssues.push({
          type: "transition-state-mismatch",
          actual: {
            slideIndex: transition.slide.index,
            step: transition.slide.step,
          },
          expected: {
            slideIndex: next.slideIndex,
            step: next.step,
          },
        });
      }
      transitionReceipts.push({
        from: path,
        to: nextPath,
        sampledAtMilliseconds: 80,
        issues: transitionIssues,
      });
      settledFrame = transitionSettled;
    }
    const navigationPath = new URL(page.url()).pathname;
    const visualEvidence = captureVisualEvidence
      ? await writeVisualEvidence(
          browser,
          finalStateCaptures,
          transitionCaptures,
          evidenceRoot,
          sourceSha256,
        )
      : undefined;

    const documentPath = `${mountPath}/document/`;
    const documentResponse = await page.goto(`${server.origin}${documentPath}`, {
      waitUntil: "networkidle",
    });
    if (documentResponse === null || !documentResponse.ok()) {
      throw new Error("The built document route did not return a successful response.");
    }
    await page.locator("[data-drever-document]").waitFor({ state: "visible" });
    const documentSlides = await page.locator("[data-drever-document] [data-drever-slide]").count();
    if (documentSlides !== context.deck.slides.length) {
      throw new Error(
        `Document rendered ${documentSlides} slides; context reported ${context.deck.slides.length}.`,
      );
    }
    const speakerPath = `${mountPath}/speaker/`;
    const speakerResponse = await page.goto(`${server.origin}${speakerPath}`, {
      waitUntil: "networkidle",
    });
    if (speakerResponse === null || !speakerResponse.ok()) {
      throw new Error("The built speaker route did not return a successful response.");
    }
    await page.locator("[data-drever-speaker]").waitFor({ state: "visible" });
    const geometryIssues = [
      ...stateReceipts.flatMap(({ path, issues }) => issues.map((issue) => ({ ...issue, path }))),
      ...transitionReceipts.flatMap(({ from, to, issues }) =>
        issues.map((issue) => ({ ...issue, from, to })),
      ),
    ];
    if (failures.length > 0 || geometryIssues.length > 0) {
      throw new Error(
        `Browser smoke found presentation failures:\n${JSON.stringify(
          { geometry: geometryIssues, runtime: failures },
          null,
          2,
        )}`,
      );
    }
    return {
      version: 1,
      mountPath,
      viewport: { height: 900, width: 1600 },
      audience: {
        navigationPath,
        slideCount: audienceSlides,
        stateCount: states.length,
        states: stateReceipts,
        transitions: transitionReceipts,
        status: "passed",
      },
      document: { path: documentPath, slideCount: documentSlides, status: "passed" },
      speaker: { path: speakerPath, status: "passed" },
      externalRequests: 0,
      ...(visualEvidence === undefined
        ? {}
        : {
            visualEvidence: {
              contactSheets: visualEvidence.contactSheets,
              slides: visualEvidence.slides.length,
              transitions: visualEvidence.transitions.length,
            },
          }),
    };
  } finally {
    await page.close();
    await browser.close();
    await server.close();
  }
};

await Promise.all([
  rm(workspaceRoot, { force: true, recursive: true }),
  rm(caseRoot, { force: true, recursive: true }),
  ...(captureVisualEvidence
    ? [rm(join(outputRoot, "visual-evidence"), { force: true, recursive: true })]
    : []),
]);
await Promise.all([
  mkdir(workspaceRoot, { recursive: true }),
  ...(captureVisualEvidence
    ? [mkdir(join(outputRoot, "visual-evidence", "states"), { recursive: true })]
    : []),
]);

const [generation, transcript] = await Promise.all([
  readFile(join(generationRoot, "generation.json"), "utf8").then(JSON.parse),
  readFile(join(generationRoot, "transcript.json"), "utf8").then(JSON.parse),
]);
if (
  generation.schemaVersion !== RELEASE_SMOKE_SCHEMA_VERSION ||
  generation.provider?.id !== providerId ||
  generation.scenarioId !== scenarioId ||
  generation.version !== version ||
  transcript.schemaVersion !== RELEASE_SMOKE_SCHEMA_VERSION ||
  transcript.providerId !== providerId ||
  transcript.scenarioId !== scenarioId
) {
  throw new Error("Generation artifact does not match the requested release smoke case.");
}
if (
  generation.executionBoundary?.credential !== "protected-provider-proxy" ||
  generation.executionBoundary?.shell !== "tool-surface-deny-configured" ||
  generation.executionBoundary?.publication !== "allowlisted-source-only"
) {
  throw new Error("Generation artifact does not declare the required non-executable boundary.");
}
const visualReviewProvenance = captureVisualEvidence
  ? undefined
  : releaseSmokeVisualReviewProvenance(generation);

const collectedSource = await collectReleaseSmokeSource(
  join(generationRoot, "source"),
  validatedSourceRoot,
);
assertReleaseSmokeSourceReceipt(generation.source, collectedSource, "Release smoke generation");

const scaffoldResult = await run(
  "npm",
  [
    "create",
    `drever@${version}`,
    projectRoot,
    "--",
    "--agent",
    "none",
    "--package-manager",
    "npm",
    "--json",
  ],
  workspaceRoot,
);
const scaffold = parseJsonOutput(scaffoldResult.stdout, "create-drever");
const [projectPackage, installedPackage] = await Promise.all([
  readFile(join(projectRoot, "package.json"), "utf8").then(JSON.parse),
  readFile(join(projectRoot, "node_modules", "drever", "package.json"), "utf8").then(JSON.parse),
]);
if (
  scaffold.installed !== true ||
  scaffold.root !== projectRoot ||
  projectPackage.devDependencies?.drever !== version ||
  installedPackage.version !== version
) {
  throw new Error(`The build job did not install Drever ${version} exactly.`);
}

let sourceFiles;
try {
  sourceFiles = await copyReleaseSmokeSource(validatedSourceRoot, projectRoot);
} catch (error) {
  markRepairableFailure(error);
  throw error;
}
let build;
let check;
let context;
try {
  ({ build, check, context } = await runReleaseSmokeBuildInContainer({
    projectRoot,
    runnerPath: fileURLToPath(new URL("./isolated-build.mjs", import.meta.url)),
  }));
} catch (error) {
  if (error instanceof ReleaseSmokeAuthoringFailure) markRepairableFailure(error);
  throw error;
}
let slideCount;
let speakerNoteCount;
try {
  ({ slideCount, speakerNoteCount } = assertReleaseSmokeContext(context));
  if (scenario.mode === "guided" && speakerNoteCount === 0) {
    throw new Error("The guided release smoke deck must include at least one speaker note.");
  }
  assertReleaseSmokeCheck(check, slideCount);
} catch (error) {
  markRepairableFailure(error);
  throw error;
}
const website = build?.artifacts?.find((artifact) => artifact.kind === "website");
if (build?.version !== 1 || build.ok !== true || typeof website?.path !== "string") {
  throw new Error("Drever build did not return a website artifact.");
}
const websitePath = resolveIsolatedProjectPath(projectRoot, website.path);
const buildOutput = await assertSafeReleaseSmokeBuildOutput(websitePath);
const deckMount = releaseSmokeDeckMount(runId, caseId);
let browser;
try {
  browser = await runBrowserSmoke(
    websitePath,
    context,
    deckMount,
    captureVisualEvidence ? join(outputRoot, "visual-evidence") : undefined,
    generation.source.sha256,
  );
} catch (error) {
  if (
    error instanceof Error &&
    error.message.startsWith("Browser smoke found presentation failures:")
  ) {
    markRepairableFailure(error);
  }
  throw error;
}
const publicReceipt = (value) =>
  redactStructuredPaths(value, [
    [projectRoot, "<project>"],
    [workspaceRoot, "<workspace>"],
    [generationRoot, "<generation>"],
    [outputRoot, "<output>"],
    ["/project", "<project>"],
  ]);

await Promise.all([
  mkdir(receiptsRoot, { recursive: true }),
  cp(websitePath, join(caseRoot, "deck"), { recursive: true }),
  cp(join(generationRoot, "source"), join(caseRoot, "source"), { recursive: true }),
  cp(join(generationRoot, "transcript.json"), join(caseRoot, "transcript.json")),
  cp(join(generationRoot, "generation.json"), join(caseRoot, "generation.json")),
  cp(join(generationRoot, "prompt.json"), join(caseRoot, "prompt.json")),
]);
await Promise.all([
  writeFile(join(receiptsRoot, "scaffold.json"), json(publicReceipt(scaffold)), "utf8"),
  writeFile(join(receiptsRoot, "context.json"), json(publicReceipt(context)), "utf8"),
  writeFile(join(receiptsRoot, "check.json"), json(publicReceipt(check)), "utf8"),
  writeFile(join(receiptsRoot, "build.json"), json(publicReceipt(build)), "utf8"),
  writeFile(join(receiptsRoot, "browser.json"), json(publicReceipt(browser)), "utf8"),
]);

const basePath = `/release-smoke/runs/${runId}/${caseId}`;
await writeFile(
  join(caseRoot, "case.json"),
  json({
    schemaVersion: RELEASE_SMOKE_RUN_SCHEMA_VERSION,
    id: caseId,
    scenarioId,
    provider: {
      id: provider.id,
      label: provider.label,
      model: generation.model,
      version: generation.runnerVersion,
    },
    mode: scenario.mode,
    status: "passed",
    title: scenario.label,
    brief: scenario.brief,
    durationSeconds: transcript.durationSeconds,
    visualReview: visualReviewProvenance,
    deck: {
      audience: `${basePath}/deck/`,
      document: `${basePath}/deck/document/`,
      source: `${basePath}/source/slides.mdx`,
    },
    checks: [
      `Installed create-drever@${version} and drever@${version}`,
      `Authoring context reported ${slideCount} slides`,
      `Authoring context reported ${speakerNoteCount} speaker notes`,
      "Drever check passed without errors",
      `Production website build completed with ${buildOutput.files} bounded output files`,
      `${browser.audience.stateCount} exact audience slide and Step states plus ${browser.audience.transitions.length} adjacent transition samples passed geometry and runtime audit`,
      ...(visualReviewProvenance === undefined ? [] : [RELEASE_SMOKE_VISUAL_REVIEW_RECEIPT]),
      "Document and speaker browser smoke passed",
      "Generated source executed as a non-root user in a no-network container without the repository or runner environment",
      "Secret-bearing generation used a protected provider proxy and non-executable authoring tools; only allowlisted source was retained",
      `${sourceFiles.length} allowlisted source files crossed the secret boundary`,
    ],
    messages: transcript.messages,
    generatedAt: transcript.completedAt,
    nodeVersion: generation.nodeVersion,
    sourceCommit,
    version,
  }),
  "utf8",
);

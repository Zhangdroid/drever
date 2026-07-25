import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { cp, mkdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { assertReleaseVersion } from "../release.mjs";
import {
  assertSafeReleaseSmokeBuildOutput,
  resolveIsolatedProjectPath,
  runReleaseSmokeBuildInContainer,
} from "./build-isolation.mjs";
import {
  assertReleaseSmokeContext,
  copyReleaseSmokeSource,
  json,
  redactStructuredPaths,
  relativeMountedPathname,
  releaseSmokeDeckMount,
  RELEASE_SMOKE_SCHEMA_VERSION,
} from "./contract.mjs";
import { getReleaseSmokeScenario } from "./scenarios.mjs";

const execute = promisify(execFile);
const [version, scenarioId, runId, sourceCommit, generationArgument, outputArgument] =
  process.argv.slice(2);
if (
  version === undefined ||
  scenarioId === undefined ||
  runId === undefined ||
  sourceCommit === undefined ||
  generationArgument === undefined ||
  outputArgument === undefined
) {
  throw new Error(
    "Usage: node scripts/release-smoke/build-case.mjs <version> <scenario> <run-id> <source-commit> <generation-artifact> <output>",
  );
}
assertReleaseVersion(version);
const scenario = getReleaseSmokeScenario(scenarioId);
if (!/^\d+$/u.test(runId)) throw new Error(`Invalid GitHub Actions run id: ${runId}`);
if (!/^[0-9a-f]{40}$/u.test(sourceCommit)) {
  throw new Error(`Invalid release source commit: ${sourceCommit}`);
}

const generationRoot = resolve(generationArgument);
const outputRoot = resolve(outputArgument);
const workspaceRoot = resolve(
  process.env.RUNNER_TEMP ?? join(outputRoot, ".workspace"),
  `drever-release-smoke-build-${scenarioId}`,
);
const projectRoot = join(workspaceRoot, "deck");
const npmCache = join(workspaceRoot, "npm-cache");
const caseRoot = join(outputRoot, scenarioId);
const receiptsRoot = join(caseRoot, "receipts");
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

const runBrowserSmoke = async (distRoot, slideCount, mountPath) => {
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
    const audienceResponse = await page.goto(`${server.origin}${mountPath}/`, {
      waitUntil: "networkidle",
    });
    if (audienceResponse === null || !audienceResponse.ok()) {
      throw new Error("The built audience route did not return a successful response.");
    }
    await page.locator("#drever-root[data-drever-ready]").waitFor({ state: "attached" });
    const audienceSlides = await page.locator("[data-drever-slide]").count();
    if (audienceSlides !== slideCount) {
      throw new Error(
        `Audience rendered ${audienceSlides} slides; context reported ${slideCount}.`,
      );
    }
    if (slideCount > 1) {
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction(
        (mount) =>
          window.location.pathname.startsWith(`${mount}/`) &&
          window.location.pathname !== `${mount}/`,
        mountPath,
      );
    }
    const navigationPath = new URL(page.url()).pathname;

    const documentPath = `${mountPath}/document/`;
    const documentResponse = await page.goto(`${server.origin}${documentPath}`, {
      waitUntil: "networkidle",
    });
    if (documentResponse === null || !documentResponse.ok()) {
      throw new Error("The built document route did not return a successful response.");
    }
    await page.locator("[data-drever-document]").waitFor({ state: "visible" });
    const documentSlides = await page.locator("[data-drever-document] [data-drever-slide]").count();
    if (documentSlides !== slideCount) {
      throw new Error(
        `Document rendered ${documentSlides} slides; context reported ${slideCount}.`,
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
    if (failures.length > 0) {
      throw new Error(`Browser smoke found runtime failures:\n${failures.join("\n")}`);
    }
    return {
      version: 1,
      mountPath,
      audience: { navigationPath, slideCount: audienceSlides, status: "passed" },
      document: { path: documentPath, slideCount: documentSlides, status: "passed" },
      speaker: { path: speakerPath, status: "passed" },
      externalRequests: 0,
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
]);
await mkdir(workspaceRoot, { recursive: true });

const [generation, transcript] = await Promise.all([
  readFile(join(generationRoot, "generation.json"), "utf8").then(JSON.parse),
  readFile(join(generationRoot, "transcript.json"), "utf8").then(JSON.parse),
]);
if (
  generation.schemaVersion !== RELEASE_SMOKE_SCHEMA_VERSION ||
  generation.scenarioId !== scenarioId ||
  generation.version !== version ||
  transcript.schemaVersion !== RELEASE_SMOKE_SCHEMA_VERSION ||
  transcript.scenarioId !== scenarioId
) {
  throw new Error("Generation artifact does not match the requested release smoke case.");
}
if (
  generation.executionBoundary?.shell !== "pre-tool-use-deny-configured" ||
  generation.executionBoundary?.publication !== "allowlisted-source-only"
) {
  throw new Error("Generation artifact does not declare the required non-executable boundary.");
}

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

const sourceFiles = await copyReleaseSmokeSource(join(generationRoot, "source"), projectRoot);
const { build, check, context } = await runReleaseSmokeBuildInContainer({
  projectRoot,
  runnerPath: fileURLToPath(new URL("./isolated-build.mjs", import.meta.url)),
});
const { slideCount, speakerNoteCount } = assertReleaseSmokeContext(context);
if (scenario.mode === "guided" && speakerNoteCount === 0) {
  throw new Error("The guided release smoke deck must include at least one speaker note.");
}
if (check?.version !== 1 || check?.summary?.errors !== 0 || check.slideCount !== slideCount) {
  throw new Error("Drever check did not return a clean release smoke receipt.");
}
const website = build?.artifacts?.find((artifact) => artifact.kind === "website");
if (build?.version !== 1 || build.ok !== true || typeof website?.path !== "string") {
  throw new Error("Drever build did not return a website artifact.");
}
const websitePath = resolveIsolatedProjectPath(projectRoot, website.path);
const buildOutput = await assertSafeReleaseSmokeBuildOutput(websitePath);
const deckMount = releaseSmokeDeckMount(runId, scenarioId);
const browser = await runBrowserSmoke(websitePath, slideCount, deckMount);
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

const basePath = `/release-smoke/runs/${runId}/${scenarioId}`;
await writeFile(
  join(caseRoot, "case.json"),
  json({
    schemaVersion: RELEASE_SMOKE_SCHEMA_VERSION,
    id: scenarioId,
    mode: scenario.mode,
    status: "passed",
    title: scenario.label,
    brief: scenario.brief,
    durationSeconds: transcript.durationSeconds,
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
      "Audience, document, and speaker browser smoke passed",
      "Generated source executed as a non-root user in a no-network container without the repository or runner environment",
      "Secret-bearing generation configured a shell-denial hook; only allowlisted authoring source was retained",
      `${sourceFiles.length} allowlisted source files crossed the secret boundary`,
    ],
    messages: transcript.messages,
    generatedAt: transcript.completedAt,
    runner: {
      codexVersion: generation.codexVersion,
      model: generation.model,
      nodeVersion: generation.nodeVersion,
    },
    sourceCommit,
    version,
  }),
  "utf8",
);

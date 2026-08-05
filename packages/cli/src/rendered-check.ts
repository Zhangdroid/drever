import { DEFAULT_CANVAS } from "@drever/client";
import {
  RENDERED_PREFLIGHT_RULESET_VERSION,
  RENDERED_PREFLIGHT_VERSION,
  type Diagnostic,
  type RenderedPreflightReceipt,
} from "@drever/schema";
import { access } from "node:fs/promises";
import { chromium, type Browser, type Page } from "playwright-core";
import { preview, type PreviewServer } from "vite";
import { createPrivateApp } from "./private-app.ts";
import type { ResolvedDreverProject } from "./project.ts";
import { analyzeRenderedCheckFrames } from "./rendered-check-analysis.ts";
import { captureRenderedCheckFrame, type RenderedCheckFrame } from "./rendered-check-browser.ts";
import {
  hashRenderedEvidenceInput,
  invalidateRenderedEvidence,
  writeRenderedEvidence,
  type RenderedEvidenceState,
  type RenderedSettledCapture,
} from "./rendered-evidence.ts";
import { buildDreverInspectionApp, resolvePrivateAppOptions } from "./vite-app.ts";

const CHECK_TIMEOUT = 30_000;
const RESOURCE_SETTLE_TIMEOUT = 10_000;
const BROWSER_INSTALL_HINT = "Run drever browser install, then retry the rendered check.";

export type RenderedCheckResult = Readonly<{
  diagnostics: readonly Diagnostic[];
  receipt: RenderedPreflightReceipt;
}>;

const renderedStates = (project: ResolvedDreverProject): readonly RenderedEvidenceState[] => {
  const manifest = project.getDeckManifest();
  if (manifest === undefined) {
    return [];
  }
  return manifest.slides.flatMap((slide) =>
    [0, ...slide.stepStops].map((step) => ({
      route:
        slide.index === 0 && step === 0
          ? "/"
          : `/${String(slide.index + 1)}${step === 0 ? "" : `/${String(step)}`}`,
      slideId: slide.id,
      slideIndex: slide.index,
      step,
    })),
  );
};

const isMissingExecutable = (error: unknown): boolean =>
  error instanceof Error &&
  (error.message.includes("Executable doesn't exist") || error.message.includes("ENOENT"));

const launchBrowser = async (): Promise<Browser> => {
  await access(chromium.executablePath());
  return chromium.launch({ channel: "chromium", headless: true });
};

const startPreview = async (root: string, outDir: string): Promise<PreviewServer> =>
  preview({
    build: { outDir },
    configFile: false,
    logLevel: "silent",
    preview: { host: "127.0.0.1", open: false, port: 0, strictPort: true },
    root,
  });

const previewUrl = (server: PreviewServer): string => {
  const url = server.resolvedUrls?.local[0];
  if (url === undefined) {
    throw new TypeError("The rendered-check preview did not expose a local URL.");
  }
  return url;
};

const withTimeout = async <Value>(
  operation: Promise<Value>,
  timeout: number,
  message: string,
): Promise<Value> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TypeError(message)), timeout);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

/** @internal Waits for deterministic browser evidence without waiting indefinitely. */
export const settleRenderedPage = async (page: Page): Promise<void> => {
  await page.locator("#drever-root[data-drever-ready]").waitFor({
    state: "attached",
    timeout: CHECK_TIMEOUT,
  });
  await page.addStyleTag({
    content: `*,*::before,*::after {
  animation-delay: 0s !important;
  animation-duration: 0s !important;
  caret-color: transparent !important;
  transition-delay: 0s !important;
  transition-duration: 0s !important;
}
[data-drever-audience-controls] {
  display: none !important;
}`,
  });
  await withTimeout(
    page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.images].map(async (image) => {
          if (!image.complete) {
            await new Promise<void>((resolve) => {
              image.addEventListener("error", () => resolve(), { once: true });
              image.addEventListener("load", () => resolve(), { once: true });
            });
          }
          await image.decode().catch(() => undefined);
        }),
      );
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    }),
    RESOURCE_SETTLE_TIMEOUT,
    `Rendered resources did not settle within ${String(RESOURCE_SETTLE_TIMEOUT)}ms.`,
  );
};

const browserLocale = (lang?: string): string | undefined =>
  lang === undefined ? undefined : Intl.DateTimeFormat.supportedLocalesOf([lang])[0];

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const runtimeDiagnostic = (
  message: string,
  code = "DREVER_RENDER_RUNTIME_FAILED",
  hint = "Fix the rendered runtime failure and run the check again.",
): Diagnostic => ({
  code,
  severity: "error",
  stage: "runtime",
  message,
  hint,
});

const receipt = (
  project: ResolvedDreverProject,
  options: Readonly<{
    browserVersion?: string;
    evidence?: RenderedPreflightReceipt["evidence"];
    reason?: RenderedPreflightReceipt["reason"];
    stateCount: number;
    status: RenderedPreflightReceipt["status"];
  }>,
): RenderedPreflightReceipt => ({
  version: RENDERED_PREFLIGHT_VERSION,
  rulesetVersion: RENDERED_PREFLIGHT_RULESET_VERSION,
  canvas: project.config.canvas ?? project.plan.theme.canvas ?? DEFAULT_CANVAS,
  engine: "chromium",
  ...(options.browserVersion === undefined ? {} : { browserVersion: options.browserVersion }),
  ...(options.evidence === undefined ? {} : { evidence: options.evidence }),
  stateCount: options.stateCount,
  status: options.status,
  ...(options.reason === undefined ? {} : { reason: options.reason }),
});

/** @internal Captures states in order and reports each completed frame. */
export const captureRenderedStates = async (
  page: Page,
  origin: string,
  states: readonly RenderedEvidenceState[],
  onCaptured: (
    frame: RenderedCheckFrame,
    state: RenderedEvidenceState,
  ) => void | Promise<void> = () => undefined,
): Promise<readonly RenderedCheckFrame[]> => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => {
    runtimeErrors.push(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      runtimeErrors.push(`${String(response.status())} ${response.url()}`);
    }
  });
  const frames: RenderedCheckFrame[] = [];
  for (const state of states) {
    const runtimeErrorOffset = runtimeErrors.length;
    const target = new URL(
      state.route === "/" ? "" : `${state.route.slice(1).replace(/\/+$/u, "")}/`,
      origin,
    ).href;
    const response = await page.goto(target, { timeout: CHECK_TIMEOUT, waitUntil: "load" });
    if (response === null || !response.ok()) {
      throw new TypeError(`Rendered route ${state.route} did not return a successful response.`);
    }
    try {
      await settleRenderedPage(page);
    } catch (cause) {
      const browserEvidence =
        runtimeErrors.length === 0 ? "" : ` Browser reported: ${runtimeErrors.join(" | ")}`;
      throw new TypeError(
        `Rendered route ${state.route} did not become ready: ${errorMessage(cause)}${browserEvidence}`,
        { cause },
      );
    }
    const routeErrors = runtimeErrors.slice(runtimeErrorOffset);
    if (routeErrors.length > 0) {
      throw new TypeError(
        `Rendered route ${state.route} reported a browser error: ${routeErrors.join(" | ")}`,
      );
    }
    const frame = await page.evaluate(captureRenderedCheckFrame, state.route);
    if (
      frame.slide.id !== state.slideId ||
      frame.slide.index !== state.slideIndex ||
      frame.slide.step !== state.step
    ) {
      throw new TypeError(
        `Rendered route ${state.route} resolved slide ${frame.slide.index + 1} Step ${frame.slide.step} instead of slide ${state.slideIndex + 1} Step ${state.step}.`,
      );
    }
    frames.push(frame);
    await onCaptured(frame, state);
  }
  return frames;
};

/** Runs a temporary production rendering and returns deterministic layout evidence. */
export const checkRenderedProject = async (
  project: ResolvedDreverProject,
  options: Readonly<{ evidenceDirectory?: string }> = {},
): Promise<RenderedCheckResult> => {
  if (options.evidenceDirectory !== undefined) {
    await invalidateRenderedEvidence(options.evidenceDirectory);
  }
  const app = await createPrivateApp(
    project.entry,
    resolvePrivateAppOptions(project.config, project.root),
  );
  let browser: Browser | undefined;
  let browserVersion: string | undefined;
  let server: PreviewServer | undefined;
  let capturedStates = 0;
  let capturedDiagnostics: readonly Diagnostic[] = [];
  try {
    const build = await buildDreverInspectionApp(project, app.root);
    const inputSha256 =
      options.evidenceDirectory === undefined
        ? undefined
        : await hashRenderedEvidenceInput(build.outDir);
    const states = renderedStates(project);
    if (states.length === 0 || build.manifest.slides.length === 0) {
      throw new TypeError("The rendered check did not receive a compiled deck manifest.");
    }
    server = await startPreview(app.root, build.outDir);
    browser = await launchBrowser();
    browserVersion = browser.version();
    const canvas = project.config.canvas ?? project.plan.theme.canvas ?? DEFAULT_CANVAS;
    const locale = browserLocale(project.config.deck?.lang);
    const origin = previewUrl(server);
    const context = await browser.newContext({
      deviceScaleFactor: 1,
      ...(locale === undefined ? {} : { locale }),
      reducedMotion: "reduce",
      serviceWorkers: "block",
      timezoneId: "UTC",
      viewport: { height: canvas.height, width: canvas.width },
    });
    const page = await context.newPage();
    const settledCaptures: RenderedSettledCapture[] = [];
    const frames = await captureRenderedStates(page, origin, states, async (_frame, state) => {
      capturedStates += 1;
      if (options.evidenceDirectory !== undefined) {
        settledCaptures.push({
          content: await page.screenshot({ caret: "hide", type: "png" }),
          state,
        });
      }
    });
    await context.close();
    capturedDiagnostics = analyzeRenderedCheckFrames(frames);
    const evidence =
      options.evidenceDirectory === undefined || inputSha256 === undefined
        ? undefined
        : await writeRenderedEvidence({
            browser,
            browserVersion,
            canvas,
            inputSha256,
            ...(locale === undefined ? {} : { locale }),
            origin,
            output: options.evidenceDirectory,
            settledCaptures,
            states,
          });
    return {
      diagnostics: capturedDiagnostics,
      receipt: receipt(project, {
        ...(browserVersion === undefined ? {} : { browserVersion }),
        ...(evidence === undefined
          ? {}
          : {
              evidence: {
                inputSha256: evidence.input.sha256,
                manifest: "manifest.json",
                schemaVersion: evidence.schemaVersion,
              },
            }),
        stateCount: capturedStates,
        status: capturedDiagnostics.some(({ severity }) => severity === "error")
          ? "failed"
          : "passed",
      }),
    };
  } catch (cause) {
    const missing = isMissingExecutable(cause);
    return {
      diagnostics: [
        ...capturedDiagnostics,
        missing
          ? runtimeDiagnostic(
              "Drever rendered preflight requires Playwright Chromium.",
              "DREVER_RENDER_BROWSER_MISSING",
              BROWSER_INSTALL_HINT,
            )
          : runtimeDiagnostic(`Rendered preflight failed: ${errorMessage(cause)}`),
      ],
      receipt: receipt(project, {
        ...(browserVersion === undefined ? {} : { browserVersion }),
        reason: missing ? "browser-missing" : "runtime-failed",
        stateCount: capturedStates,
        status: "failed",
      }),
    };
  } finally {
    await browser?.close().catch(() => undefined);
    await server?.close().catch(() => undefined);
    await app.dispose().catch(() => undefined);
  }
};

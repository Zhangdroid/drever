import { DEFAULT_CANVAS } from "@drever/client";
import { randomUUID } from "node:crypto";
import { access, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { chromium, type Browser, type Page } from "playwright-core";
import { preview, type PreviewServer } from "vite";
import type { PdfExportRequest, PdfSlideRange } from "./cli.ts";
import { DreverCliError } from "./errors.ts";
import { createPrivateExportApp } from "./private-app.ts";
import { buildDreverExportApp, resolvePrivateAppOptions } from "./vite-app.ts";

const EXPORT_TIMEOUT = 30_000;
const EXPORT_CLEANUP_TIMEOUT = 10_000;
const BROWSER_INSTALL_HINT = "Run drever browser install, then retry the export.";

type ExportStage = "cleanup" | "pdf" | "preview" | "runtime" | "write";

type ExportErrorSnapshot = Readonly<{
  capability?: unknown;
  code?: unknown;
  details?: unknown;
  message?: unknown;
  name?: unknown;
  owner?: unknown;
  specifier?: unknown;
  stack?: unknown;
}>;

const exportFailure = (
  stage: ExportStage,
  message: string,
  cause: unknown,
  details: Readonly<Record<string, unknown>> = {},
): DreverCliError =>
  new DreverCliError("DREVER_EXPORT_FAILED", message, {
    cause,
    details: { ...details, stage },
    hint: "Fix the reported export error and run the command again.",
  });

const browserMissing = (cause: unknown): DreverCliError =>
  new DreverCliError(
    "DREVER_EXPORT_BROWSER_MISSING",
    "Drever PDF export requires Playwright Chromium.",
    { cause, hint: BROWSER_INSTALL_HINT },
  );

const isMissingExecutable = (error: unknown): boolean =>
  error instanceof Error &&
  (error.message.includes("Executable doesn't exist") || error.message.includes("ENOENT"));

const launchBrowser = async (): Promise<Browser> => {
  try {
    await access(chromium.executablePath());
    return await chromium.launch({ channel: "chromium", headless: true });
  } catch (cause) {
    if (isMissingExecutable(cause)) {
      throw browserMissing(cause);
    }
    throw exportFailure("runtime", "Drever could not start Chromium for PDF export.", cause);
  }
};

/** @internal Playwright rejects valid document tags such as `und` as browser locales. */
export const resolveBrowserLocale = (lang?: string): string | undefined => {
  if (lang === undefined) {
    return;
  }
  return Intl.DateTimeFormat.supportedLocalesOf([lang])[0];
};

const appendSuppressedFailure = (primary: unknown, suppressed: unknown): unknown => {
  if (!(primary instanceof Error)) {
    const failure = exportFailure(
      "cleanup",
      "PDF export failed and its resources could not be released.",
      primary,
    );
    Object.defineProperty(failure, "suppressedErrors", {
      configurable: true,
      enumerable: true,
      value: Object.freeze([suppressed]),
    });
    return failure;
  }

  const existing =
    "suppressedErrors" in primary && Array.isArray(primary.suppressedErrors)
      ? primary.suppressedErrors
      : [];
  try {
    Object.defineProperty(primary, "suppressedErrors", {
      configurable: true,
      enumerable: true,
      value: Object.freeze([...existing, suppressed]),
    });
    return primary;
  } catch {
    const failure = exportFailure("cleanup", primary.message, primary);
    Object.defineProperty(failure, "suppressedErrors", {
      configurable: true,
      enumerable: true,
      value: Object.freeze([suppressed]),
    });
    return failure;
  }
};

/** @internal Runs one owner operation and preserves its failure if release also fails. */
export const runWithCleanup = async <Value>(
  operation: () => Promise<Value>,
  cleanup: () => Promise<void>,
): Promise<Value> => {
  let operationCompleted = false;
  try {
    const value = await operation();
    operationCompleted = true;
    await cleanup();
    return value;
  } catch (primary) {
    if (operationCompleted) {
      throw primary;
    }
    try {
      await cleanup();
    } catch (cleanupFailure) {
      throw appendSuppressedFailure(primary, cleanupFailure);
    }
    throw primary;
  }
};

const releaseResource = async (resource: string, release: () => Promise<void>): Promise<void> => {
  try {
    await release();
  } catch (cause) {
    if (cause instanceof DreverCliError) {
      throw cause;
    }
    throw new DreverCliError(
      "DREVER_EXPORT_FAILED",
      `Drever could not release ${resource} after PDF export.`,
      {
        cause,
        details: { resource, stage: "cleanup" },
        hint: "Fix the reported cleanup error and run the command again.",
      },
    );
  }
};

const startPreview = async (root: string, outDir: string): Promise<PreviewServer> => {
  try {
    return await preview({
      build: { outDir },
      configFile: false,
      logLevel: "silent",
      preview: { host: "127.0.0.1", open: false, port: 0, strictPort: true },
      root,
    });
  } catch (cause) {
    throw exportFailure("preview", "Drever could not serve the temporary export build.", cause);
  }
};

const previewUrl = (server: PreviewServer): string => {
  const url = server.resolvedUrls?.local[0];
  if (url === undefined) {
    throw exportFailure(
      "preview",
      "The temporary export server did not expose a local URL.",
      new TypeError("Vite preview returned no local URL."),
    );
  }
  return url;
};

const errorDetails = (snapshot: ExportErrorSnapshot | undefined): Record<string, unknown> => {
  if (snapshot === undefined) {
    return {};
  }
  return {
    ...(snapshot.capability === undefined ? {} : { capability: snapshot.capability }),
    ...(snapshot.code === undefined ? {} : { code: snapshot.code }),
    ...(snapshot.details === undefined ? {} : { runtimeDetails: snapshot.details }),
    ...(snapshot.name === undefined ? {} : { errorName: snapshot.name }),
    ...(snapshot.owner === undefined ? {} : { owner: snapshot.owner }),
    ...(snapshot.specifier === undefined ? {} : { specifier: snapshot.specifier }),
    ...(snapshot.stack === undefined ? {} : { runtimeStack: snapshot.stack }),
  };
};

const readExportError = async (page: Page): Promise<ExportErrorSnapshot | undefined> => {
  const source = await page.locator("html").getAttribute("data-drever-export-error");
  return source === null ? undefined : (JSON.parse(source) as ExportErrorSnapshot);
};

const waitForExport = async (page: Page, url: string): Promise<void> => {
  const deadline = Date.now() + EXPORT_TIMEOUT;
  let pageError: unknown;
  const failed = Promise.withResolvers<never>();
  const onPageError = (error: Error): void => {
    pageError = error;
    failed.reject(error);
  };
  page.on("pageerror", onPageError);

  try {
    await Promise.race([
      (async () => {
        await page.goto(url, { timeout: EXPORT_TIMEOUT, waitUntil: "load" });
        await page.waitForSelector(
          '[data-drever-export-status="ready"], [data-drever-export-status="failed"]',
          { state: "attached", timeout: Math.max(1, deadline - Date.now()) },
        );
      })(),
      failed.promise,
    ]);
  } catch (cause) {
    const snapshot = await readExportError(page);
    if (cause instanceof Error && cause.name === "TimeoutError") {
      throw new DreverCliError(
        "DREVER_EXPORT_TIMEOUT",
        "The export document did not become ready within 30 seconds.",
        {
          cause,
          details: { stage: "runtime" },
          hint: "Ensure exportSetup hooks and media resources finish deterministically.",
        },
      );
    }
    throw exportFailure(
      "runtime",
      typeof snapshot?.message === "string"
        ? snapshot.message
        : "The export document failed while rendering.",
      pageError ?? cause,
      errorDetails(snapshot),
    );
  } finally {
    page.off("pageerror", onPageError);
  }

  const html = page.locator("html");
  if ((await html.getAttribute("data-drever-export-status")) === "failed") {
    const snapshot = await readExportError(page);
    throw exportFailure(
      "runtime",
      typeof snapshot?.message === "string"
        ? snapshot.message
        : "The export document failed while rendering.",
      snapshot,
      errorDetails(snapshot),
    );
  }
};

type ExportDocumentMetadata = Readonly<{
  height: number;
  pages: number;
  width: number;
}>;

/** @internal Validates the one-based selection after compilation reveals the deck size. */
export const validatePdfSlideSelection = (
  selection: readonly PdfSlideRange[] | undefined,
  slideCount: number,
): void => {
  const outOfBounds = selection?.find(({ last }) => last > slideCount);
  if (outOfBounds === undefined) {
    return;
  }
  throw new DreverCliError(
    "DREVER_ARGUMENT_INVALID",
    `--slides selects slide ${outOfBounds.last}, but this deck contains ${slideCount} ${slideCount === 1 ? "slide" : "slides"}.`,
    {
      details: { selectedSlide: outOfBounds.last, slideCount },
      hint: `Choose slide numbers between 1 and ${slideCount}.`,
    },
  );
};

const applyPdfSlideSelection = async (
  page: Page,
  selection: readonly PdfSlideRange[] | undefined,
): Promise<void> => {
  if (selection === undefined) {
    return;
  }
  const indices = new Set<number>();
  for (const { first, last } of selection) {
    for (let slide = first; slide <= last; slide += 1) {
      indices.add(slide - 1);
    }
  }
  const selectedSlides = [...indices].map((index) => `[data-slide-index="${index}"]`);
  const selectedPages = selectedSlides
    .map((selector) => `[data-drever-export-page]${selector}`)
    .join(",");
  await page.addStyleTag({
    content: `[data-drever-export-page]:not(:is(${selectedSlides.join(",")})) { display: none !important; }`,
  });
  const retainedPages = await page.locator(selectedPages).count();
  if (retainedPages === 0) {
    throw exportFailure(
      "runtime",
      "The export document did not contain the selected slides.",
      new TypeError("The selected slide pages were missing after export rendering."),
    );
  }
};

const readDocumentMetadata = async (page: Page): Promise<ExportDocumentMetadata> => {
  const document = page.locator("[data-drever-export-document]");
  const [heightSource, pageCountSource, widthSource] = await Promise.all([
    document.getAttribute("data-canvas-height"),
    document.getAttribute("data-page-count"),
    document.getAttribute("data-canvas-width"),
  ]);
  const height = Number(heightSource);
  const pages = Number(pageCountSource);
  const width = Number(widthSource);
  if (![height, pages, width].every((value) => Number.isSafeInteger(value) && value > 0)) {
    throw exportFailure(
      "runtime",
      "The export document reported invalid canvas or page metadata.",
      new TypeError("Export metadata must contain positive integer dimensions and page count."),
      { height: heightSource, pages: pageCountSource, width: widthSource },
    );
  }
  return Object.freeze({ height, pages, width });
};

const capturePdf = async (page: Page, metadata: ExportDocumentMetadata): Promise<Buffer> => {
  try {
    return await page.pdf({
      height: `${metadata.height}px`,
      margin: { bottom: 0, left: 0, right: 0, top: 0 },
      outline: true,
      printBackground: true,
      tagged: true,
      width: `${metadata.width}px`,
    });
  } catch (cause) {
    throw exportFailure("pdf", "Chromium could not create the Drever PDF.", cause);
  }
};

const withTimeout = async <Value>(
  operation: Promise<Value>,
  timeout: number,
  timeoutError: () => Error,
): Promise<Value> => {
  let timer: NodeJS.Timeout | undefined;
  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(timeoutError()), timeout);
    timer.unref();
  });
  try {
    return await Promise.race([operation, expired]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
};

const DESTROY_EXPORT_SOURCE = `(async () => {
  const handle = globalThis.__dreverExportHandle;
  if (handle === undefined) return;
  try {
    await handle.destroy();
    delete globalThis.__dreverExportHandle;
  } catch (error) {
    const record = (value) => value !== null && typeof value === "object" ? value : undefined;
    const string = (value, key) => typeof value?.[key] === "string" ? value[key] : undefined;
    const source = record(error);
    let context = source;
    let owner;
    let capability;
    let specifier;
    for (let depth = 0; context !== undefined && depth < 8; depth += 1) {
      const details = record(context.details);
      owner ??= string(context, "owner") ?? string(details, "owner");
      capability ??= string(context, "capability") ?? string(details, "capability");
      specifier ??= string(context, "specifier") ?? string(details, "specifier");
      context = record(context.cause);
    }
    return {
      name: string(source, "name") ?? "Error",
      message: string(source, "message") ?? String(error),
      ...(string(source, "code") === undefined ? {} : { code: string(source, "code") }),
      ...(string(source, "stack") === undefined ? {} : { stack: string(source, "stack") }),
      ...(owner === undefined ? {} : { owner }),
      ...(capability === undefined ? {} : { capability }),
      ...(specifier === undefined ? {} : { specifier }),
    };
  }
})()`;

/** @internal Releases browser-side export hooks within a fixed cleanup deadline. */
export const destroyExport = async (
  page: Pick<Page, "evaluate">,
  timeout = EXPORT_CLEANUP_TIMEOUT,
): Promise<void> => {
  try {
    const snapshot = await withTimeout(
      page.evaluate<ExportErrorSnapshot | undefined>(DESTROY_EXPORT_SOURCE),
      timeout,
      () =>
        new DreverCliError(
          "DREVER_EXPORT_TIMEOUT",
          "The export runtime did not release its resources within the cleanup deadline.",
          {
            details: { stage: "cleanup", timeout },
            hint: "Ensure exportSetup disposers settle promptly and release their resources.",
          },
        ),
    );
    if (snapshot !== undefined) {
      throw exportFailure(
        "cleanup",
        "The export runtime could not release its resources.",
        snapshot,
        errorDetails(snapshot),
      );
    }
  } catch (cause) {
    if (cause instanceof DreverCliError) {
      throw cause;
    }
    throw exportFailure("cleanup", "The export runtime could not release its resources.", cause);
  }
};

export type PdfWriteOperations = Readonly<{
  createDirectory(path: string): Promise<void>;
  move(source: string, destination: string): Promise<void>;
  remove(path: string): Promise<void>;
  temporaryPath(output: string): string;
  write(path: string, contents: Buffer): Promise<void>;
}>;

const PDF_WRITE_OPERATIONS: PdfWriteOperations = Object.freeze({
  async createDirectory(path) {
    await mkdir(path, { recursive: true });
  },
  async move(source, destination) {
    await rename(source, destination);
  },
  async remove(path) {
    await rm(path, { force: true });
  },
  temporaryPath(output) {
    return join(dirname(output), `.${basename(output)}.drever-${process.pid}-${randomUUID()}.tmp`);
  },
  async write(path, contents) {
    await writeFile(path, contents, { flag: "wx" });
  },
});

/** @internal Commits a complete PDF through a sibling file so failed writes preserve the target. */
export const writePdf = async (
  path: string,
  contents: Buffer,
  operations: PdfWriteOperations = PDF_WRITE_OPERATIONS,
): Promise<void> => {
  let temporaryPath: string | undefined;
  try {
    await operations.createDirectory(dirname(path));
    temporaryPath = operations.temporaryPath(path);
    await operations.write(temporaryPath, contents);
    await operations.move(temporaryPath, path);
  } catch (cause) {
    const failure = exportFailure("write", `Drever could not write the PDF to ${path}.`, cause, {
      path,
      ...(temporaryPath === undefined ? {} : { temporaryPath }),
    });
    if (temporaryPath !== undefined) {
      try {
        await operations.remove(temporaryPath);
      } catch (cleanupCause) {
        throw appendSuppressedFailure(
          failure,
          exportFailure(
            "cleanup",
            `Drever could not remove the incomplete PDF at ${temporaryPath}.`,
            cleanupCause,
            { path: temporaryPath },
          ),
        );
      }
    }
    throw failure;
  }
};

export const exportPdf = async ({
  output,
  project,
  slides,
  steps,
}: PdfExportRequest): Promise<void> => {
  const canvas = project.config.canvas ?? project.plan.theme.canvas ?? DEFAULT_CANVAS;
  const { stage } = resolvePrivateAppOptions(project.config, project.root);
  const app = await createPrivateExportApp(project.entry, {
    canvas,
    ...(project.config.deck === undefined ? {} : { deck: project.config.deck }),
    includeSteps: steps,
    ...(stage === undefined ? {} : { stage }),
  });
  const contents = await runWithCleanup(
    async () => {
      const build = await buildDreverExportApp(project, app.root);
      validatePdfSlideSelection(slides, build.manifest.slides.length);
      const server = await startPreview(app.root, build.outDir);
      return runWithCleanup(
        async () => {
          const browser = await launchBrowser();
          return runWithCleanup(
            async () => {
              const locale = resolveBrowserLocale(project.config.deck?.lang);
              const context = await browser.newContext({
                deviceScaleFactor: 1,
                ...(locale === undefined ? {} : { locale }),
                reducedMotion: "no-preference",
                timezoneId: "UTC",
                viewport: { height: canvas.height, width: canvas.width },
              });
              const page = await context.newPage();
              await page.emulateMedia({ media: "screen", reducedMotion: "no-preference" });
              await waitForExport(page, previewUrl(server));
              await applyPdfSlideSelection(page, slides);
              return runWithCleanup(
                async () => capturePdf(page, await readDocumentMetadata(page)),
                async () => destroyExport(page),
              );
            },
            async () => releaseResource("the Chromium browser", () => browser.close()),
          );
        },
        async () => releaseResource("the temporary preview server", () => server.close()),
      );
    },
    async () => releaseResource("the temporary export application", app.dispose),
  );
  await writePdf(output, contents);
};

import type { MDXComponents, MDXContent } from "@drever/core";
import type { CanvasDefinition, DeckManifest } from "@drever/schema";
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DreverClientError } from "./client-error.ts";
import { ExportHost } from "./export-document.tsx";
import { serializeExportError } from "./export-error.ts";
import { planExportPages, type ExportPage, type ExportPagePlanOptions } from "./export-pages.ts";
import { waitForExportReadiness } from "./export-readiness.ts";
import { createPresentationStateMachine } from "./presentation-state.ts";
import {
  abortReason,
  createReporter,
  destroyedReason,
  disposalFailure,
  isSignalAbort,
  reportCleanupFailures,
  setupFailure,
  validateDisposer,
  type Awaitable,
  type RuntimeDisposer,
} from "./runtime-lifecycle.ts";
import { releaseLateAcquisition } from "./viewer-lifecycle.ts";

export type ExportRuntime = Readonly<{
  format: "pdf";
  container: Element;
  document: Document;
  manifest: DeckManifest;
  pages: readonly ExportPage[];
  reportError(error: unknown): void;
  signal: AbortSignal;
}>;

export type ExportSetupRunner = (runtime: ExportRuntime) => Awaitable<void | RuntimeDisposer>;

export type CreateExportOptions = ExportPagePlanOptions &
  Readonly<{
    Content: MDXContent;
    canvas?: CanvasDefinition;
    container: Element;
    manifest: DeckManifest;
    onError?: (error: unknown) => void;
    registry?: MDXComponents;
    runExportSetup?: ExportSetupRunner;
    signal?: AbortSignal;
  }>;

export type ExportHandle = Readonly<{
  destroy(): Promise<void>;
  pages: readonly ExportPage[];
}>;

const markExportLoading = (document: Document): void => {
  document.documentElement.dataset.dreverExportStatus = "loading";
  delete document.documentElement.dataset.dreverExportError;
};

const markExportReady = (document: Document): void => {
  document.documentElement.dataset.dreverExportStatus = "ready";
  delete document.documentElement.dataset.dreverExportError;
};

const markExportFailed = (document: Document, error: unknown): void => {
  document.documentElement.dataset.dreverExportStatus = "failed";
  document.documentElement.dataset.dreverExportError = serializeExportError(error);
};

/** Mounts a raw multi-page document and resolves only when PDF capture is deterministic. */
export const createExport = async (options: CreateExportOptions): Promise<ExportHandle> => {
  if (options.signal?.aborted === true) {
    throw abortReason(options.signal);
  }

  const document = options.container.ownerDocument;
  const report = createReporter(options.onError);
  const lifetime = new AbortController();
  let reactRoot: Root | undefined;
  let setupDisposer: RuntimeDisposer | undefined;
  let setupPromise: Promise<void | RuntimeDisposer> | undefined;
  let destroyPromise: Promise<void> | undefined;
  let fatalRenderError: unknown;

  markExportLoading(document);

  const destroyWithReason = (reason: unknown): Promise<void> => {
    if (destroyPromise !== undefined) {
      return destroyPromise;
    }
    destroyPromise = (async () => {
      if (!lifetime.signal.aborted) {
        lifetime.abort(reason);
      }
      options.signal?.removeEventListener("abort", onExternalAbort);

      const errors: unknown[] = [];
      if (reactRoot !== undefined) {
        const root = reactRoot;
        reactRoot = undefined;
        try {
          root.unmount();
        } catch (error) {
          errors.push(error);
        }
      }
      if (setupDisposer !== undefined) {
        const dispose = setupDisposer;
        setupDisposer = undefined;
        try {
          await dispose();
        } catch (error) {
          errors.push(error);
        }
      } else if (setupPromise !== undefined) {
        const acquisition = setupPromise;
        setupPromise = undefined;
        releaseLateAcquisition({
          acquisition,
          onAcquisitionError(error) {
            if (!isSignalAbort(error, lifetime.signal)) {
              report(error instanceof DreverClientError ? error : setupFailure(error));
            }
          },
          onDisposalError: (error) => report(disposalFailure(error)),
          resolveDisposer: validateDisposer,
        });
      }
      if (errors.length > 0) {
        reportCleanupFailures(errors);
      }
    })();
    return destroyPromise;
  };

  const onExternalAbort = (): void => {
    const reason = abortReason(options.signal as AbortSignal);
    markExportFailed(document, reason);
    void destroyWithReason(reason).catch(report);
  };
  options.signal?.addEventListener("abort", onExternalAbort, { once: true });

  const aborted = new Promise<never>((_resolve, reject) => {
    lifetime.signal.addEventListener("abort", () => reject(abortReason(lifetime.signal)), {
      once: true,
    });
  });
  const mounted = Promise.withResolvers<void>();

  try {
    const machine = createPresentationStateMachine(options.manifest);
    const manifest = machine.manifest;
    const pages = planExportPages(manifest, { includeSteps: options.includeSteps ?? false });

    reactRoot = createRoot(options.container, {
      onRecoverableError: report,
      onUncaughtError(error) {
        fatalRenderError = error;
        markExportFailed(document, error);
        mounted.reject(error);
        void destroyWithReason(error)
          .catch(report)
          .then(() => report(error));
      },
    });
    reactRoot.render(
      <StrictMode>
        <ExportHost
          Content={options.Content}
          {...(options.canvas === undefined ? {} : { canvas: options.canvas })}
          onMounted={mounted.resolve}
          pages={pages}
          {...(options.registry === undefined ? {} : { registry: options.registry })}
        />
      </StrictMode>,
    );
    await Promise.race([mounted.promise, aborted]);
    if (lifetime.signal.aborted) {
      throw abortReason(lifetime.signal);
    }

    const runtime: ExportRuntime = Object.freeze({
      format: "pdf",
      container: options.container,
      document,
      manifest,
      pages,
      reportError: report,
      signal: lifetime.signal,
    });
    if (options.runExportSetup !== undefined) {
      setupPromise = Promise.resolve().then(() => options.runExportSetup?.(runtime));
      try {
        setupDisposer = validateDisposer(await Promise.race([setupPromise, aborted]));
        setupPromise = undefined;
      } catch (error) {
        if (!isSignalAbort(error, lifetime.signal)) {
          setupPromise = undefined;
        }
        throw error;
      }
    }

    await Promise.race([
      waitForExportReadiness(options.container, document, lifetime.signal),
      aborted,
    ]);
    if (lifetime.signal.aborted) {
      throw abortReason(lifetime.signal);
    }

    markExportReady(document);
    return Object.freeze({
      async destroy() {
        try {
          await destroyWithReason(destroyedReason("export"));
        } catch (error) {
          markExportFailed(document, error);
          throw error;
        }
      },
      pages,
    });
  } catch (error) {
    const shouldReport = !isSignalAbort(error, lifetime.signal) && error !== fatalRenderError;
    markExportFailed(document, error);
    try {
      await destroyWithReason(error);
    } catch (cleanupError) {
      report(cleanupError);
    }
    if (shouldReport) {
      report(error);
    }
    throw error;
  }
};

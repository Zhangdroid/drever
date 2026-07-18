import type { MDXComponents, MDXContent } from "@drever/core";
import type { CanvasDefinition, DeckManifest } from "@drever/schema";
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ViewerRuntimeModule } from "./create-viewer.tsx";
import { DocumentHost } from "./document-view.tsx";
import { createPresentationRouteCodec } from "./presentation-route.ts";
import { createPresentationStateMachine } from "./presentation-state.ts";
import {
  abortReason,
  createReporter,
  destroyedReason,
  disposalFailure,
} from "./runtime-lifecycle.ts";

export type CreateDocumentOptions = Readonly<{
  baseURL: string | URL;
  Content: MDXContent;
  canvas?: CanvasDefinition;
  container: Element;
  manifest: DeckManifest;
  onError?: (error: unknown) => void;
  registry?: MDXComponents;
  runtime?: Pick<ViewerRuntimeModule, "theme">;
  signal?: AbortSignal;
}>;

export type DocumentHandle = Readonly<{
  destroy(): Promise<void>;
}>;

/** Mounts the fully revealed, scrollable presentation document. */
export const createDocument = async (options: CreateDocumentOptions): Promise<DocumentHandle> => {
  if (options.signal?.aborted === true) {
    throw abortReason(options.signal);
  }

  const report = createReporter(options.onError);
  const machine = createPresentationStateMachine(options.manifest);
  const manifest = machine.manifest;
  const documentURL = new URL(options.container.ownerDocument.URL);
  const baseURL = new URL(options.baseURL, documentURL);
  const initialSlideId = decodeURIComponent(documentURL.hash.slice(1));
  const initialSlide = manifest.slides.find(({ id }) => id === initialSlideId);
  const audienceSourceURL = new URL(documentURL);
  audienceSourceURL.hash = "";
  const audienceURL = createPresentationRouteCodec({ baseURL, machine }).encodeURL(
    initialSlide === undefined
      ? machine.initialPosition
      : Object.freeze({ slideId: initialSlide.id, slideIndex: initialSlide.index, step: 0 }),
    audienceSourceURL,
  ).href;
  const canvas = options.canvas ?? options.runtime?.theme?.canvas;
  const lifetime = new AbortController();
  const mounted = Promise.withResolvers<void>();
  let destroyPromise: Promise<void> | undefined;
  let fatalRenderError: unknown;
  let reactRoot: Root | undefined;

  const destroyWithReason = (reason: unknown): Promise<void> => {
    destroyPromise ??= (async () => {
      if (!lifetime.signal.aborted) {
        lifetime.abort(reason);
      }
      options.signal?.removeEventListener("abort", onExternalAbort);
      if (reactRoot === undefined) {
        return;
      }
      const root = reactRoot;
      reactRoot = undefined;
      try {
        root.unmount();
      } catch (error) {
        throw disposalFailure(error);
      }
    })();
    return destroyPromise;
  };

  const onExternalAbort = (): void => {
    void destroyWithReason(abortReason(options.signal as AbortSignal)).catch(report);
  };
  options.signal?.addEventListener("abort", onExternalAbort, { once: true });

  const aborted = new Promise<never>((_resolve, reject) => {
    lifetime.signal.addEventListener("abort", () => reject(abortReason(lifetime.signal)), {
      once: true,
    });
  });

  try {
    reactRoot = createRoot(options.container, {
      onRecoverableError: report,
      onUncaughtError(error) {
        fatalRenderError = error;
        mounted.reject(error);
        report(error);
        void destroyWithReason(error).catch(report);
      },
    });
    reactRoot.render(
      <StrictMode>
        <DocumentHost
          audienceURL={audienceURL}
          Content={options.Content}
          {...(canvas === undefined ? {} : { canvas })}
          documentURL={documentURL.href}
          manifest={manifest}
          onMounted={mounted.resolve}
          {...(options.registry === undefined ? {} : { registry: options.registry })}
        />
      </StrictMode>,
    );
    await Promise.race([mounted.promise, aborted]);
    if (lifetime.signal.aborted) {
      throw abortReason(lifetime.signal);
    }
    if (initialSlide !== undefined) {
      options.container.ownerDocument
        .getElementById(initialSlide.id)
        ?.scrollIntoView({ block: "start", inline: "nearest" });
    }

    return Object.freeze({
      destroy: () => destroyWithReason(destroyedReason("document view")),
    });
  } catch (error) {
    if (error !== fatalRenderError && !lifetime.signal.aborted) {
      report(error);
    }
    try {
      await destroyWithReason(error);
    } catch (cleanupError) {
      report(cleanupError);
    }
    throw error;
  }
};

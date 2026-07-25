import { DreverClientError } from "./client-error.ts";
import { abortReason } from "./runtime-lifecycle.ts";

const awaitWithSignal = <Value>(value: PromiseLike<Value>, signal: AbortSignal): Promise<Value> => {
  if (signal.aborted) {
    return Promise.reject(abortReason(signal));
  }

  return new Promise<Value>((resolve, reject) => {
    let settled = false;
    const settle = (callback: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      signal.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = (): void => settle(() => reject(abortReason(signal)));
    signal.addEventListener("abort", onAbort, { once: true });
    void Promise.resolve(value).then(
      (result) => settle(() => resolve(result)),
      (error: unknown) => settle(() => reject(error)),
    );
  });
};

const imageFailure = (image: HTMLImageElement): DreverClientError =>
  new DreverClientError(
    "DREVER_CLIENT_EXPORT_IMAGE_FAILED",
    `Image "${image.currentSrc || image.src}" failed to load for PDF export.`,
    { details: { source: image.currentSrc || image.src } },
  );

const fontFailure = (font: FontFace): DreverClientError =>
  new DreverClientError(
    "DREVER_CLIENT_EXPORT_FONT_FAILED",
    `Font family "${font.family}" failed to load for PDF export.`,
    { details: { family: font.family, style: font.style, weight: font.weight } },
  );

const waitForFonts = async (document: Document, signal: AbortSignal): Promise<void> => {
  const fonts = await awaitWithSignal(document.fonts.ready, signal);
  const failed = Array.from(fonts).find((font) => font.status === "error");
  if (failed !== undefined) {
    throw fontFailure(failed);
  }
};

const waitForImageLoad = (image: HTMLImageElement, signal: AbortSignal): Promise<void> => {
  if (image.complete) {
    return image.naturalWidth === 0 ? Promise.reject(imageFailure(image)) : Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const clean = (): void => {
      image.removeEventListener("error", onError);
      image.removeEventListener("load", onLoad);
      signal.removeEventListener("abort", onAbort);
    };
    const onAbort = (): void => {
      clean();
      reject(abortReason(signal));
    };
    const onError = (): void => {
      clean();
      reject(imageFailure(image));
    };
    const onLoad = (): void => {
      clean();
      if (image.naturalWidth === 0) {
        reject(imageFailure(image));
        return;
      }
      resolve();
    };

    image.addEventListener("error", onError, { once: true });
    image.addEventListener("load", onLoad, { once: true });
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
    }
  });
};

const waitForImages = async (container: Element, signal: AbortSignal): Promise<void> => {
  const images = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    images.map(async (image) => {
      image.loading = "eager";
      await waitForImageLoad(image, signal);
      await awaitWithSignal(image.decode(), signal);
    }),
  );
};

const EXPORT_ANIMATION_EPSILON = 0.001;

const exportAnimationTime = (effect: AnimationEffect): number => {
  const { endTime } = effect.getComputedTiming();
  if (typeof endTime === "number" && Number.isFinite(endTime)) {
    return Math.max(0, endTime);
  }

  const { delay, duration } = effect.getTiming();
  const resolvedDelay = typeof delay === "number" && Number.isFinite(delay) ? delay : 0;
  const resolvedDuration =
    typeof duration === "number" && Number.isFinite(duration) ? Math.max(0, duration) : 0;
  if (resolvedDuration === 0) {
    return Math.max(0, resolvedDelay);
  }
  return Math.max(
    0,
    resolvedDelay + resolvedDuration - Math.min(EXPORT_ANIMATION_EPSILON, resolvedDuration / 2),
  );
};

/** Materializes one deterministic animation endpoint without firing a live export loop. */
export const settleExportAnimation = (animation: Animation): void => {
  const { effect } = animation;
  animation.pause();
  if (effect === null) {
    return;
  }
  effect.updateTiming({ fill: "both" });
  animation.currentTime = exportAnimationTime(effect);
};

const settleExportAnimations = (container: Element): void => {
  for (const animation of container.getAnimations({ subtree: true })) {
    settleExportAnimation(animation);
  }
};

const assertUniqueIds = (container: Element): void => {
  const ids = new Set<string>();
  for (const element of container.querySelectorAll<HTMLElement>("[id]")) {
    const { id } = element;
    if (id.length === 0) {
      continue;
    }
    if (ids.has(id)) {
      throw new DreverClientError(
        "DREVER_CLIENT_EXPORT_ID_DUPLICATE",
        `PDF export contains duplicate id "${id}" across rendered pages.`,
        { details: { id } },
      );
    }
    ids.add(id);
  }
};

const waitForAnimationFrame = (document: Document, signal: AbortSignal): Promise<void> => {
  const view = document.defaultView;
  if (view === null) {
    throw new DreverClientError(
      "DREVER_CLIENT_EXPORT_DOCUMENT_DETACHED",
      "PDF export requires a document attached to a Window.",
    );
  }

  return new Promise<void>((resolve, reject) => {
    const onAbort = (): void => {
      view.cancelAnimationFrame(frame);
      signal.removeEventListener("abort", onAbort);
      reject(abortReason(signal));
    };
    const frame = view.requestAnimationFrame(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    });
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
    }
  });
};

/** Waits only on resources and render commits that can be observed deterministically. */
export const waitForExportReadiness = async (
  container: Element,
  document: Document,
  signal: AbortSignal,
): Promise<void> => {
  await Promise.all([waitForFonts(document, signal), waitForImages(container, signal)]);
  settleExportAnimations(container);
  await waitForAnimationFrame(document, signal);
  settleExportAnimations(container);
  await waitForAnimationFrame(document, signal);
  assertUniqueIds(container);
};

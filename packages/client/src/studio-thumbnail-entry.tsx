import type { MDXComponents, MDXContent } from "@drever/core";
import type { CanvasDefinition, DeckManifest, PlannedTheme } from "@drever/schema";
import { StrictMode, useLayoutEffect, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createPresentationStateMachine } from "./presentation-state.ts";
import { createReporter, disposalFailure } from "./runtime-lifecycle.ts";
import type { StageComponents } from "./stage.tsx";
import { StudioThumbnail, type StudioThumbnailProps } from "./studio-thumbnail.tsx";
import { scheduleStableMountNotification } from "./viewer-lifecycle.ts";

export type CreateStudioThumbnailOptions = Readonly<{
  Content: MDXContent;
  canvas?: CanvasDefinition;
  container: Element;
  manifest: DeckManifest;
  onError?: (error: unknown) => void;
  registry?: MDXComponents;
  runtime?: Readonly<{ theme?: PlannedTheme }>;
  slideIndex: number;
  stage?: StageComponents;
}>;

export type StudioThumbnailHandle = Readonly<{
  destroy(): Promise<void>;
}>;

type StudioThumbnailHostProps = StudioThumbnailProps &
  Readonly<{
    onMounted(): void;
  }>;

const StudioThumbnailHost = ({ onMounted, ...props }: StudioThumbnailHostProps): ReactElement => {
  useLayoutEffect(() => scheduleStableMountNotification(onMounted), [onMounted]);
  return <StudioThumbnail {...props} />;
};

/** @internal Mounts one inert, final-step slide preview for the local Studio. */
export const createStudioThumbnail = async ({
  container,
  manifest: authoredManifest,
  onError,
  runtime,
  slideIndex,
  ...props
}: CreateStudioThumbnailOptions): Promise<StudioThumbnailHandle> => {
  const manifest = createPresentationStateMachine(authoredManifest).manifest;
  if (!Number.isSafeInteger(slideIndex) || slideIndex < 0 || slideIndex >= manifest.slides.length) {
    throw new RangeError(`Drever cannot render thumbnail slide ${String(slideIndex + 1)}.`);
  }

  const mounted = Promise.withResolvers<void>();
  const report = createReporter(onError);
  let root: Root | undefined;
  let destroyPromise: Promise<void> | undefined;
  let fatalRenderError: unknown;

  const destroy = (): Promise<void> => {
    destroyPromise ??= (async () => {
      if (root === undefined) return;
      const activeRoot = root;
      root = undefined;
      try {
        activeRoot.unmount();
      } catch (error) {
        throw disposalFailure(error);
      }
    })();
    return destroyPromise;
  };

  try {
    root = createRoot(container, {
      onRecoverableError: report,
      onUncaughtError(error) {
        fatalRenderError = error;
        mounted.reject(error);
        report(error);
        void destroy().catch(report);
      },
    });
    root.render(
      <StrictMode>
        <StudioThumbnailHost
          {...props}
          {...(props.canvas === undefined && runtime?.theme?.canvas !== undefined
            ? { canvas: runtime.theme.canvas }
            : {})}
          manifest={manifest}
          onMounted={mounted.resolve}
          onRenderError={report}
          slideIndex={slideIndex}
          {...(runtime?.theme === undefined ? {} : { theme: runtime.theme })}
        />
      </StrictMode>,
    );
    await mounted.promise;
  } catch (error) {
    if (error !== fatalRenderError) report(error);
    try {
      await destroy();
    } catch (cleanupError) {
      report(cleanupError);
    }
    throw error;
  }

  return Object.freeze({ destroy });
};

export { StudioThumbnail } from "./studio-thumbnail.tsx";
export type { StudioThumbnailProps } from "./studio-thumbnail.tsx";

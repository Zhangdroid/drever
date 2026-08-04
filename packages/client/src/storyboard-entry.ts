import { createElement, StrictMode, useLayoutEffect, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import "../storyboard.css";
import { createReporter, disposalFailure } from "./runtime-lifecycle.ts";
import { Storyboard, type StoryboardState } from "./storyboard.tsx";
import { scheduleStableMountNotification } from "./viewer-lifecycle.ts";

export { Storyboard } from "./storyboard.tsx";
export type {
  StoryboardDiagnostic,
  StoryboardProps,
  StoryboardState,
  StoryboardStatus,
} from "./storyboard.tsx";

export type CreateStoryboardOptions = Readonly<{
  container: Element;
  onError?: (error: unknown) => void;
  state: StoryboardState;
}>;

export type StoryboardHandle = Readonly<{
  destroy(): Promise<void>;
  update(state: StoryboardState): void;
}>;

type StoryboardHostProps = Readonly<{
  onMounted(): void;
  state: StoryboardState;
}>;

const StoryboardHost = ({ onMounted, state }: StoryboardHostProps): ReactElement => {
  useLayoutEffect(() => scheduleStableMountNotification(onMounted), [onMounted]);
  return createElement(Storyboard, { state });
};

/** Mounts the development-only storyboard without loading the presentation runtime. */
export const createStoryboard = async ({
  container,
  onError,
  state: initialState,
}: CreateStoryboardOptions): Promise<StoryboardHandle> => {
  const mounted = Promise.withResolvers<void>();
  const report = createReporter(onError);
  let currentRevision = initialState.revision;
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

  const render = (state: StoryboardState): void => {
    if (root === undefined) throw new TypeError("Cannot update a destroyed Drever storyboard.");
    root.render(
      createElement(
        StrictMode,
        undefined,
        createElement(StoryboardHost, { onMounted: mounted.resolve, state }),
      ),
    );
  };

  const update = (state: StoryboardState): void => {
    if (root === undefined) throw new TypeError("Cannot update a destroyed Drever storyboard.");
    if (state.revision < currentRevision) return;
    currentRevision = state.revision;
    render(state);
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
    render(initialState);
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

  return Object.freeze({
    destroy,
    update,
  });
};

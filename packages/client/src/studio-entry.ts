import { type DreverStudioActionAck, type DreverStudioState } from "@drever/schema";
import { createElement, StrictMode, useLayoutEffect, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DreverClientError } from "./client-error.ts";
import { createReporter, disposalFailure } from "./runtime-lifecycle.ts";
import { Studio, type StudioActionInput } from "./studio.tsx";
import { scheduleStableMountNotification } from "./viewer-lifecycle.ts";

export { Studio } from "./studio.tsx";
export type { StudioActionInput, StudioProps } from "./studio.tsx";

export type CreateStudioOptions = Readonly<{
  audienceUrl: string | URL;
  container: Element;
  onAction(action: StudioActionInput): Promise<DreverStudioActionAck>;
  onError?: (error: unknown) => void;
  previewUrl?: string | URL;
  state: DreverStudioState;
}>;

export type StudioHandle = Readonly<{
  destroy(): Promise<void>;
  update(state: DreverStudioState): void;
}>;

type StudioHostProps = Readonly<{
  audienceUrl: string;
  onAction(action: StudioActionInput): Promise<void>;
  onMounted(): void;
  previewUrl?: string;
  state: DreverStudioState;
}>;

const StudioHost = ({
  audienceUrl,
  onAction,
  onMounted,
  previewUrl,
  state,
}: StudioHostProps): ReactElement => {
  useLayoutEffect(() => scheduleStableMountNotification(onMounted), [onMounted]);
  return createElement(Studio, {
    audienceUrl,
    onAction,
    ...(previewUrl === undefined ? {} : { previewUrl }),
    state,
  });
};

const rejectedAction = (ack: DreverStudioActionAck): DreverClientError =>
  new DreverClientError(
    ack.error?.code ?? "DREVER_STUDIO_ACTION_REJECTED",
    ack.error?.message ?? "Drever Studio rejected the action.",
  );

/** Mounts the development-only local Studio without adding code to the audience bundle. */
export const createStudio = async ({
  audienceUrl,
  container,
  onAction,
  onError,
  previewUrl,
  state: initialState,
}: CreateStudioOptions): Promise<StudioHandle> => {
  const mounted = Promise.withResolvers<void>();
  const report = createReporter(onError);
  let currentState = initialState;
  let actionQueue = Promise.resolve();
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

  const submit = (input: StudioActionInput): Promise<void> => {
    const task = actionQueue.then(async () => {
      const ack = await onAction(input);
      if (!ack.accepted) throw rejectedAction(ack);
    });
    actionQueue = task.catch(report);
    return task;
  };

  const render = (): void => {
    if (root === undefined) throw new TypeError("Cannot update a destroyed Drever Studio.");
    root.render(
      createElement(
        StrictMode,
        undefined,
        createElement(StudioHost, {
          audienceUrl: new URL(audienceUrl).href,
          onAction: submit,
          onMounted: mounted.resolve,
          ...(previewUrl === undefined ? {} : { previewUrl: new URL(previewUrl).href }),
          state: currentState,
        }),
      ),
    );
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
    render();
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
    update(state) {
      currentState = state;
      render();
    },
  });
};

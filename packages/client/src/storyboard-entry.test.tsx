import { DREVER_DECK_PLAN_VERSION } from "@drever/schema";
import { isValidElement, StrictMode, type ReactNode } from "react";
import type { Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createStoryboard, type StoryboardState } from "./storyboard-entry.ts";

const dependencies = vi.hoisted(() => ({
  createRoot: vi.fn(),
}));

vi.mock("react-dom/client", () => ({ createRoot: dependencies.createRoot }));

const initialState = {
  diagnostics: [],
  plan: { version: DREVER_DECK_PLAN_VERSION, status: "awaiting-input" },
  revision: 2,
  status: "waiting",
} as const satisfies StoryboardState;

const updatedState = {
  diagnostics: [],
  revision: 3,
  status: "missing",
} as const satisfies StoryboardState;

type HostProps = Readonly<{
  onMounted(): void;
  state: StoryboardState;
}>;

const hostPropsFrom = (node: ReactNode): HostProps => {
  if (!isValidElement<{ children: ReactNode }>(node) || node.type !== StrictMode) {
    throw new Error("createStoryboard must render a React StrictMode boundary.");
  }
  const host = node.props.children;
  if (!isValidElement<HostProps>(host)) {
    throw new Error("createStoryboard must render a storyboard host inside StrictMode.");
  }
  return host.props;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createStoryboard", () => {
  it("mounts, updates serializable state, and owns idempotent teardown", async () => {
    const renderedStates: StoryboardState[] = [];
    const unmount = vi.fn();
    const root: Root = {
      render(node) {
        const props = hostPropsFrom(node);
        renderedStates.push(props.state);
        queueMicrotask(props.onMounted);
      },
      unmount,
    };
    dependencies.createRoot.mockReturnValue(root);

    const handle = await createStoryboard({
      container: {} as Element,
      state: initialState,
    });
    handle.update({ ...updatedState, revision: 1 });
    handle.update(updatedState);

    expect(renderedStates).toEqual([initialState, updatedState]);
    await Promise.all([handle.destroy(), handle.destroy()]);
    expect(unmount).toHaveBeenCalledOnce();
    expect(() => handle.update(initialState)).toThrow(
      "Cannot update a destroyed Drever storyboard.",
    );
  });

  it("reports an initial fatal render once and releases the root", async () => {
    const error = new Error("Storyboard render failed.");
    const onError = vi.fn();
    const unmount = vi.fn();
    dependencies.createRoot.mockImplementation(
      (_container: Element, callbacks: Readonly<{ onUncaughtError(error: unknown): void }>) =>
        ({
          render() {
            callbacks.onUncaughtError(error);
          },
          unmount,
        }) as Root,
    );

    await expect(
      createStoryboard({ container: {} as Element, onError, state: initialState }),
    ).rejects.toBe(error);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(error);
    expect(unmount).toHaveBeenCalledOnce();
  });

  it("forwards recoverable React errors without interrupting the surface", async () => {
    const recoverable = new Error("Hydration recovered.");
    const onError = vi.fn();
    dependencies.createRoot.mockImplementation(
      (_container: Element, callbacks: Readonly<{ onRecoverableError(error: unknown): void }>) =>
        ({
          render(node: ReactNode) {
            callbacks.onRecoverableError(recoverable);
            queueMicrotask(hostPropsFrom(node).onMounted);
          },
          unmount() {},
        }) as Root,
    );

    const handle = await createStoryboard({
      container: {} as Element,
      onError,
      state: initialState,
    });

    expect(onError).toHaveBeenCalledWith(recoverable);
    await handle.destroy();
  });
});

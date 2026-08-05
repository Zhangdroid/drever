import {
  DREVER_STUDIO_PROTOCOL_VERSION,
  type DreverStudioActionAck,
  type DreverStudioState,
} from "@drever/schema";
import { isValidElement, StrictMode, type ReactNode } from "react";
import type { Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createStudio, type CreateStudioOptions, type StudioActionInput } from "./studio-entry.ts";

const dependencies = vi.hoisted(() => ({ createRoot: vi.fn() }));

vi.mock("react-dom/client", () => ({ createRoot: dependencies.createRoot }));

const initialState = {
  version: DREVER_STUDIO_PROTOCOL_VERSION,
  revision: 0,
  phase: "briefing",
  agentConnected: false,
  latestActionRevision: 0,
  pendingActionCount: 0,
} as const satisfies DreverStudioState;

type HostProps = Readonly<{
  onAction(action: StudioActionInput): Promise<void>;
  onMounted(): void;
  state: DreverStudioState;
}>;

const hostPropsFrom = (node: ReactNode): HostProps => {
  if (!isValidElement<{ children: ReactNode }>(node) || node.type !== StrictMode) {
    throw new Error("createStudio must render a React StrictMode boundary.");
  }
  const host = node.props.children;
  if (!isValidElement<HostProps>(host)) {
    throw new Error("createStudio must render a Studio host inside StrictMode.");
  }
  return host.props;
};

const accepted = (revision: number): DreverStudioActionAck => ({
  version: DREVER_STUDIO_PROTOCOL_VERSION,
  requestId: `accepted-${String(revision)}`,
  accepted: true,
  revision,
});

beforeEach(() => vi.clearAllMocks());

describe("createStudio", () => {
  it("serializes consecutive browser actions and owns idempotent teardown", async () => {
    const roots: HostProps[] = [];
    const unmount = vi.fn();
    dependencies.createRoot.mockReturnValue({
      render(node: ReactNode) {
        const props = hostPropsFrom(node);
        roots.push(props);
        queueMicrotask(props.onMounted);
      },
      unmount,
    } as Root);
    const onAction = vi
      .fn<CreateStudioOptions["onAction"]>()
      .mockResolvedValueOnce(accepted(1))
      .mockResolvedValueOnce(accepted(2));
    const handle = await createStudio({
      audienceUrl: "http://127.0.0.1:4317/",
      container: {} as Element,
      onAction,
      state: initialState,
    });
    const submit = roots[0]?.onAction;
    if (submit === undefined) throw new Error("Studio action bridge was not rendered.");

    await Promise.all([
      submit({ brief: { topic: "A useful topic" }, type: "submit-common-brief" }),
      submit({ type: "skip-remaining-questions" }),
    ]);

    expect(onAction.mock.calls.map(([action]) => action.type)).toEqual([
      "submit-common-brief",
      "skip-remaining-questions",
    ]);
    await Promise.all([handle.destroy(), handle.destroy()]);
    expect(unmount).toHaveBeenCalledOnce();
  });

  it("surfaces a rejected action with its structured Studio error", async () => {
    const onAction = vi.fn<CreateStudioOptions["onAction"]>().mockResolvedValue({
      version: DREVER_STUDIO_PROTOCOL_VERSION,
      requestId: "rejected-1",
      accepted: false,
      revision: 0,
      error: { code: "DREVER_STUDIO_TOPIC_REQUIRED", message: "Choose a topic first." },
    });
    let submit: HostProps["onAction"] | undefined;
    dependencies.createRoot.mockReturnValue({
      render(node: ReactNode) {
        const props = hostPropsFrom(node);
        submit = props.onAction;
        queueMicrotask(props.onMounted);
      },
      unmount() {},
    } as Root);
    const onError = vi.fn();
    const handle = await createStudio({
      audienceUrl: "http://127.0.0.1:4317/",
      container: {} as Element,
      onAction,
      onError,
      state: initialState,
    });

    await expect(submit?.({ type: "skip-remaining-questions" })).rejects.toMatchObject({
      code: "DREVER_STUDIO_TOPIC_REQUIRED",
      message: "Choose a topic first.",
    });
    expect(onError).toHaveBeenCalledOnce();
    await handle.destroy();
  });
});

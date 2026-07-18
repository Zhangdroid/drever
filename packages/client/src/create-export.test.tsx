import type { MDXContent } from "@drever/core";
import { DECK_MANIFEST_VERSION, type DeckManifest } from "@drever/schema";
import { isValidElement, StrictMode, type ReactNode } from "react";
import type { Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { ExportHostProps } from "./export-document.tsx";
import { createExport, type ExportRuntime } from "./create-export.tsx";

const dependencies = vi.hoisted(() => ({
  createRoot: vi.fn(),
  ExportHost: vi.fn(() => null),
  waitForExportReadiness: vi.fn(),
}));

vi.mock("react-dom/client", () => ({ createRoot: dependencies.createRoot }));
vi.mock("./export-document.tsx", () => ({ ExportHost: dependencies.ExportHost }));
vi.mock("./export-readiness.ts", () => ({
  waitForExportReadiness: dependencies.waitForExportReadiness,
}));

const manifest = {
  version: DECK_MANIFEST_VERSION,
  slides: [
    { id: "intro", index: 0, speakerNotes: [], stepStops: [] },
    { id: "demo", index: 1, speakerNotes: [], stepStops: [2, 7] },
  ],
} as const satisfies DeckManifest;

const Content: MDXContent = () => null;

const hostPropsFrom = (node: ReactNode): ExportHostProps => {
  if (!isValidElement<{ children: ReactNode }>(node) || node.type !== StrictMode) {
    throw new Error("createExport must render a React StrictMode boundary.");
  }
  const host = node.props.children;
  if (!isValidElement<ExportHostProps>(host) || host.type !== dependencies.ExportHost) {
    throw new Error("createExport must render ExportHost inside StrictMode.");
  }
  return host.props;
};

const createHarness = () => {
  const dataset: DOMStringMap = {};
  const document = {
    documentElement: { dataset },
  } as unknown as Document;
  const container = { ownerDocument: document } as Element;
  let hostProps: ExportHostProps | undefined;
  const unmount = vi.fn();
  const root: Root = {
    render(node) {
      hostProps = hostPropsFrom(node);
      queueMicrotask(() => hostProps?.onMounted());
    },
    unmount,
  };
  dependencies.createRoot.mockReturnValue(root);
  dependencies.waitForExportReadiness.mockResolvedValue(undefined);
  return {
    container,
    dataset,
    document,
    get hostProps() {
      if (hostProps === undefined) {
        throw new Error("ExportHost has not been rendered.");
      }
      return hostProps;
    },
    unmount,
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createExport", () => {
  it("runs setup before readiness and disposes every acquired resource exactly once", async () => {
    const harness = createHarness();
    const events: string[] = [];
    const dispose = vi.fn(() => {
      events.push("setup:dispose");
    });
    const onError = vi.fn();
    let runtime: ExportRuntime | undefined;
    const runExportSetup = vi.fn((value: ExportRuntime) => {
      events.push("setup");
      runtime = value;
      return dispose;
    });
    dependencies.waitForExportReadiness.mockImplementation(async () => {
      events.push("readiness");
    });

    const creation = createExport({
      Content,
      container: harness.container,
      includeSteps: true,
      manifest,
      onError,
      runExportSetup,
    });
    expect(harness.dataset.dreverExportStatus).toBe("loading");

    const handle = await creation;
    expect(events).toEqual(["setup", "readiness"]);
    expect(harness.dataset.dreverExportStatus).toBe("ready");
    expect(harness.dataset.dreverExportError).toBeUndefined();
    expect(handle.pages).toEqual([
      { slideId: "intro", slideIndex: 0, step: 0 },
      { slideId: "demo", slideIndex: 1, step: 0 },
      { slideId: "demo", slideIndex: 1, step: 2 },
      { slideId: "demo", slideIndex: 1, step: 7 },
    ]);
    expect(harness.hostProps.pages).toBe(handle.pages);
    expect(Object.keys(runtime ?? {})).toEqual([
      "format",
      "container",
      "document",
      "manifest",
      "pages",
      "reportError",
      "signal",
    ]);
    expect(runtime).toMatchObject({
      format: "pdf",
      container: harness.container,
      document: harness.document,
      pages: handle.pages,
    });
    expect(Object.isFrozen(runtime)).toBe(true);

    const detachedFailure = new Error("Detached renderer failed");
    runtime?.reportError(detachedFailure);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(detachedFailure);
    expect(events).toEqual(["setup", "readiness"]);

    await Promise.all([handle.destroy(), handle.destroy()]);
    expect(harness.unmount).toHaveBeenCalledOnce();
    expect(dispose).toHaveBeenCalledOnce();
    expect(runtime?.signal.aborted).toBe(true);
    expect(events).toEqual(["setup", "readiness", "setup:dispose"]);
  });

  it("marks a failed destroy and preserves export-hook disposer context", async () => {
    const harness = createHarness();
    const lifecycleFailure = Object.assign(new Error("Chart cleanup failed"), {
      capability: "exportSetup",
      code: "DREVER_RUNTIME_DISPOSE_FAILED",
      owner: "charts",
      specifier: "@acme/charts/export",
    });
    const handle = await createExport({
      Content,
      container: harness.container,
      manifest,
      runExportSetup: () => async () => {
        throw lifecycleFailure;
      },
    });

    await expect(handle.destroy()).rejects.toMatchObject({
      code: "DREVER_CLIENT_DISPOSE_FAILED",
      cause: lifecycleFailure,
    });
    expect(harness.dataset.dreverExportStatus).toBe("failed");
    expect(JSON.parse(harness.dataset.dreverExportError ?? "null")).toMatchObject({
      capability: "exportSetup",
      code: "DREVER_CLIENT_DISPOSE_FAILED",
      owner: "charts",
      specifier: "@acme/charts/export",
    });
  });

  it("publishes a serializable failed marker with plugin lifecycle context", async () => {
    const harness = createHarness();
    const events: string[] = [];
    harness.unmount.mockImplementation(() => events.push("unmount"));
    const onError = vi.fn(() => events.push("report"));
    const failure = Object.assign(new Error("Chart preparation failed"), {
      capability: "exportSetup",
      code: "DREVER_RUNTIME_HOOK_FAILED",
      details: {
        capability: "exportSetup",
        owner: "charts",
        specifier: "@acme/charts/export",
        stage: "export",
      },
      owner: "charts",
      specifier: "@acme/charts/export",
    });

    await expect(
      createExport({
        Content,
        container: harness.container,
        manifest,
        onError,
        runExportSetup: async () => {
          throw failure;
        },
      }),
    ).rejects.toBe(failure);

    expect(harness.dataset.dreverExportStatus).toBe("failed");
    expect(JSON.parse(harness.dataset.dreverExportError ?? "null")).toMatchObject({
      message: "Chart preparation failed",
      code: "DREVER_RUNTIME_HOOK_FAILED",
      owner: "charts",
      capability: "exportSetup",
      specifier: "@acme/charts/export",
    });
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(failure);
    expect(dependencies.waitForExportReadiness).not.toHaveBeenCalled();
    expect(harness.unmount).toHaveBeenCalledOnce();
    expect(events).toEqual(["unmount", "report"]);
  });
});

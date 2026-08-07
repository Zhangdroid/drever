import type { MDXContent } from "@drever/core";
import { DECK_MANIFEST_VERSION, type DeckManifest, type PlannedTheme } from "@drever/schema";
import { isValidElement, StrictMode, type ReactNode } from "react";
import type { Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  createStudioThumbnail,
  StudioThumbnail,
  type StudioThumbnailProps,
} from "./studio-thumbnail-entry.tsx";
import { ViewerSurface } from "./viewer-surface.tsx";

const dependencies = vi.hoisted(() => ({
  createRoot: vi.fn(),
}));

vi.mock("react-dom/client", () => ({ createRoot: dependencies.createRoot }));

const manifest = {
  version: DECK_MANIFEST_VERSION,
  slides: [
    { id: "intro", index: 0, speakerNotes: [], stepStops: [], title: "Introduction" },
    { id: "details", index: 1, speakerNotes: [], stepStops: [1, 3], title: "Details" },
  ],
} as const satisfies DeckManifest;

const Content: MDXContent = () => null;
const theme = {
  id: "local.preview",
  canvas: { height: 900, width: 1_600 },
  manifest: { summary: "Local preview theme.", title: "Preview" },
  tokens: { color: { canvas: "#11131a", ink: "#f8f8f4" } },
} satisfies PlannedTheme;

type HostProps = StudioThumbnailProps & Readonly<{ onMounted(): void }>;

const hostPropsFrom = (node: ReactNode): HostProps => {
  if (!isValidElement<{ children: ReactNode }>(node) || node.type !== StrictMode) {
    throw new Error("createStudioThumbnail must render a React StrictMode boundary.");
  }
  const host = node.props.children;
  if (!isValidElement<HostProps>(host)) {
    throw new Error("createStudioThumbnail must render a thumbnail host inside StrictMode.");
  }
  return host.props;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("StudioThumbnail", () => {
  it("renders the requested slide at its final Step without interactive viewer behavior", () => {
    const thumbnail = StudioThumbnail({
      Content,
      manifest,
      slideIndex: 1,
      theme,
    });

    expect(thumbnail.type).toBe(ViewerSurface);
    expect(thumbnail.props).toMatchObject({
      Content,
      idPrefix: "drever-studio-thumbnail-2",
      manageFocus: false,
      manifest,
      position: { slideId: "details", slideIndex: 1, step: 3 },
      reducedMotion: true,
      renderMode: "export",
      theme,
    });
  });
});

describe("createStudioThumbnail", () => {
  it("uses the theme canvas, resolves after mount, and owns idempotent teardown", async () => {
    let hostProps: HostProps | undefined;
    const unmount = vi.fn();
    const root: Root = {
      render(node) {
        hostProps = hostPropsFrom(node);
        queueMicrotask(() => hostProps?.onMounted());
      },
      unmount,
    };
    dependencies.createRoot.mockReturnValue(root);

    const handle = await createStudioThumbnail({
      Content,
      container: {} as Element,
      manifest,
      runtime: { theme },
      slideIndex: 1,
    });

    expect(hostProps).toMatchObject({
      Content,
      canvas: theme.canvas,
      manifest,
      slideIndex: 1,
      theme,
    });
    await Promise.all([handle.destroy(), handle.destroy()]);
    expect(unmount).toHaveBeenCalledOnce();
  });

  it("rejects a thumbnail number outside the deck before mounting React", async () => {
    await expect(
      createStudioThumbnail({
        Content,
        container: {} as Element,
        manifest,
        slideIndex: 2,
      }),
    ).rejects.toThrow("Drever cannot render thumbnail slide 3.");
    expect(dependencies.createRoot).not.toHaveBeenCalled();
  });
});

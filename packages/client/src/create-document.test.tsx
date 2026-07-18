import type { MDXContent } from "@drever/core";
import { DECK_MANIFEST_VERSION, type DeckManifest } from "@drever/schema";
import { isValidElement, StrictMode, type ReactNode } from "react";
import type { Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createDocument } from "./create-document.tsx";
import type { DocumentHostProps } from "./document-view.tsx";

const dependencies = vi.hoisted(() => ({
  createRoot: vi.fn(),
  DocumentHost: vi.fn(() => null),
}));

vi.mock("react-dom/client", () => ({ createRoot: dependencies.createRoot }));
vi.mock("./document-view.tsx", () => ({ DocumentHost: dependencies.DocumentHost }));

const manifest = {
  version: DECK_MANIFEST_VERSION,
  slides: [
    { id: "intro", index: 0, speakerNotes: [], stepStops: [], title: "Introduction" },
    { id: "details", index: 1, speakerNotes: [], stepStops: [2], title: "Details" },
  ],
} as const satisfies DeckManifest;

const Content: MDXContent = () => null;

const hostPropsFrom = (node: ReactNode): DocumentHostProps => {
  if (!isValidElement<{ children: ReactNode }>(node) || node.type !== StrictMode) {
    throw new Error("createDocument must render a React StrictMode boundary.");
  }
  const host = node.props.children;
  if (!isValidElement<DocumentHostProps>(host) || host.type !== dependencies.DocumentHost) {
    throw new Error("createDocument must render DocumentHost inside StrictMode.");
  }
  return host.props;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createDocument", () => {
  it("resolves after a stable mount and owns idempotent teardown", async () => {
    const scrollIntoView = vi.fn();
    const container = {
      ownerDocument: {
        getElementById: vi.fn(() => ({ scrollIntoView })),
        URL: "https://slides.test/talk/document?theme=dark#details",
      },
    } as unknown as Element;
    let hostProps: DocumentHostProps | undefined;
    const unmount = vi.fn();
    const root: Root = {
      render(node) {
        hostProps = hostPropsFrom(node);
        queueMicrotask(() => hostProps?.onMounted());
      },
      unmount,
    };
    dependencies.createRoot.mockReturnValue(root);

    const handle = await createDocument({
      baseURL: "https://slides.test/talk",
      Content,
      container,
      manifest,
    });

    expect(hostProps).toMatchObject({
      audienceURL: "https://slides.test/talk/2?theme=dark",
      Content,
      documentURL: "https://slides.test/talk/document?theme=dark#details",
      manifest,
    });
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start", inline: "nearest" });
    await Promise.all([handle.destroy(), handle.destroy()]);
    expect(unmount).toHaveBeenCalledOnce();
  });
});

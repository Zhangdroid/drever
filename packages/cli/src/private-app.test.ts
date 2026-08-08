import { readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  createGeneratedApp,
  createPrivateApp,
  createPrivateDevApp,
  createPrivateExportApp,
} from "./private-app.ts";

const exportBootstrapSource = (html: string): string => {
  const match = html.match(/<script data-drever-export-bootstrap>(?<source>[\s\S]*?)<\/script>/u);
  const source = match?.groups?.source;
  if (source === undefined) {
    throw new TypeError("The generated export document is missing its bootstrap reporter.");
  }
  return source;
};

const browserSupportBootstrapSource = (html: string): string => {
  const match = html.match(/<script data-drever-browser-support>(?<source>[\s\S]*?)<\/script>/u);
  const source = match?.groups?.source;
  if (source === undefined) {
    throw new TypeError("The generated document is missing its browser support bootstrap.");
  }
  return source;
};

const studioPreviewBridgeSource = (source: string): string => {
  const start = source.indexOf("let stopStudioPreviewBridge;");
  const end = source.indexOf("\nif (import.meta.hot)", start);
  if (start < 0 || end < 0) {
    throw new TypeError("The generated viewer is missing its Studio preview bridge.");
  }
  return source.slice(start, end);
};

const runBrowserSupportBootstrap = (
  source: string,
  {
    documentViewTransition = true,
    navigation = true,
    navigationSignal = true,
  }: Readonly<{
    documentViewTransition?: boolean;
    navigation?: boolean;
    navigationSignal?: boolean;
  }> = {},
): Readonly<Record<string, string>> => {
  const attributes: Record<string, string> = {};
  class SupportedNavigateEvent {
    get signal(): object {
      return {};
    }
  }
  class UnsupportedNavigateEvent {}

  runInNewContext(source, {
    document: {
      documentElement: {
        setAttribute(name: string, value: string) {
          attributes[name] = value;
        },
      },
      startViewTransition: documentViewTransition ? () => undefined : undefined,
    },
    window: {
      BroadcastChannel: class {},
      NavigateEvent: navigationSignal ? SupportedNavigateEvent : UnsupportedNavigateEvent,
      ResizeObserver: class {},
      navigation: navigation
        ? {
            addEventListener: () => undefined,
            navigate: () => undefined,
            removeEventListener: () => undefined,
            updateCurrentEntry: () => undefined,
          }
        : undefined,
    },
  });

  return Object.freeze(attributes);
};

describe("generated private application", () => {
  it("keeps the storyboard bootstrap independent from the authored presentation graph", async () => {
    const initialTopic = 'A private "launch" & migration plan';
    const app = await createPrivateDevApp("/project/broken-slides.mdx", {
      previewCapability: "studio-capability",
    });
    try {
      const [entry, presentation] = await Promise.all([
        readFile(join(app.root, "entry.js"), "utf8"),
        readFile(join(app.root, "presentation.js"), "utf8"),
      ]);

      expect(entry).toContain('routePath === "storyboard"');
      expect(entry).toContain('routePath === "studio"');
      expect(entry).toContain('import("@drever/client/studio")');
      expect(entry).toContain('import("@drever/client/studio.css")');
      expect(entry).not.toContain("virtual:drever/studio-state");
      expect(entry).toContain("location.hash.slice(1)");
      expect(entry).toContain('studioAccess.get("access")');
      expect(entry).toContain('studioAccess.get("preview")');
      expect(entry).not.toContain('studioAccess.get("topic")');
      expect(entry).not.toContain("initialTopic");
      expect(entry).not.toContain(initialTopic);
      expect(entry).toContain("Open the exact Creation room URL printed by Drever.");
      expect(entry).toContain(
        'import.meta.hot.send("drever:studio-state-request", { token: studioToken })',
      );
      expect(entry).toContain("previewUrl: studioPreviewUrl");
      expect(entry).toContain('const studioPreviewCapability = "studio-capability";');
      expect(entry).toContain("previewCapability: studioPreviewCapability");
      expect(entry).not.toContain("previewCapability: studioToken");
      expect(entry).not.toContain("export const studioToken");
      expect(entry).toContain('import.meta.hot.send("drever:studio-action"');
      expect(entry).toContain('input.type === "respond-agent-approval"');
      expect(entry).toContain('input.type === "resume-pending"');
      expect(entry).toContain("approvalId: input.approvalId");
      expect(entry).toContain("if (!ack.accepted)");
      expect(entry).toContain("Drever Studio rejected the action.");
      expect(entry).toContain('import("@drever/client/storyboard")');
      expect(entry).toContain('import("@drever/client/storyboard.css")');
      expect(entry).toContain('import("virtual:drever/storyboard-plan")');
      expect(entry).toContain('import("./presentation.js")');
      expect(entry).toContain('const reloadKey = "drever:presentation-reload"');
      expect(entry).toContain('presentationURL.searchParams.set("drever-probe", String(attempt))');
      expect(entry).toContain("const transientStatuses = new Set([404, 502, 503, 504])");
      expect(entry).toContain('loadingStatus.textContent = "Rebuilding the draft"');
      expect(entry).toContain('globalThis.sessionStorage.setItem(reloadKey, "1")');
      expect(entry).toContain("globalThis.location.reload()");
      expect(entry).not.toContain("drever-retry");
      expect(entry).not.toContain("broken-slides.mdx");
      expect(entry).not.toContain("virtual:drever/runtime");
      expect(presentation).toContain('from "/project/broken-slides.mdx"');
      expect(presentation).toContain("virtual:drever/runtime");
      expect(presentation).toContain('"drever:studio-preview-connect"');
      expect(presentation).toContain('type: "drever:studio-preview-state"');
      expect(presentation).toContain("canvas: resolvedCanvas");
      expect(presentation).toContain('"drever:studio-preview-navigate"');
      expect(presentation).toContain('const studioPreviewCapability = "studio-capability";');
      expect(presentation).toContain(
        'import.meta.hot &&\n  typeof studioPreviewCapability === "string" &&\n  globalThis.parent !== globalThis',
      );
      expect(presentation).toContain("studioParentOrigin,");
    } finally {
      await app.dispose();
    }
  });

  it("routes canonical 1-based Studio thumbnail requests to an inert client surface", async () => {
    const app = await createPrivateDevApp("/project/slides.mdx", {
      canvas: { height: 900, width: 1_600 },
      previewCapability: "studio-capability",
    });
    try {
      const source = await readFile(join(app.root, "presentation.js"), "utf8");

      expect(source).toContain("import.meta.hot && true");
      expect(source).toContain('searchParams.get("drever-studio-thumbnail")');
      expect(source).toContain("String(studioThumbnailSlideNumber) !== studioThumbnailValue");
      expect(source).toContain(
        'throw new RangeError("The Drever Studio thumbnail must identify a 1-based slide number.")',
      );
      expect(source).toContain('await import("@drever/client/studio-thumbnail")');
      expect(source).toContain("slideIndex: studioThumbnailSlideNumber - 1");
      expect(source).toContain(
        "const resolvedCanvas = presentationOptions.canvas ?? theme?.canvas ?? { width: 1920, height: 1080 }",
      );
      expect(studioPreviewBridgeSource(source)).toContain("canvas: resolvedCanvas");
    } finally {
      await app.dispose();
    }
  });

  it("renders explicit document metadata in the initial HTML and escapes authored values", async () => {
    const app = await createPrivateApp("/project/slides.mdx", {
      deck: {
        title: "Research & <Design>",
        description: 'A "quoted" summary & result.',
        lang: "zh-CN",
        dir: "ltr",
        icon: "https://slides.test/deck-icon.svg?variant=one&size=32",
        url: "https://slides.test/research/",
        social: {
          image: "https://slides.test/cover.png?size=large&format=webp",
          imageAlt: "绿色封面 & diagram",
        },
      },
    });
    try {
      const [html, source] = await Promise.all([
        readFile(join(app.root, "index.html"), "utf8"),
        readFile(join(app.root, "entry.js"), "utf8"),
      ]);

      expect(html).toContain('<html lang="zh-CN" dir="ltr"');
      expect(html).toContain("<title>Research &amp; &lt;Design&gt;</title>");
      expect(html).toContain(
        '<meta name="description" content="A &quot;quoted&quot; summary &amp; result." />',
      );
      expect(html).toContain(
        '<meta property="og:title" content="Research &amp; &lt;Design&gt;" />',
      );
      expect(html).toContain('<link rel="canonical" href="https://slides.test/research/" />');
      expect(html).toContain('<meta property="og:url" content="https://slides.test/research/" />');
      expect(html).toContain(
        '<meta property="og:image" content="https://slides.test/cover.png?size=large&amp;format=webp" />',
      );
      expect(html).toContain('<meta property="og:image:alt" content="绿色封面 &amp; diagram" />');
      expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
      expect(html).toContain(
        '<link rel="icon" href="https://slides.test/deck-icon.svg?variant=one&amp;size=32" />',
      );
      expect(source).toContain('document.title = "Research & <Design>"');
    } finally {
      await app.dispose();
    }
  });

  it("anchors local document icons to the presentation root during development", async () => {
    const app = await createPrivateApp("/project/slides.mdx", {
      deck: { icon: "./icon.svg?v=1", lang: "en" },
    });
    try {
      const html = await readFile(join(app.root, "index.html"), "utf8");

      expect(html).toContain('<link rel="icon" href="/icon.svg?v=1" />');
      expect(html).not.toContain('<link rel="icon" href="./icon.svg?v=1" />');
    } finally {
      await app.dispose();
    }
  });

  it("gates the presentation before runtime when a required browser primitive is missing", async () => {
    const app = await createPrivateApp("/project/slides.mdx");
    try {
      const [html, source] = await Promise.all([
        readFile(join(app.root, "index.html"), "utf8"),
        readFile(join(app.root, "entry.js"), "utf8"),
      ]);
      const bootstrap = browserSupportBootstrapSource(html);

      expect(html).toContain('data-drever-browser-support="checking"');
      expect(html).toContain("data-drever-browser-support-gate");
      expect(html).toContain("data-drever-loading");
      expect(html).toContain(
        'aria-labelledby="drever-browser-support-title"\n      dir="ltr"\n      lang="en"',
      );
      expect(html).toContain(
        'data-drever-loading\n      dir="ltr"\n      lang="en"\n      role="status"',
      );
      expect(html).toContain('role="status"');
      expect(html).toContain("Preparing the presentation");
      expect(html).toContain('<html lang="und" dir="ltr"');
      expect(html).toContain("<title>Drever</title>");
      expect(html).toContain("viewBox=&#39;0 0 32 32&#39;");
      expect(html).not.toContain("xmlns='http://www.w3.org/2000/svg'/%3E");
      expect(source).toContain('document.title = deckManifest.slides[0]?.title ?? "Drever"');
      expect(html.indexOf("data-drever-loading")).toBeLessThan(html.indexOf('src="/entry.js"'));
      expect(source).toContain('document.querySelector("[data-drever-loading]")');
      expect(source).toContain("finally {");
      expect(source).toContain("loading?.remove();");
      expect(source).toContain(
        'document.documentElement.dataset.dreverBrowserSupport !== "supported"',
      );
      expect(html.indexOf("data-drever-browser-support>")).toBeLessThan(
        html.indexOf('src="/entry.js"'),
      );
      expect(runBrowserSupportBootstrap(bootstrap)).toMatchObject({
        "data-drever-browser-missing": "",
        "data-drever-browser-support": "supported",
      });
      expect(
        runBrowserSupportBootstrap(bootstrap, {
          navigationSignal: false,
        }),
      ).toMatchObject({
        "data-drever-browser-missing": "navigation",
        "data-drever-browser-support": "unsupported",
      });
      expect(
        runBrowserSupportBootstrap(bootstrap, {
          documentViewTransition: false,
          navigation: false,
        }),
      ).toMatchObject({
        "data-drever-browser-missing": "navigation document-view-transition",
        "data-drever-browser-support": "unsupported",
      });
    } finally {
      await app.dispose();
    }
  });

  it("publishes live positions from interactive surfaces until HMR disposal", async () => {
    const app = await createPrivateApp("/project/slides.mdx");
    try {
      const source = await readFile(join(app.root, "entry.js"), "utf8");
      const hotStart = source.indexOf("if (import.meta.hot)");
      if (hotStart < 0) {
        throw new TypeError("The generated entry is missing its HMR block.");
      }

      const hotProgram = `let stopStudioPreviewBridge;\n${source
        .slice(hotStart)
        .replaceAll("import.meta.hot", "hot")}`;
      let position = { slideId: "slide-2", slideIndex: 1, step: 3 };
      let publish: (() => void) | undefined;
      let dispose: (() => void) | undefined;
      let routeChanged: (() => void) | undefined;
      let selectElement:
        | ((event: {
            altKey: boolean;
            preventDefault(): void;
            stopPropagation(): void;
            target: unknown;
          }) => void)
        | undefined;
      let clearSelection: ((event: { key: string }) => void) | undefined;
      let publishAfterMutation:
        | ((
            mutations: readonly {
              attributeName?: string;
              target: unknown;
              type: string;
            }[],
          ) => void)
        | undefined;
      const selectionStyle = { remove: vi.fn(), textContent: "" };
      const documentState = {
        URL: "http://127.0.0.1:4317/speaker/2/3?theme=dark#notes",
        createElement(tag: string) {
          expect(tag).toBe("style");
          return selectionStyle;
        },
        head: { append: vi.fn() },
      };
      const unsubscribe = vi.fn();
      const destroy = vi.fn(() => Promise.resolve());
      const removeEventListener = vi.fn();
      const removeGlobalEventListener = vi.fn();
      const disconnectSelectionObserver = vi.fn();
      const observeSelection = vi.fn();
      const send = vi.fn();

      class TestElement {
        isConnected = true;
        textContent: string | null;
        readonly attributes: Map<string, string>;
        readonly parent: TestElement | undefined;

        constructor(
          attributes: Readonly<Record<string, string>> = {},
          parent?: TestElement,
          textContent: string | null = null,
        ) {
          this.attributes = new Map(Object.entries(attributes));
          this.parent = parent;
          this.textContent = textContent;
        }

        closest(selector: string): TestElement | null {
          const attribute = selector.slice(1, -1);
          return this.attributes.has(attribute) ? this : (this.parent?.closest(selector) ?? null);
        }

        contains(element: unknown): boolean {
          let candidate = element instanceof TestElement ? element : undefined;
          while (candidate !== undefined) {
            if (candidate === this) return true;
            candidate = candidate.parent;
          }
          return false;
        }

        getAttribute(name: string): string | null {
          return this.attributes.get(name) ?? null;
        }

        removeAttribute(name: string): void {
          this.attributes.delete(name);
        }

        setAttribute(name: string, value: string): void {
          this.attributes.set(name, value);
        }
      }

      class TestMutationObserver {
        constructor(callback: NonNullable<typeof publishAfterMutation>) {
          publishAfterMutation = callback;
        }

        disconnect = disconnectSelectionObserver;
        observe = observeSelection;
      }

      const container = new TestElement();
      const slide = new TestElement(
        { "data-drever-slide": "", "data-slide-index": "1" },
        container,
      );
      const heading = new TestElement(
        {
          "data-drever-dev-source-path": "/project/slides.mdx",
          "data-drever-dev-source-range": "5:1:40:5:18:57",
          "data-drever-dev-source-tag": "h2",
        },
        slide,
        "  Exact   selection  ",
      );

      runInNewContext(hotProgram, {
        addEventListener(event: string, callback: unknown, capture: boolean) {
          expect(capture).toBe(true);
          if (event === "click") {
            selectElement = callback as NonNullable<typeof selectElement>;
          } else {
            expect(event).toBe("keydown");
            clearSelection = callback as NonNullable<typeof clearSelection>;
          }
        },
        Element: TestElement,
        MutationObserver: TestMutationObserver,
        URL,
        container,
        document: documentState,
        hot: {
          dispose(callback: () => void) {
            dispose = callback;
          },
          send,
        },
        navigation: {
          addEventListener(event: string, callback: () => void) {
            expect(event).toBe("currententrychange");
            routeChanged = callback;
          },
          removeEventListener,
        },
        presentation: {
          destroy,
          getPosition: () => position,
          subscribe(callback: () => void) {
            publish = callback;
            return unsubscribe;
          },
        },
        reportPresentationError: vi.fn(),
        removeEventListener: removeGlobalEventListener,
        routePath: "speaker/2/3",
      });

      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0]).toEqual([
        "drever:current-position",
        {
          position: { slideId: "slide-2", slideIndex: 1, step: 3 },
          route: "/speaker/2/3?theme=dark#notes",
          surface: "speaker",
        },
      ]);
      expect(documentState.head.append).toHaveBeenCalledWith(selectionStyle);
      expect(selectionStyle.textContent).toContain("[data-drever-dev-selected]");
      expect(observeSelection).toHaveBeenCalledWith(container, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true,
      });

      const ordinaryPreventDefault = vi.fn();
      const ordinaryStopPropagation = vi.fn();
      selectElement?.({
        altKey: false,
        preventDefault: ordinaryPreventDefault,
        stopPropagation: ordinaryStopPropagation,
        target: heading,
      });
      expect(send).toHaveBeenCalledTimes(1);
      expect(ordinaryPreventDefault).not.toHaveBeenCalled();
      expect(ordinaryStopPropagation).not.toHaveBeenCalled();
      expect(heading.getAttribute("data-drever-dev-selected")).toBeNull();

      const selectionPreventDefault = vi.fn();
      const selectionStopPropagation = vi.fn();
      selectElement?.({
        altKey: true,
        preventDefault: selectionPreventDefault,
        stopPropagation: selectionStopPropagation,
        target: heading,
      });
      expect(selectionPreventDefault).toHaveBeenCalledOnce();
      expect(selectionStopPropagation).toHaveBeenCalledOnce();
      expect(heading.getAttribute("data-drever-dev-selected")).toBe("");
      expect(send.mock.calls.at(-1)?.[1]).toMatchObject({
        position: { slideId: "slide-2", slideIndex: 1, step: 3 },
        selection: {
          sourceRange: {
            path: "/project/slides.mdx",
            start: { line: 5, column: 1, offset: 40 },
            end: { line: 5, column: 18, offset: 57 },
          },
          tag: "h2",
          text: "Exact selection",
        },
      });

      const callsBeforeOutlineMutation = send.mock.calls.length;
      publishAfterMutation?.([
        {
          attributeName: "data-drever-dev-selected",
          target: heading,
          type: "attributes",
        },
      ]);
      expect(send).toHaveBeenCalledTimes(callsBeforeOutlineMutation);

      clearSelection?.({ key: "Escape" });
      expect(heading.getAttribute("data-drever-dev-selected")).toBeNull();
      expect(send.mock.calls.at(-1)?.[1]).not.toHaveProperty("selection");

      selectElement?.({
        altKey: true,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: heading,
      });
      heading.attributes.set("data-drever-dev-source-range", "6:3:62:6:21:80");
      heading.textContent = "Selection after HMR";
      publishAfterMutation?.([
        {
          attributeName: "data-drever-dev-source-range",
          target: heading,
          type: "attributes",
        },
      ]);
      expect(send.mock.calls.at(-1)?.[1]).toMatchObject({
        selection: {
          sourceRange: {
            start: { line: 6, column: 3, offset: 62 },
            end: { line: 6, column: 21, offset: 80 },
          },
          text: "Selection after HMR",
        },
      });

      heading.isConnected = false;
      publishAfterMutation?.([{ target: slide, type: "childList" }]);
      expect(send.mock.calls.at(-1)?.[1]).not.toHaveProperty("selection");

      position = { slideId: "slide-4", slideIndex: 3, step: 0 };
      publish?.();
      expect(send.mock.calls.at(-1)?.[1]).toEqual({
        position: { slideId: "slide-4", slideIndex: 3, step: 0 },
        route: "/speaker/2/3?theme=dark#notes",
        surface: "speaker",
      });

      documentState.URL = "http://127.0.0.1:4317/speaker/4?review=true#current";
      routeChanged?.();
      expect(send.mock.calls.at(-1)?.[1]).toEqual({
        position: { slideId: "slide-4", slideIndex: 3, step: 0 },
        route: "/speaker/4?review=true#current",
        surface: "speaker",
      });

      dispose?.();
      expect(unsubscribe).toHaveBeenCalledOnce();
      expect(removeEventListener).toHaveBeenCalledWith("currententrychange", expect.any(Function));
      expect(removeGlobalEventListener).toHaveBeenCalledWith("click", expect.any(Function), true);
      expect(removeGlobalEventListener).toHaveBeenCalledWith("keydown", expect.any(Function), true);
      expect(disconnectSelectionObserver).toHaveBeenCalledOnce();
      expect(selectionStyle.remove).toHaveBeenCalledOnce();
      expect(destroy).toHaveBeenCalledOnce();
    } finally {
      await app.dispose();
    }
  });

  it("bridges an embedded audience preview to one origin-bound Studio parent", async () => {
    const app = await createPrivateApp("/project/slides.mdx", {
      previewCapability: "studio-capability",
    });
    try {
      const source = await readFile(join(app.root, "entry.js"), "utf8");
      const bridge = studioPreviewBridgeSource(source).replaceAll("import.meta.hot", "hot");
      const deckManifest = {
        version: 2,
        slides: [
          {
            id: "opening",
            index: 0,
            speakerNotes: [
              { format: "markdown", plainText: "Open with the evidence.", value: "Open." },
            ],
            stepStops: [],
            title: "Opening",
          },
          {
            id: "decision",
            index: 1,
            speakerNotes: [
              { format: "markdown", plainText: "Ask for the decision.", value: "Ask." },
            ],
            stepStops: [2],
            title: "Decision",
          },
        ],
      };
      let position = { slideId: "opening", slideIndex: 0, step: 0 };
      let receiveMessage:
        | ((event: Readonly<{ data: unknown; origin: string; source: unknown }>) => void)
        | undefined;
      let publishPosition: (() => void) | undefined;
      const parentWindow = { postMessage: vi.fn() };
      const navigate = vi.fn(() => Promise.resolve());
      const unsubscribe = vi.fn();
      const removeEventListener = vi.fn();
      const resolvedCanvas = { height: 900, width: 1_600 };
      const context = {
        URL,
        deckManifest,
        hot: { data: {} as Record<string, unknown> },
        parent: parentWindow,
        routePath: "",
        presentation: {
          getPosition: () => position,
          navigate,
          subscribe(callback: () => void) {
            publishPosition = callback;
            return unsubscribe;
          },
        },
        reportPresentationError: vi.fn(),
        addEventListener(type: string, callback: typeof receiveMessage) {
          expect(type).toBe("message");
          receiveMessage = callback;
        },
        removeEventListener,
        resolvedCanvas,
      };
      runInNewContext(
        `${bridge}\nglobalThis.disposeStudioPreviewBridge = () => stopStudioPreviewBridge?.();`,
        context,
      );

      expect(parentWindow.postMessage).toHaveBeenCalledWith(
        { type: "drever:studio-preview-ready", version: 1 },
        "*",
      );
      parentWindow.postMessage.mockClear();
      expect(publishPosition).toBeTypeOf("function");

      const connect = {
        capability: "studio-capability",
        type: "drever:studio-preview-connect",
        version: 1,
      };
      receiveMessage?.({
        data: { ...connect, capability: "wrong-capability" },
        origin: "http://127.0.0.1:4317",
        source: parentWindow,
      });
      receiveMessage?.({ data: connect, origin: "null", source: parentWindow });
      receiveMessage?.({ data: connect, origin: "http://127.0.0.1:4317", source: {} });
      receiveMessage?.({
        data: { ...connect, version: 2 },
        origin: "http://127.0.0.1:4317",
        source: parentWindow,
      });
      expect(parentWindow.postMessage).not.toHaveBeenCalled();

      receiveMessage?.({
        data: connect,
        origin: "http://127.0.0.1:4317",
        source: parentWindow,
      });
      expect(parentWindow.postMessage).toHaveBeenLastCalledWith(
        {
          type: "drever:studio-preview-state",
          version: 1,
          canvas: resolvedCanvas,
          manifest: deckManifest,
          position: { slideId: "opening", slideIndex: 0, step: 0 },
        },
        "http://127.0.0.1:4317",
      );
      expect(context.hot.data.dreverStudioPreviewParentOrigin).toBe("http://127.0.0.1:4317");
      const callsAfterConnect = parentWindow.postMessage.mock.calls.length;
      receiveMessage?.({
        data: connect,
        origin: "http://127.0.0.1:4318",
        source: parentWindow,
      });
      expect(parentWindow.postMessage).toHaveBeenCalledTimes(callsAfterConnect);

      position = { slideId: "decision", slideIndex: 1, step: 2 };
      publishPosition?.();
      expect(parentWindow.postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          type: "drever:studio-preview-state",
          manifest: deckManifest,
          position: { slideId: "decision", slideIndex: 1, step: 2 },
        }),
        "http://127.0.0.1:4317",
      );

      const navigateToDecision = {
        capability: "studio-capability",
        type: "drever:studio-preview-navigate",
        version: 1,
        slideIndex: 1,
      };
      receiveMessage?.({
        data: { ...navigateToDecision, capability: "wrong-capability" },
        origin: "http://127.0.0.1:4317",
        source: parentWindow,
      });
      receiveMessage?.({
        data: navigateToDecision,
        origin: "http://127.0.0.1:4318",
        source: parentWindow,
      });
      receiveMessage?.({
        data: { ...navigateToDecision, slideIndex: 1.5 },
        origin: "http://127.0.0.1:4317",
        source: parentWindow,
      });
      receiveMessage?.({
        data: { ...navigateToDecision, slideIndex: 12 },
        origin: "http://127.0.0.1:4317",
        source: parentWindow,
      });
      expect(navigate).not.toHaveBeenCalled();

      receiveMessage?.({
        data: navigateToDecision,
        origin: "http://127.0.0.1:4317",
        source: parentWindow,
      });
      expect(navigate).toHaveBeenCalledWith({ type: "goTo", slideId: "decision", step: 0 });

      (
        context as typeof context & Readonly<{ disposeStudioPreviewBridge(): void }>
      ).disposeStudioPreviewBridge();
      expect(unsubscribe).toHaveBeenCalledOnce();
      expect(removeEventListener).toHaveBeenCalledWith("message", receiveMessage);
    } finally {
      await app.dispose();
    }
  });

  it("restores the authenticated Studio parent after a viewer HMR replacement", async () => {
    const app = await createPrivateApp("/project/slides.mdx", {
      previewCapability: "studio-capability",
    });
    try {
      const source = await readFile(join(app.root, "entry.js"), "utf8");
      const bridge = studioPreviewBridgeSource(source).replaceAll("import.meta.hot", "hot");
      const parentWindow = { postMessage: vi.fn() };
      const subscribe = vi.fn(() => vi.fn());
      const hotData = {
        dreverStudioPreviewParentOrigin: "http://127.0.0.1:4317",
      };

      runInNewContext(bridge, {
        URL,
        addEventListener: vi.fn(),
        deckManifest: {
          version: 2,
          slides: [{ id: "opening", index: 0, speakerNotes: [], stepStops: [] }],
        },
        hot: { data: hotData },
        parent: parentWindow,
        presentation: {
          getPosition: () => ({ slideId: "opening", slideIndex: 0, step: 0 }),
          navigate: vi.fn(),
          subscribe,
        },
        removeEventListener: vi.fn(),
        reportPresentationError: vi.fn(),
        resolvedCanvas: { height: 1_080, width: 1_920 },
        routePath: "",
      });

      expect(subscribe).toHaveBeenCalledOnce();
      expect(parentWindow.postMessage).toHaveBeenCalledTimes(2);
      expect(parentWindow.postMessage).toHaveBeenCalledWith(
        { type: "drever:studio-preview-ready", version: 1 },
        "*",
      );
      expect(parentWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "drever:studio-preview-state",
          position: { slideId: "opening", slideIndex: 0, step: 0 },
        }),
        "http://127.0.0.1:4317",
      );
    } finally {
      await app.dispose();
    }
  });

  it("does not open the Studio preview channel outside an embedded development audience", async () => {
    const app = await createPrivateApp("/project/slides.mdx", {
      previewCapability: "studio-capability",
    });
    try {
      const source = await readFile(join(app.root, "entry.js"), "utf8");
      const bridge = studioPreviewBridgeSource(source).replaceAll("import.meta.hot", "hot");
      const addEventListener = vi.fn();
      const subscribe = vi.fn();
      const shared = {
        URL,
        deckManifest: { version: 2, slides: [] },
        presentation: {
          getPosition: vi.fn(),
          navigate: vi.fn(),
          subscribe,
        },
        routePath: "",
        reportPresentationError: vi.fn(),
        addEventListener,
      };
      runInNewContext(`globalThis.parent = globalThis;\n${bridge}`, {
        ...shared,
        hot: { data: {} },
      });
      runInNewContext(bridge, {
        ...shared,
        hot: undefined,
        parent: { postMessage: vi.fn() },
      });

      expect(addEventListener).not.toHaveBeenCalled();
      expect(subscribe).not.toHaveBeenCalled();
    } finally {
      await app.dispose();
    }
  });

  it("does not embed or activate a Studio capability in a production viewer", async () => {
    const app = await createPrivateApp("/project/slides.mdx");
    try {
      const source = await readFile(join(app.root, "entry.js"), "utf8");
      const bridge = studioPreviewBridgeSource(source).replaceAll("import.meta.hot", "hot");
      const addEventListener = vi.fn();
      const subscribe = vi.fn();

      expect(source).toContain("const studioPreviewCapability = undefined;");
      runInNewContext(bridge, {
        URL,
        addEventListener,
        deckManifest: { version: 2, slides: [] },
        hot: { data: {} },
        parent: { postMessage: vi.fn() },
        presentation: {
          getPosition: vi.fn(),
          navigate: vi.fn(),
          subscribe,
        },
        removeEventListener: vi.fn(),
        reportPresentationError: vi.fn(),
        routePath: "",
      });

      expect(addEventListener).not.toHaveBeenCalled();
      expect(subscribe).not.toHaveBeenCalled();
    } finally {
      await app.dispose();
    }
  });

  it("routes an asynchronous HMR cleanup failure through the presentation reporter", async () => {
    const app = await createPrivateApp("/project/slides.mdx");
    try {
      const [html, source] = await Promise.all([
        readFile(join(app.root, "index.html"), "utf8"),
        readFile(join(app.root, "entry.js"), "utf8"),
      ]);
      expect(source).toContain("onError: reportPresentationError");
      expect(source).toContain(
        "const reportPresentationError = (error) => globalThis.reportError(error);",
      );
      expect(source).toContain('const routePath = relativePath.replace(/\\/+$/u, "");');
      expect(source).toContain('routePath === "document"');
      expect(source).toContain("presentation = await createDocument(presentationOptions)");
      expect(source).toContain('container.removeAttribute("data-drever-ready")');
      expect(source).toContain('container.setAttribute("data-drever-ready", "")');
      expect(source).toContain("globalThis.__dreverExperimentalTextLayout");
      expect(source).toContain('"virtual:drever/experimental-text-layout"');
      expect(source).not.toContain("console.error");
      expect(html).not.toContain("data-drever-export-bootstrap");

      const hotStart = source.indexOf("if (import.meta.hot)");
      if (hotStart < 0) {
        throw new TypeError("The generated entry is missing its HMR disposal block.");
      }
      const hotProgram = `let stopStudioPreviewBridge;\n${source
        .slice(hotStart)
        .replaceAll("import.meta.hot", "hot")}`;
      const failure = new Error("cleanup failed");
      const destroy = vi.fn(() => Promise.reject(failure));
      const reported = Promise.withResolvers<unknown>();
      const reportPresentationError = vi.fn(reported.resolve);
      let dispose: (() => void) | undefined;

      runInNewContext(hotProgram, {
        hot: {
          dispose(callback: () => void) {
            dispose = callback;
          },
        },
        reportPresentationError,
        presentation: { destroy },
      });
      dispose?.();

      expect(destroy).toHaveBeenCalledOnce();
      expect(await reported.promise).toBe(failure);
      expect(reportPresentationError).toHaveBeenCalledOnce();
      expect(reportPresentationError).toHaveBeenCalledWith(failure);
    } finally {
      await app.dispose();
    }
  });

  it("separates interactive focus tools and speaker rehearsal from document options", async () => {
    const app = await createPrivateApp("/project/slides.mdx", {
      canvas: { height: 900, width: 1_600 },
      focusTools: {
        highlighter: { color: "#ffe66d", opacity: 0.28, width: 30 },
        laser: { color: "#ff4567" },
        pen: { color: "var(--drever-theme-accent)", width: 7.5 },
      },
      rehearsal: { targetDurationMs: 1_110_000 },
      stage: {
        background: "/project/Background.tsx",
        foreground: "/project/Chrome.tsx",
      },
    });
    try {
      const source = await readFile(join(app.root, "entry.js"), "utf8");
      const optionsEnd = source.indexOf("let presentation;");
      if (optionsEnd < 0) {
        throw new TypeError("The generated entry is missing its presentation branches.");
      }

      expect(source.slice(0, optionsEnd)).not.toContain("rehearsal");
      expect(source).toContain('canvas: {"height":900,"width":1600}');
      expect(source).toContain('import StageBackground from "/project/Background.tsx"');
      expect(source).toContain('import StageForeground from "/project/Chrome.tsx"');
      expect(source).toContain(
        "stage: { background: StageBackground, foreground: StageForeground }",
      );
      expect(source).toContain("presentation = await createDocument(presentationOptions)");
      expect(source).toContain("const interactiveOptions = {");
      expect(source).toContain("...presentationOptions,");
      expect(source).toContain(
        'focusTools: {"highlighter":{"color":"#ffe66d","opacity":0.28,"width":30},"laser":{"color":"#ff4567"},"pen":{"color":"var(--drever-theme-accent)","width":7.5}}',
      );
      expect(source).toContain(
        'presentation = await createSpeaker({\n      ...interactiveOptions,\n      rehearsal: {"targetDurationMs":1110000}',
      );
      expect(source).toContain('await import("@drever/client/document")');
      expect(source).toContain('await import("@drever/client/speaker")');
      expect(source).toContain('await import("@drever/client/audience")');
      expect(source).not.toContain(
        'import { createDocument, createSpeaker, createViewer } from "@drever/client"',
      );
      expect(source).not.toContain("storyboard");
      expect(source.match(/focusTools:/gu)).toHaveLength(1);
      expect(source.match(/rehearsal:/gu)).toHaveLength(1);
    } finally {
      await app.dispose();
    }
  });

  it("keeps the export bundle isolated from interactive viewer runtime code", async () => {
    const app = await createPrivateExportApp("/project/slides.mdx", {
      canvas: { height: 900, width: 1_600 },
      deck: {
        description: "A localized export.",
        lang: "ar",
        title: "قرار واضح",
      },
      includeSteps: true,
      stage: { foreground: "/project/Chrome.tsx" },
    });
    try {
      const [html, source] = await Promise.all([
        readFile(join(app.root, "index.html"), "utf8"),
        readFile(join(app.root, "entry.js"), "utf8"),
      ]);

      expect(html).not.toContain("data-drever-loading");
      expect(html).toContain('<html lang="ar" dir="rtl"');
      expect(html).toContain("<title>قرار واضح</title>");
      expect(html).toContain('<meta name="description" content="A localized export." />');
      expect(source).toContain('import { createExport } from "@drever/client"');
      expect(source).toContain('import { runExportSetup } from "virtual:drever/export-runtime"');
      expect(source).toContain("includeSteps: true");
      expect(source).toContain('canvas: {"height":900,"width":1600}');
      expect(source).toContain('import StageForeground from "/project/Chrome.tsx"');
      expect(source).toContain("stage: { foreground: StageForeground }");
      expect(source).toContain("globalThis.__dreverExportHandle");
      expect(source).toContain('document.title = "قرار واضح"');
      expect(source).not.toContain("createViewer");
      expect(source).not.toContain("createSpeaker");
      expect(source).not.toContain("__dreverExperimentalTextLayout");
      expect(source).not.toContain("virtual:drever/experimental-text-layout");
      expect(source).not.toContain('from "virtual:drever/runtime"');
      expect(source).not.toContain("storyboard");
      expect(source).not.toContain("data-drever-dev-source");
    } finally {
      await app.dispose();
    }
  });

  it("marks static-import and bootstrap failures before the export module can mount", async () => {
    const app = await createPrivateExportApp("/project/slides.mdx", {
      includeSteps: false,
    });
    try {
      const html = await readFile(join(app.root, "index.html"), "utf8");
      expect(html).not.toContain("data-drever-browser-support-gate");
      const listeners = new Map<string, (event: Record<string, unknown>) => void>();
      const dataset: Record<string, string> = {};
      runInNewContext(exportBootstrapSource(html), {
        addEventListener(name: string, listener: (event: Record<string, unknown>) => void) {
          listeners.set(name, listener);
        },
        document: { documentElement: { dataset } },
      });

      expect([...listeners.keys()]).toEqual(["error", "unhandledrejection"]);
      listeners.get("error")?.({
        error: {
          capability: "exportSetup",
          code: "DREVER_BOOTSTRAP_FAILED",
          details: { owner: "diagram", specifier: "diagram/export.js" },
          message: "The exporter import failed.",
          name: "Error",
        },
      });

      expect(dataset.dreverExportStatus).toBe("failed");
      expect(JSON.parse(dataset.dreverExportError ?? "null")).toMatchObject({
        capability: "exportSetup",
        code: "DREVER_BOOTSTRAP_FAILED",
        message: "The exporter import failed.",
        owner: "diagram",
        specifier: "diagram/export.js",
      });

      listeners.get("unhandledrejection")?.({ reason: "The bootstrap promise rejected." });
      expect(JSON.parse(dataset.dreverExportError ?? "null")).toMatchObject({
        message: "The bootstrap promise rejected.",
        name: "Error",
      });
    } finally {
      await app.dispose();
    }
  });

  it("removes the generated root when either initial file write fails", async () => {
    const failure = new Error("index write failed");
    let generatedRoot: string | undefined;
    const writer = vi.fn(async (path: string, contents: string) => {
      generatedRoot = dirname(path);
      if (path.endsWith("index.html")) {
        throw failure;
      }
      await writeFile(path, contents, "utf8");
    });

    await expect(
      createGeneratedApp("drever-write-failure-", "entry", "document", writer),
    ).rejects.toBe(failure);
    expect(writer).toHaveBeenCalledTimes(2);
    if (generatedRoot === undefined) {
      throw new TypeError("The generated root was not observed by the file writer.");
    }
    await expect(stat(generatedRoot)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

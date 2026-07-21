import { readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vite-plus/test";
import { createGeneratedApp, createPrivateApp, createPrivateExportApp } from "./private-app.ts";

const exportBootstrapSource = (html: string): string => {
  const match = html.match(/<script data-drever-export-bootstrap>(?<source>[\s\S]*?)<\/script>/u);
  const source = match?.groups?.source;
  if (source === undefined) {
    throw new TypeError("The generated export document is missing its bootstrap reporter.");
  }
  return source;
};

describe("generated private application", () => {
  it("publishes live positions from interactive surfaces until HMR disposal", async () => {
    const app = await createPrivateApp("/project/slides.mdx");
    try {
      const source = await readFile(join(app.root, "entry.js"), "utf8");
      const hotStart = source.indexOf("if (import.meta.hot)");
      if (hotStart < 0) {
        throw new TypeError("The generated entry is missing its HMR block.");
      }

      const hotProgram = source.slice(hotStart).replaceAll("import.meta.hot", "hot");
      let position = { slideId: "slide-2", slideIndex: 1, step: 3 };
      let publish: (() => void) | undefined;
      let dispose: (() => void) | undefined;
      let routeChanged: (() => void) | undefined;
      const documentState = {
        URL: "http://127.0.0.1:4317/speaker/2/3?theme=dark#notes",
      };
      const unsubscribe = vi.fn();
      const destroy = vi.fn(() => Promise.resolve());
      const removeEventListener = vi.fn();
      const send = vi.fn();

      runInNewContext(hotProgram, {
        URL,
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
      expect(destroy).toHaveBeenCalledOnce();
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
      expect(source).toContain("? await createDocument(presentationOptions)");
      expect(source).not.toContain("console.error");
      expect(html).not.toContain("data-drever-export-bootstrap");

      const hotStart = source.indexOf("if (import.meta.hot)");
      if (hotStart < 0) {
        throw new TypeError("The generated entry is missing its HMR disposal block.");
      }
      const hotProgram = source.slice(hotStart).replaceAll("import.meta.hot", "hot");
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
      const optionsEnd = source.indexOf("const presentation =");
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
      expect(source).toContain("? await createDocument(presentationOptions)");
      expect(source).toContain("const interactiveOptions = {");
      expect(source).toContain("...presentationOptions,");
      expect(source).toContain(
        'focusTools: {"highlighter":{"color":"#ffe66d","opacity":0.28,"width":30},"laser":{"color":"#ff4567"},"pen":{"color":"var(--drever-theme-accent)","width":7.5}}',
      );
      expect(source).toContain(
        '? await createSpeaker({\n      ...interactiveOptions,\n      rehearsal: {"targetDurationMs":1110000}',
      );
      expect(source).toContain(": await createViewer(interactiveOptions)");
      expect(source.match(/focusTools:/gu)).toHaveLength(1);
      expect(source.match(/rehearsal:/gu)).toHaveLength(1);
    } finally {
      await app.dispose();
    }
  });

  it("keeps the export bundle isolated from interactive viewer runtime code", async () => {
    const app = await createPrivateExportApp("/project/slides.mdx", {
      canvas: { height: 900, width: 1_600 },
      includeSteps: true,
      stage: { foreground: "/project/Chrome.tsx" },
    });
    try {
      const source = await readFile(join(app.root, "entry.js"), "utf8");

      expect(source).toContain('import { createExport } from "@drever/client"');
      expect(source).toContain('import { runExportSetup } from "virtual:drever/export-runtime"');
      expect(source).toContain("includeSteps: true");
      expect(source).toContain('canvas: {"height":900,"width":1600}');
      expect(source).toContain('import StageForeground from "/project/Chrome.tsx"');
      expect(source).toContain("stage: { foreground: StageForeground }");
      expect(source).toContain("globalThis.__dreverExportHandle");
      expect(source).not.toContain("createViewer");
      expect(source).not.toContain("createSpeaker");
      expect(source).not.toContain('from "virtual:drever/runtime"');
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

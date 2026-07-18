import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vite-plus/test";
import { createPrivateApp } from "./private-app.ts";

describe("generated private application", () => {
  it("routes an asynchronous HMR cleanup failure through the presentation reporter", async () => {
    const app = await createPrivateApp("/project/slides.mdx");
    try {
      const source = await readFile(join(app.root, "entry.js"), "utf8");
      expect(source).toContain("onError: reportPresentationError");
      expect(source).toContain(
        "const reportPresentationError = (error) => globalThis.reportError(error);",
      );
      expect(source).not.toContain("console.error");

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
        viewer: { destroy },
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
});

import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  destroyExport,
  resolveBrowserLocale,
  runWithCleanup,
  validatePdfSlideSelection,
  writePdf,
  type PdfWriteOperations,
} from "./export-pdf.ts";

const directories: string[] = [];

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("resolveBrowserLocale", () => {
  it("passes supported authored locales to Chromium without inventing a default", () => {
    expect(resolveBrowserLocale("zh-CN")).toBe("zh-CN");
    expect(resolveBrowserLocale("en")).toBe("en");
    expect(resolveBrowserLocale()).toBeUndefined();
  });

  it("leaves document-only language tags such as und out of browser context options", () => {
    expect(resolveBrowserLocale("und")).toBeUndefined();
  });
});

describe("runWithCleanup", () => {
  it("preserves the primary failure and attaches a cleanup failure", async () => {
    const primary = new Error("capture failed");
    const cleanup = new Error("cleanup failed");
    const release = vi.fn(async () => {
      throw cleanup;
    });

    let received: unknown;
    try {
      await runWithCleanup(async () => {
        throw primary;
      }, release);
    } catch (error) {
      received = error;
    }

    expect(received).toBe(primary);
    expect(primary).toHaveProperty("suppressedErrors.0", cleanup);
    expect(release).toHaveBeenCalledOnce();
  });

  it("does not retry a cleanup that fails after a successful operation", async () => {
    const cleanup = new Error("cleanup failed");
    const release = vi.fn(async () => {
      throw cleanup;
    });

    await expect(runWithCleanup(async () => 42, release)).rejects.toBe(cleanup);
    expect(release).toHaveBeenCalledOnce();
  });

  it("does not release its result to a caller until cleanup succeeds", async () => {
    const cleanup = Promise.withResolvers<void>();
    const events: string[] = [];
    const render = runWithCleanup(
      async () => {
        events.push("render");
        return Buffer.from("PDF");
      },
      async () => {
        events.push("cleanup:start");
        await cleanup.promise;
        events.push("cleanup:end");
      },
    );
    void render.then(() => events.push("write"));

    await vi.waitFor(() => expect(events).toEqual(["render", "cleanup:start"]));
    cleanup.resolve();
    await render;
    await vi.waitFor(() =>
      expect(events).toEqual(["render", "cleanup:start", "cleanup:end", "write"]),
    );
  });
});

describe("destroyExport", () => {
  it("fails on the cleanup deadline instead of awaiting a disposer forever", async () => {
    vi.useFakeTimers();
    const evaluate = vi.fn(() => new Promise<never>(() => {}));
    const result = destroyExport({ evaluate } as Parameters<typeof destroyExport>[0], 25);
    const rejection = expect(result).rejects.toMatchObject({
      code: "DREVER_EXPORT_TIMEOUT",
      details: { stage: "cleanup", timeout: 25 },
    });

    await vi.advanceTimersByTimeAsync(25);
    await rejection;
    expect(evaluate).toHaveBeenCalledOnce();
  });

  it("turns a disposer rejection into an actionable cleanup diagnostic", async () => {
    const cause = new Error("diagram worker did not stop");
    const evaluate = vi.fn(async () => {
      throw cause;
    });

    await expect(
      destroyExport({ evaluate } as Parameters<typeof destroyExport>[0]),
    ).rejects.toMatchObject({
      cause,
      code: "DREVER_EXPORT_FAILED",
      details: { stage: "cleanup" },
      message: "The export runtime could not release its resources.",
    });
  });

  it("keeps plugin ownership returned by the browser cleanup boundary", async () => {
    const evaluate = vi.fn(async () => ({
      capability: "exportSetup",
      code: "DREVER_CLIENT_DISPOSE_FAILED",
      message: "The diagram exporter could not stop its worker.",
      name: "DreverClientError",
      owner: "diagram-plugin",
      specifier: "file:///project/diagram-export.js",
    }));

    await expect(
      destroyExport({ evaluate } as Parameters<typeof destroyExport>[0]),
    ).rejects.toMatchObject({
      code: "DREVER_EXPORT_FAILED",
      details: {
        capability: "exportSetup",
        code: "DREVER_CLIENT_DISPOSE_FAILED",
        owner: "diagram-plugin",
        specifier: "file:///project/diagram-export.js",
        stage: "cleanup",
      },
      message: "The export runtime could not release its resources.",
    });
  });
});

describe("PDF slide selection", () => {
  it("accepts selections within the compiled deck", () => {
    expect(() =>
      validatePdfSlideSelection(
        [
          { first: 2, last: 5 },
          { first: 8, last: 8 },
        ],
        8,
      ),
    ).not.toThrow();
  });

  it("reports the selected slide and compiled deck size when a range exceeds the deck", () => {
    expect(() => validatePdfSlideSelection([{ first: 4, last: 8 }], 5)).toThrowError(
      expect.objectContaining({
        code: "DREVER_ARGUMENT_INVALID",
        details: { selectedSlide: 8, slideCount: 5 },
        hint: "Choose slide numbers between 1 and 5.",
        message: "--slides selects slide 8, but this deck contains 5 slides.",
      }),
    );
  });
});

describe("writePdf", () => {
  it("atomically replaces an existing PDF through a sibling temporary file", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-export-write-test-"));
    directories.push(root);
    const output = join(root, "slides.pdf");
    await writeFile(output, "old PDF");

    await writePdf(output, Buffer.from("new PDF"));

    expect(await readFile(output, "utf8")).toBe("new PDF");
    expect((await stat(output)).isFile()).toBe(true);
  });

  it("preserves the previous PDF and removes its temporary file when commit fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-export-write-test-"));
    directories.push(root);
    const output = join(root, "slides.pdf");
    const temporary = join(root, ".slides.pdf.test.tmp");
    const moveFailure = new Error("rename failed");
    await writeFile(output, "previous PDF");

    const operations: PdfWriteOperations = {
      async createDirectory(path) {
        await mkdir(path, { recursive: true });
      },
      async move() {
        throw moveFailure;
      },
      async remove(path) {
        await rm(path, { force: true });
      },
      temporaryPath(path) {
        expect(dirname(path)).toBe(root);
        return temporary;
      },
      async write(path, contents) {
        await writeFile(path, contents, { flag: "wx" });
      },
    };

    await expect(writePdf(output, Buffer.from("incomplete PDF"), operations)).rejects.toMatchObject(
      {
        cause: moveFailure,
        code: "DREVER_EXPORT_FAILED",
        details: { path: output, stage: "write", temporaryPath: temporary },
      },
    );
    expect(await readFile(output, "utf8")).toBe("previous PDF");
    await expect(stat(temporary)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("keeps a temporary-file cleanup failure subordinate to the write failure", async () => {
    const writeFailure = new Error("write failed");
    const removeFailure = new Error("remove failed");
    const operations: PdfWriteOperations = {
      async createDirectory() {},
      async move() {},
      async remove() {
        throw removeFailure;
      },
      temporaryPath() {
        return "/project/.slides.pdf.test.tmp";
      },
      async write() {
        throw writeFailure;
      },
    };

    let received: unknown;
    try {
      await writePdf("/project/slides.pdf", Buffer.from("PDF"), operations);
    } catch (error) {
      received = error;
    }

    expect(received).toMatchObject({
      cause: writeFailure,
      code: "DREVER_EXPORT_FAILED",
      details: { stage: "write" },
    });
    expect(received).toHaveProperty("suppressedErrors.0");
    expect(
      (received as Readonly<{ suppressedErrors: readonly unknown[] }>).suppressedErrors[0],
    ).toMatchObject({
      cause: removeFailure,
      code: "DREVER_EXPORT_FAILED",
      details: { stage: "cleanup" },
    });
  });
});

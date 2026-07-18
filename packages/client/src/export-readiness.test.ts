import { describe, expect, it, vi } from "vite-plus/test";
import { waitForExportReadiness } from "./export-readiness.ts";

const deferred = <Value>() => {
  let resolve: ((value: Value) => void) | undefined;
  const promise = new Promise<Value>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve: (value: Value) => resolve?.(value) };
};

const flushMicrotasks = async (): Promise<void> => {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
};

class ImageDouble extends EventTarget {
  complete = false;
  currentSrc = "https://slides.test/diagram.png";
  decode = vi.fn(async () => undefined);
  loading = "lazy";
  naturalWidth = 0;
  src = this.currentSrc;
}

const fontSet = (...fonts: readonly FontFace[]): FontFaceSet =>
  Object.assign(fonts, { ready: Promise.resolve(fonts) }) as unknown as FontFaceSet;

const font = (family: string, status: FontFaceLoadStatus): FontFace =>
  ({ family, status, style: "normal", weight: "400" }) as FontFace;

describe("PDF export readiness", () => {
  it("waits for fonts, image decoding, and two consecutive animation frames", async () => {
    const fonts = deferred<FontFaceSet>();
    const image = new ImageDouble();
    const frames: FrameRequestCallback[] = [];
    const document = {
      defaultView: {
        cancelAnimationFrame: vi.fn(),
        requestAnimationFrame(callback: FrameRequestCallback) {
          frames.push(callback);
          return frames.length;
        },
      },
      fonts: fontSet(),
    } as unknown as Document;
    Object.defineProperty(document.fonts, "ready", { value: fonts.promise });
    const container = {
      querySelectorAll: (selector: string) => (selector === "img" ? [image] : []),
    } as unknown as Element;

    let ready = false;
    const readiness = waitForExportReadiness(
      container,
      document,
      new AbortController().signal,
    ).then(() => {
      ready = true;
    });

    await flushMicrotasks();
    expect(frames).toHaveLength(0);
    expect(image.loading).toBe("eager");
    expect(image.decode).not.toHaveBeenCalled();

    image.complete = true;
    image.naturalWidth = 640;
    image.dispatchEvent(new Event("load"));
    fonts.resolve(document.fonts);
    await flushMicrotasks();
    expect(image.decode).toHaveBeenCalledOnce();
    expect(frames).toHaveLength(1);
    expect(ready).toBe(false);

    frames[0]?.(0);
    await flushMicrotasks();
    expect(frames).toHaveLength(2);
    expect(ready).toBe(false);

    frames[1]?.(16);
    await readiness;
    expect(ready).toBe(true);
  });

  it("fails immediately when an already completed image is broken", async () => {
    const image = new ImageDouble();
    image.complete = true;
    const document = {
      defaultView: {},
      fonts: fontSet(),
    } as unknown as Document;
    const container = {
      querySelectorAll: (selector: string) => (selector === "img" ? [image] : []),
    } as unknown as Element;

    await expect(
      waitForExportReadiness(container, document, new AbortController().signal),
    ).rejects.toMatchObject({ code: "DREVER_CLIENT_EXPORT_IMAGE_FAILED" });
    expect(image.decode).not.toHaveBeenCalled();
  });

  it("rejects a font that settled in the error state", async () => {
    const document = {
      fonts: fontSet(font("Presentation Sans", "error")),
    } as unknown as Document;
    const container = { querySelectorAll: () => [] } as unknown as Element;

    await expect(
      waitForExportReadiness(container, document, new AbortController().signal),
    ).rejects.toMatchObject({
      code: "DREVER_CLIENT_EXPORT_FONT_FAILED",
      details: { family: "Presentation Sans" },
    });
  });

  it("checks duplicate authored IDs only after final layout settles", async () => {
    const frames: FrameRequestCallback[] = [];
    const duplicate = [{ id: "chart-title" }, { id: "chart-title" }];
    const document = {
      defaultView: {
        cancelAnimationFrame: vi.fn(),
        requestAnimationFrame(callback: FrameRequestCallback) {
          frames.push(callback);
          return frames.length;
        },
      },
      fonts: fontSet(),
    } as unknown as Document;
    const container = {
      querySelectorAll: (selector: string) => (selector === "[id]" ? duplicate : []),
    } as unknown as Element;

    const readiness = waitForExportReadiness(container, document, new AbortController().signal);
    await flushMicrotasks();
    frames[0]?.(0);
    await flushMicrotasks();
    frames[1]?.(16);

    await expect(readiness).rejects.toMatchObject({
      code: "DREVER_CLIENT_EXPORT_ID_DUPLICATE",
      details: { id: "chart-title" },
    });
  });
});

import type { Page } from "playwright-core";
import { describe, expect, it, vi } from "vite-plus/test";
import { captureRenderedStates, settleRenderedPage } from "./rendered-check.ts";
import type { RenderedCheckFrame } from "./rendered-check-browser.ts";

const frame = (step: number): RenderedCheckFrame => ({
  density: {
    characterCount: 20,
    lineFragmentCount: 2,
    semanticElementCount: 2,
    textAreaRatio: 0.05,
  },
  elements: [],
  issues: [],
  route: step === 0 ? "/" : `/1/${String(step)}`,
  slide: {
    id: "intro",
    index: 0,
    rect: { height: 900, width: 1600, x: 0, y: 0 },
    step,
  },
});

describe("rendered check capture", () => {
  it("reports completed states before a later state fails", async () => {
    let capturedFrame = 0;
    const page = {
      addStyleTag: vi.fn(async () => undefined),
      evaluate: vi.fn(async (_callback: unknown, route?: string) => {
        if (route === undefined) return;
        if (route === "/") return frame(0);
        throw new TypeError("capture failed");
      }),
      goto: vi.fn(async () => ({ ok: () => true })),
      locator: vi.fn(() => ({ waitFor: vi.fn(async () => undefined) })),
      on: vi.fn(),
    } as unknown as Page;

    await expect(
      captureRenderedStates(
        page,
        "http://127.0.0.1:4173/",
        [
          { route: "/", slideId: "intro", slideIndex: 0, step: 0 },
          { route: "/1/1", slideId: "intro", slideIndex: 0, step: 1 },
        ],
        () => {
          capturedFrame += 1;
        },
      ),
    ).rejects.toThrow("capture failed");
    expect(capturedFrame).toBe(1);
  });

  it("bounds font and image settling", async () => {
    vi.useFakeTimers();
    const page = {
      addStyleTag: vi.fn(async () => undefined),
      evaluate: vi.fn(() => new Promise<never>(() => undefined)),
      locator: vi.fn(() => ({ waitFor: vi.fn(async () => undefined) })),
    } as unknown as Page;
    try {
      const settling = settleRenderedPage(page);
      const result = expect(settling).rejects.toThrow(
        "Rendered resources did not settle within 10000ms.",
      );
      await vi.advanceTimersByTimeAsync(10_000);
      await result;
    } finally {
      vi.useRealTimers();
    }
  });
});

import { describe, expect, it } from "vite-plus/test";
import { computeCanvasScale, DEFAULT_CANVAS } from "./canvas.tsx";

describe("canvas scaling", () => {
  it("contains a logical canvas inside landscape and portrait viewports", () => {
    expect(computeCanvasScale(DEFAULT_CANVAS, { width: 1920, height: 1080 })).toBe(1);
    expect(computeCanvasScale(DEFAULT_CANVAS, { width: 960, height: 540 })).toBe(0.5);
    expect(computeCanvasScale(DEFAULT_CANVAS, { width: 1080, height: 1920 })).toBeCloseTo(
      1080 / 1920,
    );
  });

  it("reserves symmetric safe padding before calculating the scale", () => {
    expect(
      computeCanvasScale({ width: 1000, height: 500 }, { width: 1200, height: 700 }, 100),
    ).toBe(1);
  });

  it("returns zero for an unavailable viewport or invalid logical canvas", () => {
    expect(computeCanvasScale(DEFAULT_CANVAS, { width: 0, height: 1080 })).toBe(0);
    expect(computeCanvasScale(DEFAULT_CANVAS, { width: Number.NaN, height: 1080 })).toBe(0);
    expect(computeCanvasScale(DEFAULT_CANVAS, { width: 1920, height: 1080 }, -1)).toBe(0);
    expect(computeCanvasScale({ width: 0, height: 1080 }, { width: 1920, height: 1080 })).toBe(0);
  });
});

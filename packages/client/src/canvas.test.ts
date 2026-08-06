import { describe, expect, it } from "vite-plus/test";
import type { PlannedTheme } from "@drever/schema";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CanvasViewport,
  computeCanvasScale,
  DEFAULT_CANVAS,
  resolveCanvasThemeStyle,
} from "./canvas.tsx";

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

describe("canvas Theme fallback", () => {
  it("maps semantic Theme colors without replacing authored canvas variables", () => {
    const theme = {
      id: "local.dark",
      tokens: { color: { canvas: "#08111f", ink: "#f4f7ff" } },
      manifest: { summary: "A dark local Theme.", title: "Dark" },
    } satisfies PlannedTheme;

    expect(resolveCanvasThemeStyle(theme)).toEqual({
      "--drever-theme-token-canvas": "#08111f",
      "--drever-theme-token-ink": "#f4f7ff",
    });
  });

  it("ignores missing or non-string color tokens", () => {
    const theme = {
      id: "local.invalid-colors",
      tokens: { color: { canvas: 12, ink: null } },
      manifest: { summary: "A Theme without CSS color strings.", title: "Invalid colors" },
    } satisfies PlannedTheme;

    expect(resolveCanvasThemeStyle(theme)).toEqual({});
  });

  it("marks the canvas with the exact Theme id so neutral typography stays scoped", () => {
    const customTheme = {
      id: "local.custom",
      tokens: {},
      manifest: { summary: "A deliberately incomplete custom Theme.", title: "Custom" },
    } satisfies PlannedTheme;

    const markup = renderToStaticMarkup(
      createElement(CanvasViewport, { theme: customTheme }, createElement("span", null, "Slide")),
    );

    expect(markup).toContain('data-drever-theme-id="local.custom"');
    expect(markup).not.toContain('data-drever-theme-id="drever:neutral"');
  });
});

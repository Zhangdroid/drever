import { describe, expect, it } from "vite-plus/test";

import { centerItem, keepItemVisible } from "./docs-navigation-scroll";

describe("docs navigation scrolling", () => {
  it("moves only enough to reveal an item outside the vertical viewport", () => {
    expect(keepItemVisible(120, 100, 80, 24)).toBe(80);
    expect(keepItemVisible(120, 100, 170, 24)).toBe(120);
    expect(keepItemVisible(120, 100, 210, 24)).toBe(134);
  });

  it("centers a horizontal item without scrolling beyond the content", () => {
    expect(centerItem(240, 720, 320, 80)).toBe(240);
    expect(centerItem(240, 720, 0, 80)).toBe(0);
    expect(centerItem(240, 720, 680, 40)).toBe(480);
  });
});

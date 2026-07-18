import { expect, type Locator } from "@playwright/test";

export type ElementBounds = Readonly<{
  height: number;
  width: number;
  x: number;
  y: number;
}>;

export const readElementBounds = (locator: Locator): Promise<ElementBounds> =>
  locator.evaluate((element) => {
    const { height, width, x, y } = element.getBoundingClientRect();
    return { height, width, x, y };
  });

export const expectStableBounds = (actual: ElementBounds, expected: ElementBounds): void => {
  for (const property of ["height", "width", "x", "y"] as const) {
    expect(
      Math.abs(actual[property] - expected[property]),
      `${property} moved`,
    ).toBeLessThanOrEqual(0.05);
  }
};

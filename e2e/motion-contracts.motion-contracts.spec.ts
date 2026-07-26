import { expect, test, type Locator, type Page } from "@playwright/test";
import type { ElementBounds } from "./support/element-bounds.ts";
import { monitorPageHealth } from "./support/page-health.ts";
import {
  captureNextViewTransition,
  monitorViewTransitions,
  readViewTransitionCalls,
  waitForViewTransition,
} from "./support/view-transitions.ts";

const activeSlide = '[data-drever-slide][data-slide-state="active"]';

type Direction = "ArrowLeft" | "ArrowRight";

const readLayoutBounds = (locator: Locator): Promise<ElementBounds> =>
  locator.evaluate((element) => {
    if (!(element instanceof HTMLElement)) throw new Error("Expected an HTML element.");
    const { x, y } = element.getBoundingClientRect();
    return { height: element.offsetHeight, width: element.offsetWidth, x, y };
  });

const expectClose = (actual: number, expected: number, message: string): void => {
  expect(Math.abs(actual - expected), message).toBeLessThanOrEqual(0.1);
};

const expectBoundsSize = (
  bounds: ElementBounds,
  expected: Readonly<{ height: number; width: number }>,
): void => {
  expectClose(bounds.width, expected.width, "width changed");
  expectClose(bounds.height, expected.height, "height changed");
};

const transitionPseudos = (page: Page): Promise<readonly string[]> =>
  page.evaluate(() =>
    document.documentElement.getAnimations({ subtree: true }).flatMap((animation) => {
      const pseudo = Reflect.get(animation.effect ?? {}, "pseudoElement");
      return typeof pseudo === "string" ? [pseudo] : [];
    }),
  );

type SnapshotStyle = Readonly<{
  objectFit: string;
  objectPosition: string;
}>;

const readSnapshotStyle = (page: Page, name: string): Promise<SnapshotStyle> =>
  page.evaluate((transitionName) => {
    const style = getComputedStyle(
      document.documentElement,
      `::view-transition-new(drever-${transitionName})`,
    );
    return { objectFit: style.objectFit, objectPosition: style.objectPosition };
  }, name);

const moveWithSharedGroup = async (
  page: Page,
  direction: Direction,
  expectedPath: RegExp,
  name: string,
  snapshot: SnapshotStyle,
): Promise<void> => {
  const transition = await captureNextViewTransition(page, () => page.keyboard.press(direction));
  await waitForViewTransition(page, transition, "ready");
  await expect(page).toHaveURL(expectedPath);
  expect(await transitionPseudos(page)).toContain(`::view-transition-group(drever-${name})`);
  expect(await readSnapshotStyle(page, name)).toEqual(snapshot);
  await waitForViewTransition(page, transition, "finished");
};

test("plain Steps preserve absolute geometry while MotionGroup keeps directional motion", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await page.goto("/");

  await page.evaluate((activeSlideSelector) => {
    const slide = document.querySelector(activeSlideSelector);
    if (!(slide instanceof HTMLElement)) throw new Error("Expected an active slide.");

    const host = document.createElement("div");
    host.dataset.testid = "absolute-step-host";
    host.style.cssText = "position:relative;width:400px;height:400px";

    const step = document.createElement("div");
    step.dataset.dreverStep = "1";
    step.dataset.stepState = "pending";
    step.dataset.testid = "absolute-step";
    step.ariaHidden = "true";
    step.inert = true;
    step.style.visibility = "hidden";

    const point = document.createElement("span");
    point.dataset.testid = "absolute-step-point";
    point.style.cssText = "position:absolute;top:25%;right:25%;width:20px;height:20px";
    step.append(point);
    host.append(step);

    const motionGroup = document.createElement("div");
    motionGroup.dataset.dreverMotionGroup = "";
    motionGroup.dataset.motionFlow = "inline";
    motionGroup.style.setProperty("--drever-recipe-step-inline-from-translate", "12px 0");

    const directionalStep = document.createElement("div");
    directionalStep.dataset.dreverStep = "1";
    directionalStep.dataset.stepState = "pending";
    directionalStep.dataset.testid = "directional-step";
    directionalStep.style.visibility = "hidden";
    motionGroup.append(directionalStep);

    slide.append(host, motionGroup);
  }, activeSlide);

  const step = page.getByTestId("absolute-step");
  const point = page.getByTestId("absolute-step-point");
  const before = await readLayoutBounds(point);

  await expect(step).toHaveCSS("translate", "none");
  expect(
    await page.getByTestId("directional-step").evaluate((element) => {
      const [x = "0", y = "0"] = getComputedStyle(element).translate.split(" ");
      return [Number.parseFloat(x), Number.parseFloat(y)];
    }),
  ).toEqual([12, 0]);

  await step.evaluate((element) => {
    if (!(element instanceof HTMLElement)) throw new Error("Expected a Step element.");
    element.dataset.stepState = "active";
    element.removeAttribute("aria-hidden");
    element.inert = false;
    element.style.removeProperty("visibility");
  });

  await expect(step).toHaveCSS("opacity", "1");
  const after = await readLayoutBounds(point);
  expectClose(after.x, before.x, "absolute child x rebased");
  expectClose(after.y, before.y, "absolute child y rebased");
  expectBoundsSize(after, before);

  await step.evaluate((element) => {
    if (!(element instanceof HTMLElement)) throw new Error("Expected a Step element.");
    element.dataset.stepState = "pending";
    element.ariaHidden = "true";
    element.inert = true;
    element.style.visibility = "hidden";
  });

  await expect(step).toHaveCSS("opacity", "0");
  const reversed = await readLayoutBounds(point);
  expectClose(reversed.x, before.x, "reverse absolute child x rebased");
  expectClose(reversed.y, before.y, "reverse absolute child y rebased");
  expectBoundsSize(reversed, before);
  health.expectHealthy();
});

type TextContract = Readonly<{
  bounds: ElementBounds;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  letterSpacing: string;
  lineHeight: string;
  lines: readonly Readonly<{ height: number; width: number; x: number; y: number }>[];
  text: string;
}>;

const readTextContract = (locator: Locator): Promise<TextContract> =>
  locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const range = document.createRange();
    range.selectNodeContents(element);
    const lines = Array.from(range.getClientRects(), (rect) => ({
      height: rect.height,
      width: rect.width,
      x: rect.x - bounds.x,
      y: rect.y - bounds.y,
    })).filter(({ height, width }) => height > 0 && width > 0);

    return {
      bounds: {
        height: bounds.height,
        width: bounds.width,
        x: bounds.x,
        y: bounds.y,
      },
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      letterSpacing: style.letterSpacing,
      lineHeight: style.lineHeight,
      lines,
      text: element.textContent ?? "",
    };
  });

const expectSameTextContract = (actual: TextContract, expected: TextContract): void => {
  expect(actual.text).toBe(expected.text);
  expect(actual.fontFamily).toBe(expected.fontFamily);
  expect(actual.fontSize).toBe(expected.fontSize);
  expect(actual.fontWeight).toBe(expected.fontWeight);
  expect(actual.letterSpacing).toBe(expected.letterSpacing);
  expect(actual.lineHeight).toBe(expected.lineHeight);
  expectBoundsSize(actual.bounds, expected.bounds);
  expect(actual.lines).toHaveLength(expected.lines.length);
  expect(actual.lines.length).toBeGreaterThan(1);
  for (const [index, line] of actual.lines.entries()) {
    const expectedLine = expected.lines[index];
    if (expectedLine === undefined) throw new Error(`Missing expected line ${index}.`);
    expectClose(line.width, expectedLine.width, `line ${index} width changed`);
    expectClose(line.height, expectedLine.height, `line ${index} height changed`);
    expectClose(line.x, expectedLine.x, `line ${index} inline position changed`);
    expectClose(line.y, expectedLine.y, `line ${index} block position changed`);
  }
};

test("the fixed shell keeps one raster contract in both directions", async ({ page }) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await page.goto("/2");

  const shell = page.locator(`${activeSlide} [data-testid="shared-shell"]`);
  const shellCopy = page.locator(`${activeSlide} [data-testid="shell-copy"]`);
  const source = await readLayoutBounds(shell);
  expectBoundsSize(source, { height: 270, width: 440 });
  await expect(shell).toHaveCSS("position", "absolute");
  await expect(shellCopy).toContainText("440 × 270");

  const snapshot = { objectFit: "none", objectPosition: "50% 50%" };
  await moveWithSharedGroup(page, "ArrowRight", /\/3$/u, "stable-shell", snapshot);
  const result = await readLayoutBounds(shell);
  expectBoundsSize(result, { height: 270, width: 440 });
  expect(Math.abs(result.x - source.x)).toBeGreaterThan(300);
  await expect(shellCopy).toContainText("new copy outside");

  await moveWithSharedGroup(page, "ArrowLeft", /\/2$/u, "stable-shell", snapshot);
  const reversed = await readLayoutBounds(shell);
  expectClose(reversed.x, source.x, "reverse endpoint x changed");
  expectClose(reversed.y, source.y, "reverse endpoint y changed");
  expectBoundsSize(reversed, source);

  health.expectHealthy();
});

test("persistent text preserves its metrics and wrapping in both directions", async ({ page }) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await page.goto("/4");

  const group = page.locator(`${activeSlide} [data-testid="shared-text"]`);
  const copy = page.locator(`${activeSlide} [data-testid="persistent-copy"]`);
  const source = await readTextContract(copy);
  expectBoundsSize(await readLayoutBounds(group), { height: 124, width: 600 });
  expect(source.fontSize).toBe("43px");
  expect(source.lineHeight).toBe("56px");

  const snapshot = { objectFit: "none", objectPosition: "50% 50%" };
  await moveWithSharedGroup(page, "ArrowRight", /\/5$/u, "stable-text", snapshot);
  const result = await readTextContract(copy);
  expectSameTextContract(result, source);
  expect(Math.abs(result.bounds.x - source.bounds.x)).toBeGreaterThan(300);

  await moveWithSharedGroup(page, "ArrowLeft", /\/4$/u, "stable-text", snapshot);
  const reversed = await readTextContract(copy);
  expectSameTextContract(reversed, source);
  expectClose(reversed.bounds.x, source.bounds.x, "reverse text x changed");
  expectClose(reversed.bounds.y, source.bounds.y, "reverse text y changed");

  health.expectHealthy();
});

type MediaContract = Readonly<{
  content: Readonly<{ height: number; width: number }>;
  frame: ElementBounds;
  image: ElementBounds;
  objectFit: string;
  objectPosition: string;
}>;

const readMediaContract = async (frame: Locator, image: Locator): Promise<MediaContract> => {
  const [frameBounds, content, imageBounds, styles] = await Promise.all([
    readLayoutBounds(frame),
    frame.evaluate((element) => {
      if (!(element instanceof HTMLElement)) throw new Error("Expected an HTML element.");
      return { height: element.clientHeight, width: element.clientWidth };
    }),
    readLayoutBounds(image),
    image.evaluate((element) => {
      const style = getComputedStyle(element);
      return { objectFit: style.objectFit, objectPosition: style.objectPosition };
    }),
  ]);
  return { content, frame: frameBounds, image: imageBounds, ...styles };
};

const expectMediaContract = (
  contract: MediaContract,
  expected: Readonly<{ height: number; width: number }>,
): void => {
  expectBoundsSize(contract.frame, expected);
  expectBoundsSize(contract.image, contract.content);
  expectClose(contract.frame.width / contract.frame.height, 16 / 9, "frame ratio changed");
  expect(contract.objectFit).toBe("cover");
  expect(contract.objectPosition).toBe("50% 48%");
};

test("media keeps an explicit crop contract while resizing in both directions", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await page.goto("/6");

  const frame = page.locator(`${activeSlide} [data-testid="shared-media"]`);
  const image = page.locator(`${activeSlide} [data-testid="stable-media-image"]`);
  const source = await readMediaContract(frame, image);
  expectMediaContract(source, { height: 360, width: 640 });

  const snapshot = { objectFit: "cover", objectPosition: "50% 48%" };
  await moveWithSharedGroup(page, "ArrowRight", /\/7$/u, "stable-media", snapshot);
  const result = await readMediaContract(frame, image);
  expectMediaContract(result, { height: 270, width: 480 });

  await moveWithSharedGroup(page, "ArrowLeft", /\/6$/u, "stable-media", snapshot);
  const reversed = await readMediaContract(frame, image);
  expectMediaContract(reversed, { height: 360, width: 640 });
  expectClose(reversed.frame.x, source.frame.x, "reverse media x changed");
  expectClose(reversed.frame.y, source.frame.y, "reverse media y changed");

  health.expectHealthy();
});

test("reduced motion commits every recipe without capturing a transition", async ({ page }) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/2");

  for (const destination of [3, 4, 5, 6, 7]) {
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(new RegExp(`/${destination}$`, "u"));
  }
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/\/6$/u);

  expect(await readViewTransitionCalls(page)).toEqual([]);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  health.expectHealthy();
});

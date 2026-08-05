import { expect, test, type Locator, type Page } from "@playwright/test";
import type { ElementBounds } from "./support/element-bounds.ts";
import { expectStableBounds, readElementBounds } from "./support/element-bounds.ts";
import { monitorPageHealth } from "./support/page-health.ts";
import { waitForDreverReady } from "./support/drever-ready.ts";
import {
  captureNextViewTransition,
  monitorViewTransitions,
  readViewTransitionCalls,
  waitForViewTransition,
} from "./support/view-transitions.ts";

const activeSlide = '[data-drever-slide][data-slide-state="active"]';

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

test("plain Steps preserve geometry while MotionGroup keeps directional flow", async ({ page }) => {
  const health = monitorPageHealth(page);
  await page.goto("/");
  await waitForDreverReady(page);

  await page.evaluate((activeSlideSelector) => {
    const slide = document.querySelector(activeSlideSelector);
    if (!(slide instanceof HTMLElement)) throw new Error("Expected an active slide.");

    const host = document.createElement("div");
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
    slide.append(host);
  }, activeSlide);

  const step = page.getByTestId("absolute-step");
  const point = page.getByTestId("absolute-step-point");
  const before = await readLayoutBounds(point);

  await expect(step).toHaveCSS("translate", "none");
  await step.evaluate((element) => {
    if (!(element instanceof HTMLElement)) throw new Error("Expected a Step element.");
    element.dataset.stepState = "active";
    element.removeAttribute("aria-hidden");
    element.inert = false;
    element.style.removeProperty("visibility");
  });

  const after = await readLayoutBounds(point);
  expectClose(after.x, before.x, "absolute child x rebased");
  expectClose(after.y, before.y, "absolute child y rebased");
  expectBoundsSize(after, before);

  await page.goto("/2");
  await waitForDreverReady(page);
  const directionalStep = page.getByTestId("step-2");
  const readDirectionalTranslate = () =>
    directionalStep.evaluate((element) => {
      const [x = "0", y = "0"] = getComputedStyle(element).translate.split(" ");
      return {
        x: Number.parseFloat(x) || 0,
        y: Number.parseFloat(y) || 0,
      };
    });
  await expect(directionalStep).toHaveAttribute("data-step-state", "pending");
  expect(
    await directionalStep.evaluate((element) =>
      element.closest("[data-drever-motion-group]")?.getAttribute("data-motion-flow"),
    ),
  ).toBe("block");
  await expect.poll(async () => (await readDirectionalTranslate()).x).toBeCloseTo(0, 5);
  await expect
    .poll(async () => Math.abs((await readDirectionalTranslate()).y))
    .toBeGreaterThan(0.5);

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/2\/2$/u);
  await expect(directionalStep).toHaveAttribute("data-step-state", "active");
  await expect(directionalStep).toHaveCSS("translate", "none");

  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/\/2$/u);
  await expect(directionalStep).toHaveAttribute("data-step-state", "pending");
  await expect
    .poll(async () => Math.abs((await readDirectionalTranslate()).y))
    .toBeGreaterThan(0.5);
  health.expectHealthy();
});

test("one persistent Stage survives Steps and slides on every presentation surface", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await page.goto("/2");
  await waitForDreverReady(page);

  const stage = page.locator("[data-drever-stage]");
  const pageNumber = page.getByTestId("e2e-stage-page-number");
  const initialBounds = await readElementBounds(stage);
  await expect(stage).toHaveCount(1);
  await expect(pageNumber).toHaveText("02 / 07");

  await page.evaluate(() => {
    Reflect.set(globalThis, "__dreverCoreFixtureStage", {
      background: document.querySelector('[data-testid="e2e-stage-background"]'),
      foreground: document.querySelector('[data-testid="e2e-stage-foreground"]'),
      stage: document.querySelector("[data-drever-stage]"),
    });
  });
  const identity = () =>
    page.evaluate(() => {
      const remembered = Reflect.get(globalThis, "__dreverCoreFixtureStage") as
        | Readonly<Record<string, Element>>
        | undefined;
      if (remembered === undefined) throw new Error("Stage identity was not recorded.");
      return {
        background:
          remembered.background === document.querySelector('[data-testid="e2e-stage-background"]'),
        foreground:
          remembered.foreground === document.querySelector('[data-testid="e2e-stage-foreground"]'),
        stage: remembered.stage === document.querySelector("[data-drever-stage]"),
      };
    });

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/2\/2$/u);
  expect(await identity()).toEqual({ background: true, foreground: true, stage: true });
  expect(await readViewTransitionCalls(page)).toEqual([]);

  const transition = await captureNextViewTransition(page, () => page.keyboard.press("ArrowDown"));
  await waitForViewTransition(page, transition, "ready");
  await expect(page).toHaveURL(/\/3$/u);
  expect(await identity()).toEqual({ background: true, foreground: true, stage: true });
  expectStableBounds(await readElementBounds(stage), initialBounds);
  await expect(pageNumber).toHaveText("03 / 07");
  await waitForViewTransition(page, transition, "finished");

  await page.goto("/speaker/5");
  await expect(
    page.getByTestId("speaker-current").getByTestId("e2e-stage-foreground"),
  ).toHaveAttribute("data-render-mode", "speaker-current");
  await expect(
    page.getByTestId("speaker-next").getByTestId("e2e-stage-foreground"),
  ).toHaveAttribute("data-render-mode", "speaker-next");
  for (const testId of ["shared-shell", "shared-text", "shared-media"]) {
    await expect(
      page.getByTestId("speaker-current").locator(activeSlide).getByTestId(testId),
    ).toHaveCSS("view-transition-name", "none");
    await expect(
      page.getByTestId("speaker-next").locator(activeSlide).getByTestId(testId),
    ).toHaveCSS("view-transition-name", "none");
  }

  await page.goto("/document");
  const documentStages = page.locator(
    '[data-drever-document-page] [data-testid="e2e-stage-foreground"]',
  );
  const documentBackgrounds = page.locator(
    '[data-drever-document-page] [data-testid="e2e-stage-background"]',
  );
  await expect(documentStages).toHaveCount(7);
  await expect(documentBackgrounds).toHaveCount(7);
  await expect(documentStages.first()).toHaveAttribute("data-render-mode", "document");
  await expect(documentBackgrounds.first()).toHaveAttribute("data-render-mode", "document");
  for (const name of ["stable-shell", "stable-text", "stable-media"]) {
    const groups = page.locator(`[data-drever-document] [data-motion-name="${name}"]`);
    await expect(groups).toHaveCount(2);
    for (const group of await groups.all()) {
      await expect(group).toHaveCSS("view-transition-name", "none");
    }
  }
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
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
        height: (element as HTMLElement).offsetHeight,
        width: (element as HTMLElement).offsetWidth,
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
    if (expectedLine === undefined) throw new Error(`Missing expected line ${String(index)}.`);
    expectClose(line.width, expectedLine.width, `line ${String(index)} width changed`);
    expectClose(line.height, expectedLine.height, `line ${String(index)} height changed`);
    expectClose(line.x, expectedLine.x, `line ${String(index)} inline position changed`);
    expectClose(line.y, expectedLine.y, `line ${String(index)} block position changed`);
  }
};

type MediaContract = Readonly<{
  frame: ElementBounds;
  image: ElementBounds;
  objectFit: string;
  objectPosition: string;
}>;

const readMediaContract = async (frame: Locator, image: Locator): Promise<MediaContract> => {
  const [frameBounds, imageBounds, styles] = await Promise.all([
    readLayoutBounds(frame),
    readLayoutBounds(image),
    image.evaluate((element) => {
      const style = getComputedStyle(element);
      return { objectFit: style.objectFit, objectPosition: style.objectPosition };
    }),
  ]);
  return { frame: frameBounds, image: imageBounds, ...styles };
};

test("continuity preserves stable shell, text, and media contracts in both directions", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await page.goto("/5");
  await waitForDreverReady(page);

  const shell = page.locator(`${activeSlide} [data-testid="shared-shell"]`);
  const shellBody = page.locator(`${activeSlide} [data-testid="shell-copy"]`);
  const text = page.locator(`${activeSlide} [data-testid="persistent-copy"]`);
  const media = page.locator(`${activeSlide} [data-testid="shared-media"]`);
  const image = page.locator(`${activeSlide} [data-testid="stable-media-image"]`);
  const sourceShell = await readLayoutBounds(shell);
  const sourceText = await readTextContract(text);
  const sourceMedia = await readMediaContract(media, image);
  const sourcePaint = await shellBody.evaluate((element) => {
    const style = getComputedStyle(element.parentElement ?? element);
    return { backgroundColor: style.backgroundColor, borderColor: style.borderColor };
  });
  expectBoundsSize(sourceShell, { height: 230, width: 420 });
  expectBoundsSize(sourceText.bounds, { height: 100, width: 440 });
  expectBoundsSize(sourceMedia.frame, { height: 225, width: 400 });

  const forward = await captureNextViewTransition(page, () => page.keyboard.press("ArrowRight"));
  await waitForViewTransition(page, forward, "ready");
  await expect(page).toHaveURL(/\/6$/u);
  expect(await transitionPseudos(page)).toEqual(
    expect.arrayContaining([
      "::view-transition-group(drever-stable-shell)",
      "::view-transition-group(drever-stable-text)",
      "::view-transition-group(drever-stable-media)",
    ]),
  );
  await waitForViewTransition(page, forward, "finished");

  const targetShell = await readLayoutBounds(shell);
  const targetText = await readTextContract(text);
  const targetMedia = await readMediaContract(media, image);
  expectBoundsSize(targetShell, sourceShell);
  expect(Math.abs(targetShell.x - sourceShell.x)).toBeGreaterThan(200);
  expectSameTextContract(targetText, sourceText);
  expect(Math.abs(targetText.bounds.y - sourceText.bounds.y)).toBeGreaterThan(100);
  expectBoundsSize(targetMedia.frame, { height: 180, width: 320 });
  expectBoundsSize(targetMedia.image, targetMedia.frame);
  expect(targetMedia.objectFit).toBe("cover");
  expect(targetMedia.objectPosition).toBe("50% 48%");
  await expect
    .poll(() =>
      shellBody.evaluate((element) => {
        const style = getComputedStyle(element.parentElement ?? element);
        return { backgroundColor: style.backgroundColor, borderColor: style.borderColor };
      }),
    )
    .toEqual(sourcePaint);

  const reverse = await captureNextViewTransition(page, () => page.keyboard.press("ArrowLeft"));
  await waitForViewTransition(page, reverse, "finished");
  await expect(page).toHaveURL(/\/5$/u);
  expectStableBounds(await readLayoutBounds(shell), sourceShell);
  expectSameTextContract(await readTextContract(text), sourceText);
  const returnedMedia = await readMediaContract(media, image);
  expectBoundsSize(returnedMedia.frame, sourceMedia.frame);
  expect(await readViewTransitionCalls(page)).toEqual([
    { kind: "document", target: "document", types: ["drever-slide-forward"] },
    { kind: "document", target: "document", types: ["drever-slide-backward"] },
  ]);
  health.expectHealthy();
});

test("reduced motion commits Steps and continuity endpoints without captured motion", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.goto("/2");
  await waitForDreverReady(page);
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/2\/2$/u);

  await page.goto("/5");
  await waitForDreverReady(page);
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/6$/u);
  await expect(page.locator(`${activeSlide} [data-testid="shared-shell"]`)).toHaveCSS(
    "view-transition-name",
    "none",
  );
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/\/5$/u);

  expect(await readViewTransitionCalls(page)).toEqual([]);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  health.expectHealthy();
});

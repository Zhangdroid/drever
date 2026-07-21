import { expect, test, type Locator } from "@playwright/test";
import { expectStableBounds, readElementBounds } from "./support/element-bounds.ts";
import { monitorPageHealth } from "./support/page-health.ts";
import {
  captureNextViewTransition,
  monitorViewTransitions,
  readViewTransitionCalls,
  waitForViewTransition,
} from "./support/view-transitions.ts";

const activeSlide = '[data-drever-slide][data-slide-state="active"]';

const readTranslate = (locator: Locator): Promise<readonly [number, number]> =>
  locator.evaluate((element) => {
    const [x = "0", y = "0"] = getComputedStyle(element).translate.split(" ");
    return [Number.parseFloat(x), Number.parseFloat(y)] as const;
  });

test("the product tour proves interaction, persistence, and the speaker workflow", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await page.goto("/3");

  await expect(page.locator(activeSlide)).toContainText("Let the room answer.");
  const explore = page.getByRole("button", { name: "Let me try" });
  await explore.click();
  await expect(explore).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status")).toContainText("Hand over control");

  await explore.blur();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/4$/u);
  await page.goBack();
  await expect(page).toHaveURL(/\/3$/u);
  await expect(explore).toHaveAttribute("aria-pressed", "true");

  const speakerPromise = page.waitForEvent("popup");
  await page.keyboard.press("p");
  const speaker = await speakerPromise;
  const speakerHealth = monitorPageHealth(speaker);
  await expect(speaker).toHaveURL(/\/speaker\/3$/u);
  await expect(speaker.locator("[data-drever-speaker]")).toBeVisible();
  await expect(speaker.getByTestId("speaker-notes")).toContainText("React state survives");
  await expect(speaker.getByTestId("rehearsal-target")).toHaveValue("20");
  const relations = await speaker.evaluate(() => {
    const references = [
      ...Array.from(document.querySelectorAll(".tour-signal[aria-labelledby]"), (element) =>
        element.getAttribute("aria-labelledby"),
      ),
      ...Array.from(
        document.querySelectorAll(".tour-motion__button[aria-describedby]"),
        (element) => element.getAttribute("aria-describedby"),
      ),
    ].filter((value): value is string => value !== null);
    const counts = new Map<string, number>();
    for (const { id } of document.querySelectorAll<HTMLElement>("[id]")) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return {
      allResolveOnce: references.every((id) => counts.get(id) === 1),
      references,
    };
  });
  expect(relations.references.length).toBeGreaterThanOrEqual(2);
  expect(new Set(relations.references).size).toBe(relations.references.length);
  expect(relations.allResolveOnce).toBe(true);

  speakerHealth.expectHealthy();
  await speaker.close();
  health.expectHealthy();
});

test("the product narrative renders default plugins, exact routes, and its motion model", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await page.goto("/");
  await expect(page.locator(activeSlide).locator('[data-drever-layout="masthead"]')).toBeVisible();

  await page.goto("/4");

  const tailwindProof = page.getByTestId("tailwind-proof");
  await expect(tailwindProof).toHaveCSS("font-size", "15px");
  await expect(tailwindProof).toHaveCSS("text-transform", "uppercase");
  await expect(page.locator(`${activeSlide} pre.shiki`)).toBeVisible();

  await page.goto("/6");

  await expect(page.locator(activeSlide)).toContainText("Send people back to the exact moment.");
  const feature = page.locator(activeSlide).locator('[data-drever-layout="feature"]');
  await expect(feature).toBeVisible();
  await expect(feature.locator("figure")).toHaveCSS("margin-left", "0px");
  await expect(feature.locator("figure")).toHaveCSS("margin-right", "0px");
  await expect(page.locator(activeSlide).getByText("/speaker/5/2", { exact: true })).toBeVisible();

  await page.goto("/5/2");
  await expect(page.locator(`${activeSlide} [data-drever-step="2"]`)).toHaveAttribute(
    "data-step-state",
    "active",
  );
  await page.reload();
  await expect(page).toHaveURL(/\/5\/2$/u);
  await expect(page.locator(`${activeSlide} [data-drever-step="2"]`)).toHaveAttribute(
    "data-step-state",
    "active",
  );

  await page.goto("/7");
  const canvasModel = page.locator(".tour-motion__canvas");
  await expect(canvasModel).toContainText("Assumption");
  await page.getByRole("button", { name: "Change the idea" }).click();
  await expect(canvasModel).toContainText("Evidence");
  await expect(page.getByRole("status")).toContainText("Evidence");

  health.expectHealthy();
});

test("the global stage stays mounted while slides and Steps change independently", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await page.goto("/5");

  const canvas = page.locator("[data-drever-canvas]");
  const stage = page.locator("[data-drever-stage]");
  const backgroundLayer = page.locator('[data-drever-stage-layer="background"]');
  const background = page.getByTestId("tour-stage-background");
  const pageNumber = page.getByTestId("tour-stage-page-number");
  const initialBounds = await readElementBounds(stage);

  await expect(stage).toHaveCount(1);
  await expect(stage).toHaveAttribute("data-page-number", "5");
  await expect(stage).toHaveAttribute("data-current-step", "0");
  await expect(backgroundLayer).toHaveAttribute("aria-hidden", "true");
  await expect(backgroundLayer).toHaveAttribute("inert", "");
  await expect(background).toHaveCSS("view-transition-name", "none");
  await expect(pageNumber).toHaveText("05 / 14");
  await expect(pageNumber).toHaveCSS("view-transition-name", "none");
  await expect(page.locator(activeSlide)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  expectStableBounds(await readElementBounds(canvas), initialBounds);
  expectStableBounds(await readElementBounds(backgroundLayer), initialBounds);
  expectStableBounds(await readElementBounds(background), initialBounds);

  await page.evaluate(() => {
    const select = (selector: string): Element => {
      const element = document.querySelector(selector);
      if (element === null) throw new Error(`Missing persistent stage node: ${selector}`);
      return element;
    };
    Reflect.set(globalThis, "__dreverProductTourStageNodes", {
      background: select('[data-testid="tour-stage-background"]'),
      backgroundLayer: select('[data-drever-stage-layer="background"]'),
      pageNumber: select('[data-testid="tour-stage-page-number"]'),
      stage: select("[data-drever-stage]"),
    });
  });
  const stageIdentity = () =>
    page.evaluate(() => {
      const remembered = Reflect.get(globalThis, "__dreverProductTourStageNodes") as
        | Readonly<Record<string, Element>>
        | undefined;
      if (remembered === undefined) throw new Error("The persistent stage nodes were not saved.");
      return {
        background:
          remembered.background === document.querySelector('[data-testid="tour-stage-background"]'),
        backgroundLayer:
          remembered.backgroundLayer ===
          document.querySelector('[data-drever-stage-layer="background"]'),
        pageNumber:
          remembered.pageNumber ===
          document.querySelector('[data-testid="tour-stage-page-number"]'),
        stage: remembered.stage === document.querySelector("[data-drever-stage]"),
      };
    });

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/5\/1$/u);
  await expect(stage).toHaveAttribute("data-current-step", "1");
  await expect(pageNumber).toHaveText("05 / 14");
  expect(await stageIdentity()).toEqual({
    background: true,
    backgroundLayer: true,
    pageNumber: true,
    stage: true,
  });
  expectStableBounds(await readElementBounds(stage), initialBounds);
  expectStableBounds(await readElementBounds(background), initialBounds);
  expect(await readViewTransitionCalls(page)).toEqual([]);

  const nextSlide = await captureNextViewTransition(page, () => page.keyboard.press("ArrowDown"));
  await waitForViewTransition(page, nextSlide, "ready");
  await expect(page).toHaveURL(/\/6$/u);
  await expect(stage).toHaveAttribute("data-page-number", "6");
  await expect(stage).toHaveAttribute("data-current-step", "0");
  await expect(pageNumber).toHaveText("06 / 14");
  await expect(page.locator(activeSlide)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  expect(await stageIdentity()).toEqual({
    background: true,
    backgroundLayer: true,
    pageNumber: true,
    stage: true,
  });
  expectStableBounds(await readElementBounds(stage), initialBounds);
  expectStableBounds(await readElementBounds(backgroundLayer), initialBounds);
  expectStableBounds(await readElementBounds(background), initialBounds);
  await waitForViewTransition(page, nextSlide, "finished");

  expect(await readViewTransitionCalls(page)).toEqual([
    { kind: "element", target: "deck", types: ["drever-slide-forward"] },
  ]);
  health.expectHealthy();
});

test("the recurring Signal keeps one identity and geometry across the stage", async ({ page }) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await page.goto("/");

  const foreground = page.locator(".tour-stage-foreground");
  const signal = page.getByTestId("tour-stage-signal");
  const readSignalPaint = () =>
    signal.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        borderRightColor: style.borderRightColor,
        opacity: style.opacity,
      };
    });
  const finishSignalMotion = () =>
    signal.evaluate(async (element) => {
      await Promise.all(element.getAnimations().map(({ finished }) => finished));
    });

  await expect(foreground).toHaveAttribute("data-signal-position", "edge");
  await expect(signal).toHaveCSS("view-transition-name", "none");
  const openingBounds = await readElementBounds(signal);
  const openingPaint = await readSignalPaint();
  await signal.evaluate((element) => {
    Reflect.set(globalThis, "__dreverProductTourSignal", element);
  });

  const frameTransition = await captureNextViewTransition(page, () =>
    page.keyboard.press("ArrowDown"),
  );
  await waitForViewTransition(page, frameTransition, "ready");
  await expect(page).toHaveURL(/\/2$/u);
  await expect(foreground).toHaveAttribute("data-signal-position", "frame");
  expect(
    await signal.evaluate(
      (element) => element === Reflect.get(globalThis, "__dreverProductTourSignal"),
    ),
  ).toBe(true);
  await expect(signal).toHaveCSS("transition-property", "translate");
  await waitForViewTransition(page, frameTransition, "finished");
  await finishSignalMotion();
  const frameBounds = await readElementBounds(signal);
  expect(frameBounds.width).toBeCloseTo(openingBounds.width, 3);
  expect(frameBounds.height).toBeCloseTo(openingBounds.height, 3);
  expect(frameBounds.x).not.toBeCloseTo(openingBounds.x, 3);
  expect(frameBounds.y).not.toBeCloseTo(openingBounds.y, 3);
  expect(await readSignalPaint()).toEqual(openingPaint);

  const persistentTransition = await captureNextViewTransition(page, () =>
    page.keyboard.press("ArrowDown"),
  );
  await waitForViewTransition(page, persistentTransition, "ready");
  await expect(page).toHaveURL(/\/3$/u);
  await expect(foreground).toHaveAttribute("data-signal-position", "frame");
  expect(await signal.evaluate((element) => element.getAnimations().length)).toBe(0);
  await waitForViewTransition(page, persistentTransition, "finished");
  expectStableBounds(await readElementBounds(signal), frameBounds);

  health.expectHealthy();
});

test("semantic focus and replacement preserve geometry and accessibility state", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);

  await page.goto("/5");
  const focus = page.locator(`${activeSlide} [data-motion-intent="focus"]`);
  const focusSteps = focus.locator(":scope > [data-drever-step]");
  const focusBounds = await readElementBounds(focus);
  await expect(focus).toHaveAttribute("data-motion-flow", "block");
  await expect(focusSteps).toHaveCount(3);
  await expect(focusSteps.first()).toHaveAttribute("data-step-state", "pending");
  await expect(focusSteps.first()).toHaveAttribute("aria-hidden", "true");
  expect(await readTranslate(focusSteps.first())).toEqual([0, 12]);
  await expect(focusSteps.first()).toHaveCSS("scale", "1");

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/5\/1$/u);
  expectStableBounds(await readElementBounds(focus), focusBounds);
  await expect(focusSteps.first()).toHaveAttribute("data-step-state", "active");
  await expect(focusSteps.first()).not.toHaveAttribute("aria-hidden", "true");

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/5\/2$/u);
  expectStableBounds(await readElementBounds(focus), focusBounds);
  await expect(focusSteps.first()).toHaveAttribute("data-step-state", "complete");
  await expect(focusSteps.first()).not.toHaveAttribute("inert", "");
  await expect(focusSteps.nth(1)).toHaveAttribute("data-step-state", "active");
  await expect(focusSteps.nth(1)).toHaveCSS("opacity", "1");
  const focusedCompletedOpacity = Number(
    await focusSteps.first().evaluate((element) => getComputedStyle(element).opacity),
  );
  const focusedActiveOpacity = Number(
    await focusSteps.nth(1).evaluate((element) => getComputedStyle(element).opacity),
  );
  expect(focusedCompletedOpacity).toBeGreaterThanOrEqual(0.5);
  expect(focusedCompletedOpacity).toBeLessThan(focusedActiveOpacity);

  await page.goto("/11");
  const replace = page.getByTestId("motion-replace");
  const replaceSteps = replace.locator(":scope > [data-drever-step]");
  const replaceBounds = await readElementBounds(replace);
  await expect(replace).toHaveAttribute("data-motion-flow", "inline");
  await expect(replaceSteps).toHaveCount(3);
  expect(await readTranslate(replaceSteps.first())).toEqual([12, 0]);

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/11\/1$/u);
  expectStableBounds(await readElementBounds(replace), replaceBounds);
  await expect(replaceSteps.first()).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/11\/2$/u);
  expectStableBounds(await readElementBounds(replace), replaceBounds);
  await expect(replaceSteps.first()).toHaveAttribute("data-step-state", "complete");
  await expect(replaceSteps.first()).toHaveAttribute("aria-hidden", "true");
  await expect(replaceSteps.first()).toHaveAttribute("inert", "");
  await expect(replaceSteps.first()).toBeHidden();
  await expect(replaceSteps.nth(1)).toHaveAttribute("data-step-state", "active");
  await expect(replaceSteps.nth(1)).toBeVisible();

  expect(await readViewTransitionCalls(page)).toEqual([]);
  health.expectHealthy();
});

test("continuity preserves stable named identities in both directions", async ({ page }) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await page.goto("/12");

  const continuity = page.locator(`${activeSlide} [data-testid="motion-continuity"]`);
  const named = (name: string): Locator =>
    page.locator(`${activeSlide} [data-motion-name="${name}"]`);
  const track = named("story-signal-track");
  const cap = named("story-signal-cap");
  const story = page.getByTestId("tour-stage-story");
  const readContinuityContract = () =>
    continuity.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const text = element.querySelector("strong");
      if (text === null) throw new Error("The continuity example requires a primary label.");
      const groupStyle = getComputedStyle(element);
      const textStyle = getComputedStyle(text);
      return {
        aspectRatio: bounds.width / bounds.height,
        boxSizing: groupStyle.boxSizing,
        height: bounds.height,
        label: element.textContent?.replace(/\s+/gu, " ").trim(),
        text: {
          fontFamily: textStyle.fontFamily,
          fontSize: textStyle.fontSize,
          fontWeight: textStyle.fontWeight,
          letterSpacing: textStyle.letterSpacing,
          lineHeight: textStyle.lineHeight,
        },
        width: bounds.width,
      };
    });
  const readNamedContract = (locator: Locator) =>
    locator.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const content = element.firstElementChild ?? element;
      const style = getComputedStyle(content);
      return {
        bounds: {
          height: bounds.height,
          width: bounds.width,
          x: bounds.x,
          y: bounds.y,
        },
        clipPath: style.clipPath,
      };
    });
  const readStoryContract = () =>
    story.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const source = element.querySelector<HTMLElement>('[data-story-copy="source"]');
      const result = element.querySelector<HTMLElement>('[data-story-copy="result"]');
      if (source === null || result === null)
        throw new Error("The story slot requires both copies.");
      const readCopy = (copy: HTMLElement) => {
        const style = getComputedStyle(copy);
        return {
          metrics: {
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontStretch: style.fontStretch,
            fontWeight: style.fontWeight,
            letterSpacing: style.letterSpacing,
            lineHeight: style.lineHeight,
          },
          opacity: style.opacity,
          translate: style.translate,
        };
      };
      return {
        bounds: { height: bounds.height, width: bounds.width, x: bounds.x, y: bounds.y },
        result: readCopy(result),
        source: readCopy(source),
      };
    });
  const expectStableContinuityContract = (
    candidate: Awaited<ReturnType<typeof readContinuityContract>>,
    expected: Awaited<ReturnType<typeof readContinuityContract>>,
  ) => {
    expect(candidate.width).toBeCloseTo(expected.width, 3);
    expect(candidate.height).toBeCloseTo(expected.height, 3);
    expect(candidate.aspectRatio).toBeCloseTo(expected.aspectRatio, 3);
    expect(candidate.boxSizing).toBe(expected.boxSizing);
    expect(candidate.label).toBe(expected.label);
    expect(candidate.text).toEqual(expected.text);
  };
  await expect(continuity).toHaveAttribute("data-motion-name", "deck-contract");
  await expect(continuity).toHaveCSS("view-transition-name", "drever-deck-contract");
  await expect(track).toHaveCSS("view-transition-name", "drever-story-signal-track");
  await expect(cap).toHaveCSS("view-transition-name", "drever-story-signal-cap");
  await expect(story).toHaveCSS("view-transition-name", "none");
  await expect(page.locator(`${activeSlide} h2`)).toHaveCSS("view-transition-name", "none");

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/12\/1$/u);
  await expect(continuity).toHaveCSS("view-transition-name", "drever-deck-contract");
  await expect(story).toHaveAttribute("data-story-state", "source");
  const sourceContract = await readContinuityContract();
  const sourceNamed = {
    cap: await readNamedContract(cap),
    track: await readNamedContract(track),
  };
  const sourceStory = await readStoryContract();
  await story.evaluate((element) => {
    Reflect.set(globalThis, "__dreverProductTourStory", element);
  });

  const forwardTransition = await captureNextViewTransition(page, () =>
    page.keyboard.press("ArrowRight"),
  );
  await waitForViewTransition(page, forwardTransition, "ready");
  await expect(page).toHaveURL(/\/13$/u);
  expect(
    await page.evaluate(() =>
      document.documentElement.getAnimations({ subtree: true }).flatMap((animation) => {
        const pseudo = Reflect.get(animation.effect ?? {}, "pseudoElement");
        return typeof pseudo === "string" ? [pseudo] : [];
      }),
    ),
  ).toEqual(
    expect.arrayContaining([
      "::view-transition-group(drever-deck-contract)",
      "::view-transition-group(drever-story-signal-cap)",
      "::view-transition-group(drever-story-signal-track)",
    ]),
  );
  await expect(story).toHaveAttribute("data-story-state", "result");
  expect(
    await story.evaluate(
      (element) => element === Reflect.get(globalThis, "__dreverProductTourStory"),
    ),
  ).toBe(true);
  await expect(page.locator(`${activeSlide} h2`)).toHaveCSS("view-transition-name", "none");
  await waitForViewTransition(page, forwardTransition, "finished");
  await expect(continuity).toHaveCSS("view-transition-name", "drever-deck-contract");
  expectStableContinuityContract(await readContinuityContract(), sourceContract);
  const resultNamed = {
    cap: await readNamedContract(cap),
    track: await readNamedContract(track),
  };
  const resultStory = await readStoryContract();
  expectStableBounds(resultStory.bounds, sourceStory.bounds);
  expectStableBounds(resultNamed.track.bounds, sourceNamed.track.bounds);
  expect(resultStory.result.metrics).toEqual(resultStory.source.metrics);
  expect(resultStory.source.opacity).toBe("0");
  expect(resultStory.result.opacity).toBe("1");
  expect(resultStory.source.translate).not.toBe("0px");
  expect(resultStory.result.translate).toBe("0px");
  expect(resultNamed.track.clipPath).not.toBe(sourceNamed.track.clipPath);
  expect(resultNamed.cap.bounds.width).toBeCloseTo(sourceNamed.cap.bounds.width, 3);
  expect(resultNamed.cap.bounds.height).toBeCloseTo(sourceNamed.cap.bounds.height, 3);
  expect(resultNamed.cap.bounds.y).toBeCloseTo(sourceNamed.cap.bounds.y, 3);
  expect(resultNamed.cap.bounds.x).not.toBeCloseTo(sourceNamed.cap.bounds.x, 3);

  const backwardTransition = await captureNextViewTransition(page, () =>
    page.keyboard.press("ArrowLeft"),
  );
  await waitForViewTransition(page, backwardTransition, "ready");
  await expect(page).toHaveURL(/\/12\/1$/u);
  expect(
    await page.evaluate(() =>
      document.documentElement.getAnimations({ subtree: true }).flatMap((animation) => {
        const pseudo = Reflect.get(animation.effect ?? {}, "pseudoElement");
        return typeof pseudo === "string" ? [pseudo] : [];
      }),
    ),
  ).toContain("::view-transition-group(drever-deck-contract)");
  await waitForViewTransition(page, backwardTransition, "finished");
  await expect(continuity).toHaveCSS("view-transition-name", "drever-deck-contract");
  await expect(story).toHaveAttribute("data-story-state", "source");
  expectStableContinuityContract(await readContinuityContract(), sourceContract);
  expectStableBounds((await readStoryContract()).bounds, sourceStory.bounds);
  expectStableBounds((await readNamedContract(track)).bounds, sourceNamed.track.bounds);
  expectStableBounds((await readNamedContract(cap)).bounds, sourceNamed.cap.bounds);

  expect(await readViewTransitionCalls(page)).toEqual([
    { kind: "element", target: "deck", types: ["drever-slide-forward"] },
    { kind: "element", target: "deck", types: ["drever-slide-backward"] },
  ]);
  health.expectHealthy();
});

test("reduced-motion audience state changes without motion capture", async ({ page }) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/5");

  await page.getByRole("button", { name: "Next presentation state" }).click();
  await expect(page).toHaveURL(/\/5\/1$/u);
  await expect(page.locator(`${activeSlide} [data-drever-step="1"]`)).toHaveAttribute(
    "data-step-state",
    "active",
  );
  expect(await readViewTransitionCalls(page)).toEqual([]);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);

  await page.goto("/");
  await page.getByRole("button", { name: "Next presentation state" }).click();
  await expect(page).toHaveURL(/\/2$/u);
  await expect(page.locator(".tour-stage-foreground")).toHaveAttribute(
    "data-signal-position",
    "frame",
  );
  expect(
    await page
      .getByTestId("tour-stage-signal")
      .evaluate((element) => element.getAnimations().length),
  ).toBe(0);

  await page.goto("/12");
  await expect(page.locator(`${activeSlide} [data-testid="motion-continuity"]`)).toHaveCSS(
    "view-transition-name",
    "none",
  );
  await page.getByRole("button", { name: "Next presentation state" }).click();
  await expect(page).toHaveURL(/\/12\/1$/u);
  await expect(page.locator(`${activeSlide} [data-testid="motion-continuity"]`)).toHaveCSS(
    "view-transition-name",
    "none",
  );
  await page.getByRole("button", { name: "Next presentation state" }).click();
  await expect(page).toHaveURL(/\/13$/u);
  await expect(page.locator(activeSlide)).toHaveAttribute("id", "slide-13");
  await expect(page.locator(`${activeSlide} [data-testid="motion-continuity"]`)).toHaveCSS(
    "view-transition-name",
    "none",
  );
  expect(await readViewTransitionCalls(page)).toEqual([]);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);

  health.expectHealthy();
});

test("speaker and document surfaces project static stages without motion identities", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
    false,
  );

  await page.goto("/speaker/12/1");
  const speakerCurrent = page.getByTestId("speaker-current");
  const speakerNext = page.getByTestId("speaker-next");
  await expect(speakerCurrent.locator("[data-drever-stage]")).toHaveAttribute(
    "data-drever-render-mode",
    "speaker-current",
  );
  await expect(speakerNext.locator("[data-drever-stage]")).toHaveAttribute(
    "data-drever-render-mode",
    "speaker-next",
  );
  await expect(speakerCurrent.getByTestId("tour-stage-background")).toHaveCount(1);
  await expect(speakerNext.getByTestId("tour-stage-background")).toHaveCount(1);
  await expect(speakerCurrent.getByTestId("tour-stage-page-number")).toHaveText("12 / 14");
  await expect(speakerNext.getByTestId("tour-stage-page-number")).toHaveText("13 / 14");
  await expect(speakerCurrent.locator('[data-drever-stage-layer="background"]')).toHaveAttribute(
    "inert",
    "",
  );
  await expect(speakerCurrent.getByTestId("tour-stage-background")).toHaveCSS(
    "view-transition-name",
    "none",
  );
  await expect(speakerCurrent.locator(activeSlide).getByTestId("motion-continuity")).toHaveCSS(
    "view-transition-name",
    "none",
  );
  await expect(speakerNext.locator(activeSlide).getByTestId("motion-continuity")).toHaveCSS(
    "view-transition-name",
    "none",
  );

  await page.goto("/document");
  const documentPages = page.locator("[data-drever-document-page]");
  const documentStages = documentPages.locator("[data-drever-stage]");
  const documentBackgrounds = documentPages.getByTestId("tour-stage-background");
  const documentPageNumbers = documentPages.getByTestId("tour-stage-page-number");
  await expect(documentPages).toHaveCount(14);
  await expect(documentStages).toHaveCount(14);
  await expect(documentBackgrounds).toHaveCount(14);
  await expect(documentPageNumbers).toHaveCount(14);
  await expect(documentPages.first().getByTestId("tour-stage-page-number")).toHaveText("01 / 14");
  await expect(documentPages.last().getByTestId("tour-stage-page-number")).toHaveText("14 / 14");
  await expect(documentStages.first()).toHaveAttribute("data-drever-render-mode", "document");
  await expect(documentStages.last()).toHaveAttribute("data-drever-render-mode", "document");
  await expect(documentBackgrounds.first()).toHaveCSS("view-transition-name", "none");
  expectStableBounds(
    await readElementBounds(documentStages.first()),
    await readElementBounds(documentPages.first()),
  );
  const documentContinuity = page
    .locator("[data-drever-document]")
    .getByTestId("motion-continuity");
  await expect(documentContinuity).toHaveCount(2);
  await expect(documentContinuity.first()).toHaveCSS("view-transition-name", "none");
  await expect(documentContinuity.last()).toHaveCSS("view-transition-name", "none");
  const documentReplacements = page
    .locator("[data-drever-document]")
    .getByTestId("motion-replace")
    .locator(":scope > [data-drever-step]");
  await expect(documentReplacements).toHaveCount(3);
  const replacementBounds = await documentReplacements.evaluateAll((steps) =>
    steps.map((step) => {
      const { height, y } = step.getBoundingClientRect();
      return { height, y };
    }),
  );
  for (const [index, replacement] of replacementBounds.entries()) {
    await expect(documentReplacements.nth(index)).toBeVisible();
    await expect(documentReplacements.nth(index)).not.toHaveAttribute("aria-hidden", "true");
    if (index > 0) {
      const previous = replacementBounds[index - 1];
      if (previous === undefined) {
        throw new Error("Expected the previous replacement bounds.");
      }
      expect(replacement.y).toBeGreaterThanOrEqual(previous.y + previous.height);
    }
  }
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);

  health.expectHealthy();
});

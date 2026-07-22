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

  await expect(page.locator(activeSlide)).toContainText("Ask the room.");
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
  await expect(speaker.getByTestId("speaker-notes")).toContainText("keeps its state");
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
  expect(relations.references.length).toBeGreaterThan(0);
  expect(new Set(relations.references).size).toBe(relations.references.length);
  expect(relations.allResolveOnce).toBe(true);

  speakerHealth.expectHealthy();
  await speaker.close();
  health.expectHealthy();
});

test("the narrative connects an editable brief, exact routes, and local story motion", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await page.goto("/2");

  await expect(page.locator(activeSlide)).toContainText("Tell your AI what must happen");
  await expect(page.locator(`${activeSlide} .tour-brief__input`)).toContainText(
    "Approve the launch pilot",
  );
  await expect(page.locator(`${activeSlide} .tour-brief__story`)).toContainText("Reveal the proof");

  await page.goto("/7");
  await expect(page.locator(activeSlide)).toContainText("Send the moment, not directions.");
  const feature = page.locator(activeSlide).locator('[data-drever-layout="feature"]');
  await expect(feature).toBeVisible();
  await expect(feature.locator("figure")).toHaveCSS("margin-left", "0px");
  await expect(feature.locator("figure")).toHaveCSS("margin-right", "0px");
  const stateLink = page.getByRole("link", { name: "Open the shared slide state in a new tab" });
  await expect(stateLink).toHaveAttribute("href", "4/2");
  const statePopupPromise = page.waitForEvent("popup");
  await stateLink.click();
  const statePopup = await statePopupPromise;
  await expect(statePopup).toHaveURL(/\/4\/2$/u);
  await expect(statePopup.locator(`${activeSlide} [data-drever-step="2"]`)).toHaveAttribute(
    "data-step-state",
    "active",
  );
  await statePopup.reload();
  await expect(statePopup).toHaveURL(/\/4\/2$/u);
  await expect(statePopup.locator(`${activeSlide} [data-drever-step="2"]`)).toHaveAttribute(
    "data-step-state",
    "active",
  );
  await statePopup.close();

  await page.goto("/8");
  const documentLink = page.getByRole("link", { name: "Open Document View in a new tab" });
  await expect(documentLink).toHaveAttribute("href", "document");
  const documentPopupPromise = page.waitForEvent("popup");
  await documentLink.click();
  const documentPopup = await documentPopupPromise;
  await expect(documentPopup).toHaveURL(/\/document$/u);
  await expect(documentPopup.locator("[data-drever-document]")).toBeVisible();
  await documentPopup.close();

  await page.goto("/5");
  const canvasModel = page.locator(".tour-motion__canvas");
  await expect(canvasModel).toContainText("Question");
  await page.getByRole("button", { name: "Show next moment" }).click();
  await expect(canvasModel).toContainText("Evidence");
  await expect(page.getByRole("status")).toContainText("96% of pilot teams");

  health.expectHealthy();
});

test("the global stage stays mounted while slides and Steps change independently", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await page.goto("/4");

  const canvas = page.locator("[data-drever-canvas]");
  const stage = page.locator("[data-drever-stage]");
  const backgroundLayer = page.locator('[data-drever-stage-layer="background"]');
  const background = page.getByTestId("tour-stage-background");
  const pageNumber = page.getByTestId("tour-stage-page-number");
  const initialBounds = await readElementBounds(stage);

  await expect(stage).toHaveCount(1);
  await expect(stage).toHaveAttribute("data-page-number", "4");
  await expect(stage).toHaveAttribute("data-current-step", "0");
  await expect(backgroundLayer).toHaveAttribute("aria-hidden", "true");
  await expect(backgroundLayer).toHaveAttribute("inert", "");
  await expect(background).toHaveCSS("view-transition-name", "none");
  await expect(pageNumber).toHaveText("04 / 11");
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
  await expect(page).toHaveURL(/\/4\/1$/u);
  await expect(stage).toHaveAttribute("data-current-step", "1");
  await expect(pageNumber).toHaveText("04 / 11");
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
  await expect(page).toHaveURL(/\/5$/u);
  await expect(stage).toHaveAttribute("data-page-number", "5");
  await expect(stage).toHaveAttribute("data-current-step", "0");
  await expect(pageNumber).toHaveText("05 / 11");
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

test("semantic focus and local replacement preserve stable geometry", async ({ page }) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);

  await page.goto("/4");
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
  await expect(page).toHaveURL(/\/4\/1$/u);
  expectStableBounds(await readElementBounds(focus), focusBounds);
  await expect(focusSteps.first()).toHaveAttribute("data-step-state", "active");
  await expect(focusSteps.first()).not.toHaveAttribute("aria-hidden", "true");

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/4\/2$/u);
  expectStableBounds(await readElementBounds(focus), focusBounds);
  await expect(focusSteps.first()).toHaveAttribute("data-step-state", "complete");
  await expect(focusSteps.first()).not.toHaveAttribute("inert", "");
  await expect(focusSteps.nth(1)).toHaveAttribute("data-step-state", "active");
  await expect(focusSteps.nth(1)).toHaveCSS("opacity", "1");
  const completedOpacity = Number(
    await focusSteps.first().evaluate((element) => getComputedStyle(element).opacity),
  );
  const activeOpacity = Number(
    await focusSteps.nth(1).evaluate((element) => getComputedStyle(element).opacity),
  );
  expect(completedOpacity).toBeGreaterThanOrEqual(0.5);
  expect(completedOpacity).toBeLessThan(activeOpacity);

  await page.goto("/5");
  const motionStage = page.locator(".tour-motion__stage");
  const motionCanvas = page.locator(".tour-motion__canvas");
  const stageBounds = await readElementBounds(motionStage);
  const canvasBounds = await readElementBounds(motionCanvas);
  await page.getByRole("button", { name: "Show next moment" }).click();
  await expect(motionCanvas).toContainText("Evidence");
  expectStableBounds(await readElementBounds(motionStage), stageBounds);
  expectStableBounds(await readElementBounds(motionCanvas), canvasBounds);
  await page.getByRole("button", { name: "Show next moment" }).click();
  await expect(motionCanvas).toContainText("Decision");
  expectStableBounds(await readElementBounds(motionStage), stageBounds);
  expectStableBounds(await readElementBounds(motionCanvas), canvasBounds);

  expect(await readViewTransitionCalls(page)).toEqual([]);
  health.expectHealthy();
});

test("the one-story transition moves only related copy while its project card stays still", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await page.goto("/9");

  const continuity = page.locator(`${activeSlide} [data-testid="motion-continuity"]`);
  const story = page.getByTestId("tour-stage-story");
  const readContinuityContract = () =>
    continuity.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const article = element.querySelector("article");
      const text = element.querySelector("strong");
      if (article === null || text === null) {
        throw new Error("The continuity example requires an article and primary label.");
      }
      const articleStyle = getComputedStyle(article);
      const textStyle = getComputedStyle(text);
      return {
        bounds: {
          height: bounds.height,
          width: bounds.width,
          x: bounds.x,
          y: bounds.y,
        },
        label: element.textContent?.replace(/\s+/gu, " ").trim(),
        paint: {
          backgroundColor: articleStyle.backgroundColor,
          borderColor: articleStyle.borderColor,
          boxShadow: articleStyle.boxShadow,
        },
        text: {
          fontFamily: textStyle.fontFamily,
          fontSize: textStyle.fontSize,
          fontStretch: textStyle.fontStretch,
          fontWeight: textStyle.fontWeight,
          letterSpacing: textStyle.letterSpacing,
          lineHeight: textStyle.lineHeight,
        },
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
            color: style.color,
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
  const finishStoryMotion = () =>
    story.evaluate(async (element) => {
      await Promise.all(element.getAnimations({ subtree: true }).map(({ finished }) => finished));
    });

  await expect(continuity).toHaveAttribute("data-motion-name", "deck-contract");
  await expect(continuity).toHaveCSS("view-transition-name", "drever-deck-contract");
  await expect(story).toHaveCSS("view-transition-name", "none");
  await expect(story).toHaveAttribute("data-story-state", "source");
  const sourceContract = await readContinuityContract();
  const sourceStory = await readStoryContract();
  await story.evaluate((element) => {
    Reflect.set(globalThis, "__dreverProductTourStory", element);
  });

  const forwardTransition = await captureNextViewTransition(page, () =>
    page.keyboard.press("ArrowRight"),
  );
  await waitForViewTransition(page, forwardTransition, "ready");
  await expect(page).toHaveURL(/\/10$/u);
  const pseudos = await page.evaluate(() =>
    document.documentElement.getAnimations({ subtree: true }).flatMap((animation) => {
      const pseudo = Reflect.get(animation.effect ?? {}, "pseudoElement");
      return typeof pseudo === "string" ? [pseudo] : [];
    }),
  );
  expect(pseudos).toContain("::view-transition-group(drever-deck-contract)");
  expect(pseudos.some((pseudo) => pseudo.includes("story-signal"))).toBe(false);
  await expect(story).toHaveAttribute("data-story-state", "result");
  expect(
    await story.evaluate(
      (element) => element === Reflect.get(globalThis, "__dreverProductTourStory"),
    ),
  ).toBe(true);
  await waitForViewTransition(page, forwardTransition, "finished");
  await finishStoryMotion();

  const resultContract = await readContinuityContract();
  const resultStory = await readStoryContract();
  expectStableBounds(resultContract.bounds, sourceContract.bounds);
  expect(resultContract.label).toBe(sourceContract.label);
  expect(resultContract.paint).toEqual(sourceContract.paint);
  expect(resultContract.text).toEqual(sourceContract.text);
  expectStableBounds(resultStory.bounds, sourceStory.bounds);
  expect(resultStory.result.metrics).toEqual(resultStory.source.metrics);
  expect(resultStory.source.opacity).toBe("0");
  expect(resultStory.result.opacity).toBe("1");
  expect(resultStory.source.translate).not.toBe("0px");
  expect(resultStory.result.translate).toBe("0px");

  const backwardTransition = await captureNextViewTransition(page, () =>
    page.keyboard.press("ArrowLeft"),
  );
  await waitForViewTransition(page, backwardTransition, "ready");
  await expect(page).toHaveURL(/\/9$/u);
  await waitForViewTransition(page, backwardTransition, "finished");
  await finishStoryMotion();
  await expect(story).toHaveAttribute("data-story-state", "source");
  const returnedContract = await readContinuityContract();
  expectStableBounds(returnedContract.bounds, sourceContract.bounds);
  expect(returnedContract.paint).toEqual(sourceContract.paint);
  expectStableBounds((await readStoryContract()).bounds, sourceStory.bounds);

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
  await page.goto("/4");

  await page.getByRole("button", { name: "Next presentation state" }).click();
  await expect(page).toHaveURL(/\/4\/1$/u);
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

  await page.goto("/9");
  await expect(page.locator(`${activeSlide} [data-testid="motion-continuity"]`)).toHaveCSS(
    "view-transition-name",
    "none",
  );
  await page.getByRole("button", { name: "Next presentation state" }).click();
  await expect(page).toHaveURL(/\/10$/u);
  await expect(page.locator(activeSlide)).toHaveAttribute("id", "slide-10");
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

  await page.goto("/speaker/9");
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
  await expect(speakerCurrent.getByTestId("tour-stage-page-number")).toHaveText("09 / 11");
  await expect(speakerNext.getByTestId("tour-stage-page-number")).toHaveText("10 / 11");
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
  await expect(documentPages).toHaveCount(11);
  await expect(documentStages).toHaveCount(11);
  await expect(documentBackgrounds).toHaveCount(11);
  await expect(documentPageNumbers).toHaveCount(11);
  await expect(documentPages.first().getByTestId("tour-stage-page-number")).toHaveText("01 / 11");
  await expect(documentPages.last().getByTestId("tour-stage-page-number")).toHaveText("11 / 11");
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

  const documentFocusSteps = page
    .locator("[data-drever-document]")
    .locator('[data-motion-intent="focus"] > [data-drever-step]');
  await expect(documentFocusSteps).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    await expect(documentFocusSteps.nth(index)).toBeVisible();
    await expect(documentFocusSteps.nth(index)).not.toHaveAttribute("aria-hidden", "true");
  }
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);

  health.expectHealthy();
});

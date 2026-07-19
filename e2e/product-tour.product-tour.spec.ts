import { expect, test } from "@playwright/test";
import { expectStableBounds, readElementBounds } from "./support/element-bounds.ts";
import { monitorPageHealth } from "./support/page-health.ts";
import {
  captureNextViewTransition,
  monitorViewTransitions,
  readViewTransitionCalls,
  waitForViewTransition,
} from "./support/view-transitions.ts";

const activeSlide = '[data-drever-slide][data-slide-state="active"]';

test("the product tour proves interaction, persistence, and the speaker workflow", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await page.goto("/5");

  await expect(page.locator(activeSlide)).toContainText("Let the room answer.");
  const challenging = page.getByRole("button", { name: "Challenging" });
  await challenging.click();
  await expect(challenging).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status")).toContainText("Open the system");

  await challenging.blur();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/6$/u);
  await page.goBack();
  await expect(page).toHaveURL(/\/5$/u);
  await expect(challenging).toHaveAttribute("aria-pressed", "true");

  const speakerPromise = page.waitForEvent("popup");
  await page.keyboard.press("p");
  const speaker = await speakerPromise;
  const speakerHealth = monitorPageHealth(speaker);
  await expect(speaker).toHaveURL(/\/speaker\/5$/u);
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

  await page.goto("/3");

  const tailwindProof = page.getByTestId("tailwind-proof");
  await expect(tailwindProof).toHaveCSS("font-size", "15px");
  await expect(tailwindProof).toHaveCSS("text-transform", "uppercase");
  await expect(page.locator(`${activeSlide} pre.shiki`)).toBeVisible();

  await page.goto("/6");

  await expect(page.locator(activeSlide)).toContainText("Every moment has an address.");
  const feature = page.locator(activeSlide).locator('[data-drever-layout="feature"]');
  await expect(feature).toBeVisible();
  await expect(feature.locator("figure")).toHaveCSS("margin-left", "0px");
  await expect(feature.locator("figure")).toHaveCSS("margin-right", "0px");
  await expect(page.locator(activeSlide).getByText("/speaker/4/2", { exact: true })).toBeVisible();

  await page.goto("/4/2");
  await expect(page.locator(`${activeSlide} [data-drever-step="2"]`)).toHaveAttribute(
    "data-step-state",
    "active",
  );
  await page.reload();
  await expect(page).toHaveURL(/\/4\/2$/u);
  await expect(page.locator(`${activeSlide} [data-drever-step="2"]`)).toHaveAttribute(
    "data-step-state",
    "active",
  );

  await page.goto("/7");
  const canvasModel = page.locator(".tour-motion__canvas");
  await expect(canvasModel).toContainText("Claim");
  await page.getByRole("button", { name: "Change the moment" }).click();
  await expect(canvasModel).toContainText("Proof");
  await expect(page.getByRole("status")).toContainText("Proof");

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
  await expect(background).toHaveAttribute("data-scene", "opening");
  await expect(background).toHaveCSS("view-transition-name", "none");
  await expect(pageNumber).toHaveText("04 / 16");
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
  await expect(pageNumber).toHaveText("04 / 16");
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
  await expect(pageNumber).toHaveText("05 / 16");
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
    { kind: "document", target: "document", types: ["drever-slide-forward"] },
  ]);
  health.expectHealthy();
});

test("semantic motion recipes preserve geometry and accessibility state", async ({ page }) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);

  await page.goto("/4");
  const focus = page.locator(`${activeSlide} [data-motion-intent="focus"]`);
  const focusSteps = focus.locator(":scope > [data-drever-step]");
  const focusBounds = await readElementBounds(focus);
  await expect(focusSteps).toHaveCount(3);
  await expect(focusSteps.first()).toHaveAttribute("data-step-state", "pending");
  await expect(focusSteps.first()).toHaveAttribute("aria-hidden", "true");

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
  await expect(replaceSteps).toHaveCount(3);

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

  await page.goto("/12/1");
  const compare = page.getByTestId("motion-compare");
  const compareSteps = compare.locator(":scope > [data-drever-step]");
  const compareBounds = await readElementBounds(compare);
  await expect(compareSteps.first()).toHaveAttribute("data-step-state", "active");
  await expect(compareSteps.nth(1)).toHaveAttribute("aria-hidden", "true");

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/12\/2$/u);
  expectStableBounds(await readElementBounds(compare), compareBounds);
  await expect(compareSteps.first()).toHaveAttribute("data-step-state", "complete");
  await expect(compareSteps.first()).not.toHaveAttribute("aria-hidden", "true");
  await expect(compareSteps.nth(1)).toHaveAttribute("data-step-state", "active");
  await expect(compareSteps.nth(1)).toHaveCSS("opacity", "1");
  const compareCompletedOpacity = Number(
    await compareSteps.first().evaluate((element) => getComputedStyle(element).opacity),
  );
  const compareActiveOpacity = Number(
    await compareSteps.nth(1).evaluate((element) => getComputedStyle(element).opacity),
  );
  expect(compareCompletedOpacity).toBeGreaterThanOrEqual(0.5);
  expect(compareCompletedOpacity).toBeLessThan(compareActiveOpacity);
  await expect(compareSteps.nth(1)).toBeVisible();

  expect(await readViewTransitionCalls(page)).toEqual([]);
  health.expectHealthy();
});

test("stagger reveals one state with four bounded beats", async ({ page }) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await page.goto("/13");

  const stagger = page.getByTestId("motion-stagger");
  const before = await readElementBounds(stagger);
  await expect(stagger).toBeHidden();

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/13\/1$/u);
  await expect(stagger).toBeVisible();
  expectStableBounds(await readElementBounds(stagger), before);

  const delays = await page.evaluate(() =>
    document
      .getAnimations()
      .flatMap((animation) => {
        if (Reflect.get(animation, "animationName") !== "drever-recipe-stagger-enter") {
          return [];
        }
        const effect = animation.effect;
        return effect instanceof KeyframeEffect ? [Number(effect.getTiming().delay)] : [];
      })
      .sort((left, right) => left - right),
  );
  expect(delays).toHaveLength(4);
  expect(delays[0]).toBe(0);
  expect(new Set(delays).size).toBe(4);
  expect(delays).toEqual([...delays].sort((left, right) => left - right));
  expect(delays.at(-1)).toBeLessThanOrEqual(150);

  expect(await readViewTransitionCalls(page)).toEqual([]);
  await expect(page).toHaveURL(/\/13\/1$/u);
  health.expectHealthy();
});

test("continuity uses one explicit identity in both directions", async ({ page }) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await page.goto("/14");

  const continuity = page.locator(`${activeSlide} [data-testid="motion-continuity"]`);
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
  await expect(continuity).toHaveCSS("view-transition-name", "none");
  await expect(page.locator(`${activeSlide} h2`)).toHaveCSS("view-transition-name", "none");

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/14\/1$/u);
  await expect(continuity).toHaveCSS("view-transition-name", "none");
  const sourceContract = await readContinuityContract();

  const forwardTransition = await captureNextViewTransition(page, () =>
    page.keyboard.press("ArrowRight"),
  );
  await waitForViewTransition(page, forwardTransition, "ready");
  await expect(page).toHaveURL(/\/15$/u);
  expect(
    await page.evaluate(() =>
      document.documentElement.getAnimations({ subtree: true }).flatMap((animation) => {
        const pseudo = Reflect.get(animation.effect ?? {}, "pseudoElement");
        return typeof pseudo === "string" ? [pseudo] : [];
      }),
    ),
  ).toContain("::view-transition-group(drever-deck-contract)");
  await expect(page.locator(`${activeSlide} h2`)).toHaveCSS("view-transition-name", "none");
  await waitForViewTransition(page, forwardTransition, "finished");
  await expect(continuity).toHaveCSS("view-transition-name", "none");
  expectStableContinuityContract(await readContinuityContract(), sourceContract);

  const backwardTransition = await captureNextViewTransition(page, () =>
    page.keyboard.press("ArrowLeft"),
  );
  await waitForViewTransition(page, backwardTransition, "ready");
  await expect(page).toHaveURL(/\/14\/1$/u);
  expect(
    await page.evaluate(() =>
      document.documentElement.getAnimations({ subtree: true }).flatMap((animation) => {
        const pseudo = Reflect.get(animation.effect ?? {}, "pseudoElement");
        return typeof pseudo === "string" ? [pseudo] : [];
      }),
    ),
  ).toContain("::view-transition-group(drever-deck-contract)");
  await waitForViewTransition(page, backwardTransition, "finished");
  await expect(continuity).toHaveCSS("view-transition-name", "none");
  expectStableContinuityContract(await readContinuityContract(), sourceContract);

  expect(await readViewTransitionCalls(page)).toEqual([
    { kind: "document", target: "document", types: ["drever-slide-forward"] },
    { kind: "document", target: "document", types: ["drever-slide-backward"] },
  ]);
  health.expectHealthy();
});

test("reduced-motion audience state changes without motion capture", async ({ page }) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/13");

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/13\/1$/u);
  await expect(page.getByTestId("motion-stagger")).toBeVisible();
  await expect(page.locator(`${activeSlide} [data-drever-step="1"]`)).toHaveAttribute(
    "data-step-state",
    "active",
  );
  expect(await readViewTransitionCalls(page)).toEqual([]);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);

  await page.goto("/14");
  await expect(page.locator(`${activeSlide} [data-testid="motion-continuity"]`)).toHaveCSS(
    "view-transition-name",
    "none",
  );
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/14\/1$/u);
  await expect(page.locator(`${activeSlide} [data-testid="motion-continuity"]`)).toHaveCSS(
    "view-transition-name",
    "none",
  );
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/15$/u);
  await expect(page.locator(activeSlide)).toHaveAttribute("id", "slide-15");
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

  await page.goto("/speaker/14/1");
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
  await expect(speakerCurrent.getByTestId("tour-stage-page-number")).toHaveText("14 / 16");
  await expect(speakerNext.getByTestId("tour-stage-page-number")).toHaveText("15 / 16");
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
  await expect(documentPages).toHaveCount(16);
  await expect(documentStages).toHaveCount(16);
  await expect(documentBackgrounds).toHaveCount(16);
  await expect(documentPageNumbers).toHaveCount(16);
  await expect(documentPages.first().getByTestId("tour-stage-page-number")).toHaveText("01 / 16");
  await expect(documentPages.last().getByTestId("tour-stage-page-number")).toHaveText("16 / 16");
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

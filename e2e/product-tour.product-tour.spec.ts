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

  const firstFocusTransition = await captureNextViewTransition(page, () =>
    page.keyboard.press("ArrowRight"),
  );
  await waitForViewTransition(page, firstFocusTransition, "finished");
  await expect(page).toHaveURL(/\/4\/1$/u);
  expectStableBounds(await readElementBounds(focus), focusBounds);
  await expect(focusSteps.first()).toHaveAttribute("data-step-state", "active");
  await expect(focusSteps.first()).not.toHaveAttribute("aria-hidden", "true");

  const secondFocusTransition = await captureNextViewTransition(page, () =>
    page.keyboard.press("ArrowRight"),
  );
  await waitForViewTransition(page, secondFocusTransition, "finished");
  await expect(page).toHaveURL(/\/4\/2$/u);
  expectStableBounds(await readElementBounds(focus), focusBounds);
  await expect(focusSteps.first()).toHaveAttribute("data-step-state", "complete");
  await expect(focusSteps.first()).not.toHaveAttribute("inert", "");
  const focusedCompletedOpacity = Number(
    await focusSteps.first().evaluate((element) => getComputedStyle(element).opacity),
  );
  const focusedActiveOpacity = Number(
    await focusSteps.nth(1).evaluate((element) => getComputedStyle(element).opacity),
  );
  expect(focusedCompletedOpacity).toBeGreaterThanOrEqual(0.5);
  expect(focusedCompletedOpacity).toBeLessThan(focusedActiveOpacity);
  await expect(focusSteps.nth(1)).toHaveAttribute("data-step-state", "active");
  await expect(focusSteps.nth(1)).toHaveCSS("opacity", "1");

  await page.goto("/11");
  const replace = page.getByTestId("motion-replace");
  const replaceSteps = replace.locator(":scope > [data-drever-step]");
  const replaceBounds = await readElementBounds(replace);
  await expect(replaceSteps).toHaveCount(3);

  const firstReplaceTransition = await captureNextViewTransition(page, () =>
    page.keyboard.press("ArrowRight"),
  );
  await waitForViewTransition(page, firstReplaceTransition, "finished");
  await expect(page).toHaveURL(/\/11\/1$/u);
  expectStableBounds(await readElementBounds(replace), replaceBounds);
  await expect(replaceSteps.first()).toBeVisible();

  const secondReplaceTransition = await captureNextViewTransition(page, () =>
    page.keyboard.press("ArrowRight"),
  );
  await waitForViewTransition(page, secondReplaceTransition, "finished");
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

  const compareTransition = await captureNextViewTransition(page, () =>
    page.keyboard.press("ArrowRight"),
  );
  await waitForViewTransition(page, compareTransition, "finished");
  await expect(page).toHaveURL(/\/12\/2$/u);
  expectStableBounds(await readElementBounds(compare), compareBounds);
  await expect(compareSteps.first()).toHaveAttribute("data-step-state", "complete");
  await expect(compareSteps.first()).not.toHaveAttribute("aria-hidden", "true");
  const compareCompletedOpacity = Number(
    await compareSteps.first().evaluate((element) => getComputedStyle(element).opacity),
  );
  const compareActiveOpacity = Number(
    await compareSteps.nth(1).evaluate((element) => getComputedStyle(element).opacity),
  );
  expect(compareCompletedOpacity).toBeGreaterThanOrEqual(0.5);
  expect(compareCompletedOpacity).toBeLessThan(compareActiveOpacity);
  await expect(compareSteps.nth(1)).toHaveAttribute("data-step-state", "active");
  await expect(compareSteps.nth(1)).toBeVisible();

  health.expectHealthy();
});

test("stagger reveals one state with four bounded beats", async ({ page }) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await page.goto("/13");

  const stagger = page.getByTestId("motion-stagger");
  const before = await readElementBounds(stagger);
  await expect(stagger).toBeHidden();

  const transition = await captureNextViewTransition(page, () => page.keyboard.press("ArrowRight"));
  await waitForViewTransition(page, transition, "ready");
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

  await waitForViewTransition(page, transition, "finished");
  await expect(page).toHaveURL(/\/13\/1$/u);
  health.expectHealthy();
});

test("continuity uses one explicit identity in both directions", async ({ page }) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await page.goto("/14");

  const continuity = page.locator(`${activeSlide} [data-testid="motion-continuity"]`);
  await expect(continuity).toHaveAttribute("data-motion-name", "deck-contract");
  await expect(continuity).toHaveCSS("view-transition-name", "drever-deck-contract");
  await expect(continuity).toHaveCSS("view-transition-class", "drever-motion-continuity");
  await expect(page.locator(`${activeSlide} h2`)).toHaveCSS("view-transition-name", "none");

  const stepTransition = await captureNextViewTransition(page, () =>
    page.keyboard.press("ArrowRight"),
  );
  await waitForViewTransition(page, stepTransition, "ready");
  await expect(page).toHaveURL(/\/14\/1$/u);
  await expect(continuity).toHaveCSS("view-transition-name", "none");
  await waitForViewTransition(page, stepTransition, "finished");
  await expect(continuity).toHaveCSS("view-transition-name", "drever-deck-contract");

  const forwardTransition = await captureNextViewTransition(page, () =>
    page.keyboard.press("ArrowRight"),
  );
  await waitForViewTransition(page, forwardTransition, "ready");
  await expect(page).toHaveURL(/\/15$/u);
  await expect(continuity).toHaveCSS("view-transition-name", "drever-deck-contract");
  await expect(page.locator(`${activeSlide} h2`)).toHaveCSS("view-transition-name", "none");
  await waitForViewTransition(page, forwardTransition, "finished");

  const backwardTransition = await captureNextViewTransition(page, () =>
    page.keyboard.press("ArrowLeft"),
  );
  await waitForViewTransition(page, backwardTransition, "ready");
  await expect(page).toHaveURL(/\/14\/1$/u);
  await expect(continuity).toHaveCSS("view-transition-name", "drever-deck-contract");
  await waitForViewTransition(page, backwardTransition, "finished");

  expect(await readViewTransitionCalls(page)).toEqual([
    { canvas: true, kind: "element", types: ["drever-step-forward"] },
    { canvas: true, kind: "element", types: ["drever-slide-forward"] },
    { canvas: true, kind: "element", types: ["drever-slide-backward"] },
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

test("speaker and document surfaces suppress motion identities", async ({ page }) => {
  const health = monitorPageHealth(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
    false,
  );

  await page.goto("/speaker/14");
  await expect(
    page.getByTestId("speaker-current").locator(activeSlide).getByTestId("motion-continuity"),
  ).toHaveCSS("view-transition-name", "none");
  await expect(
    page.getByTestId("speaker-next").locator(activeSlide).getByTestId("motion-continuity"),
  ).toHaveCSS("view-transition-name", "none");

  await page.goto("/document");
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

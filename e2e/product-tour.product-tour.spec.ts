import { expect, test, type Locator, type Page } from "@playwright/test";
import { waitForDreverReady } from "./support/drever-ready.ts";
import { expectStableBounds, readElementBounds } from "./support/element-bounds.ts";
import { monitorPageHealth } from "./support/page-health.ts";
import {
  captureNextViewTransition,
  monitorViewTransitions,
  readViewTransitionCalls,
  waitForViewTransition,
} from "./support/view-transitions.ts";

const activeSlide = '[data-drever-slide][data-slide-state="active"]';

const gotoReady = async (page: Page, path: string): Promise<void> => {
  await page.goto(path);
  await waitForDreverReady(page);
};

type ElementContract = Readonly<{
  bounds: Readonly<{ height: number; width: number; x: number; y: number }>;
  paint: Readonly<{
    backgroundColor: string;
    borderColor: string;
    boxShadow: string;
  }>;
}>;

const readElementContract = (locator: Locator): Promise<ElementContract> =>
  locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      bounds: {
        height: bounds.height,
        width: bounds.width,
        x: bounds.x,
        y: bounds.y,
      },
      paint: {
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
        boxShadow: style.boxShadow,
      },
    };
  });

const expectSameSize = (
  actual: ElementContract["bounds"],
  expected: ElementContract["bounds"],
): void => {
  expect(actual.width).toBeCloseTo(expected.width, 3);
  expect(actual.height).toBeCloseTo(expected.height, 3);
};

const transitionPseudos = (page: Page): Promise<readonly string[]> =>
  page.evaluate(() =>
    document.documentElement.getAnimations({ subtree: true }).flatMap((animation) => {
      const pseudo = Reflect.get(animation.effect ?? {}, "pseudoElement");
      return typeof pseudo === "string" ? [pseudo] : [];
    }),
  );

test("the audience choice persists and speaker view keeps private context", async ({ page }) => {
  const health = monitorPageHealth(page);
  await gotoReady(page, "/4");

  await expect(page.locator(activeSlide)).toContainText("Ask the room.");
  const explore = page.getByRole("button", { name: "Let me try" });
  await explore.click();
  await expect(explore).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status")).toContainText("Hand over control");
  await expect(page.getByTestId("tour-stage-background")).toHaveAttribute("data-signal", "explore");

  await explore.blur();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/5$/u);
  await page.goBack();
  await expect(page).toHaveURL(/\/4$/u);
  await expect(explore).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status")).toContainText("Hand over control");

  const speakerPromise = page.waitForEvent("popup");
  await page.keyboard.press("p");
  const speaker = await speakerPromise;
  const speakerHealth = monitorPageHealth(speaker);
  await expect(speaker).toHaveURL(/\/speaker\/4$/u);
  await expect(speaker.locator("[data-drever-speaker]")).toBeVisible();
  await expect(speaker.getByTestId("speaker-notes")).toContainText("choice remains");
  await expect(speaker.getByTestId("rehearsal-target")).toHaveValue("20");

  const relations = await speaker.evaluate(() => {
    const references = Array.from(
      document.querySelectorAll(".tour-signal[aria-labelledby]"),
      (element) => element.getAttribute("aria-labelledby"),
    ).filter((value): value is string => value !== null);
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

test("authored Steps and exact links restore the intended presentation state", async ({ page }) => {
  const health = monitorPageHealth(page);

  await gotoReady(page, "/3");
  const directedBeat = page.locator(`${activeSlide} .tour-route__path [data-drever-step="1"]`);
  await expect(directedBeat).toHaveAttribute("data-step-state", "pending");
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/3\/1$/u);
  await expect(directedBeat).toHaveAttribute("data-step-state", "active");
  await expect(directedBeat).toContainText("Ask the room");

  await gotoReady(page, "/5");
  const outcomeSteps = page.locator(`${activeSlide} .tour-outcome__beats > [data-drever-step]`);
  await expect(outcomeSteps).toHaveCount(2);
  await expect(outcomeSteps.first()).toHaveAttribute("data-step-state", "pending");
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/5\/1$/u);
  await expect(outcomeSteps.first()).toHaveAttribute("data-step-state", "active");
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/5\/2$/u);
  await expect(outcomeSteps.first()).toHaveAttribute("data-step-state", "complete");
  await expect(outcomeSteps.nth(1)).toHaveAttribute("data-step-state", "active");
  await expect(page.locator(activeSlide).getByTestId("decision-proof")).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/5\/2$/u);
  await expect(
    page.locator(`${activeSlide} .tour-outcome__beats > [data-drever-step="2"]`),
  ).toHaveAttribute("data-step-state", "active");

  await gotoReady(page, "/6");
  const decision = page.locator(
    `${activeSlide} .tour-decision__confirmation [data-drever-step="1"]`,
  );
  await expect(decision).toHaveAttribute("data-step-state", "pending");
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/6\/1$/u);
  await expect(decision).toHaveAttribute("data-step-state", "active");
  await expect(decision).toContainText("Approve the three-team pilot");

  await gotoReady(page, "/8");
  const stateLink = page.getByRole("link", {
    name: "Open the shared slide state in a new tab",
  });
  await expect(stateLink).toHaveAttribute("href", "5/2");
  const statePopupPromise = page.waitForEvent("popup");
  await stateLink.click();
  const statePopup = await statePopupPromise;
  await expect(statePopup).toHaveURL(/\/5\/2$/u);
  await expect(statePopup.locator(`${activeSlide} [data-drever-step="2"]`)).toHaveAttribute(
    "data-step-state",
    "active",
  );
  await expect(statePopup.locator(activeSlide).getByTestId("decision-proof")).toBeVisible();
  await statePopup.reload();
  await expect(statePopup).toHaveURL(/\/5\/2$/u);
  await expect(statePopup.locator(`${activeSlide} [data-drever-step="2"]`)).toHaveAttribute(
    "data-step-state",
    "active",
  );
  await statePopup.close();

  await gotoReady(page, "/9");
  const documentLink = page.getByRole("link", { name: "Open Document View in a new tab" });
  await expect(documentLink).toHaveAttribute("href", "document");
  const documentPopupPromise = page.waitForEvent("popup");
  await documentLink.click();
  const documentPopup = await documentPopupPromise;
  await expect(documentPopup).toHaveURL(/\/document$/u);
  await expect(documentPopup.locator("[data-drever-document]")).toBeVisible();
  await documentPopup.close();

  health.expectHealthy();
});

test("the global Stage keeps one identity while Steps and slides change", async ({ page }) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await gotoReady(page, "/5");

  const canvas = page.locator("[data-drever-canvas]");
  const stage = page.locator("[data-drever-stage]");
  const backgroundLayer = page.locator('[data-drever-stage-layer="background"]');
  const background = page.getByTestId("tour-stage-background");
  const signal = page.getByTestId("tour-stage-signal");
  const pageNumber = page.getByTestId("tour-stage-page-number");
  const initialBounds = await readElementBounds(stage);

  await expect(stage).toHaveCount(1);
  await expect(stage).toHaveAttribute("data-page-number", "5");
  await expect(stage).toHaveAttribute("data-current-step", "0");
  await expect(backgroundLayer).toHaveAttribute("aria-hidden", "true");
  await expect(backgroundLayer).toHaveAttribute("inert", "");
  await expect(background).toHaveCSS("view-transition-name", "none");
  await expect(signal).toHaveCSS("view-transition-name", "none");
  await expect(pageNumber).toHaveText("05 / 12");
  await expect(pageNumber).toHaveCSS("view-transition-name", "none");
  await expect(page.locator(activeSlide)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  expectStableBounds(await readElementBounds(canvas), initialBounds);
  expectStableBounds(await readElementBounds(backgroundLayer), initialBounds);

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
      signal: select('[data-testid="tour-stage-signal"]'),
      stage: select("[data-drever-stage]"),
    });
  });
  const stageIdentity = () =>
    page.evaluate(() => {
      const remembered = Reflect.get(globalThis, "__dreverProductTourStageNodes") as
        | Readonly<Record<string, Element>>
        | undefined;
      if (remembered === undefined) throw new Error("The persistent Stage nodes were not saved.");
      return {
        background:
          remembered.background === document.querySelector('[data-testid="tour-stage-background"]'),
        backgroundLayer:
          remembered.backgroundLayer ===
          document.querySelector('[data-drever-stage-layer="background"]'),
        pageNumber:
          remembered.pageNumber ===
          document.querySelector('[data-testid="tour-stage-page-number"]'),
        signal: remembered.signal === document.querySelector('[data-testid="tour-stage-signal"]'),
        stage: remembered.stage === document.querySelector("[data-drever-stage]"),
      };
    });

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/5\/1$/u);
  await expect(stage).toHaveAttribute("data-current-step", "1");
  await expect(pageNumber).toHaveText("05 / 12");
  expect(await stageIdentity()).toEqual({
    background: true,
    backgroundLayer: true,
    pageNumber: true,
    signal: true,
    stage: true,
  });
  expect(await readViewTransitionCalls(page)).toEqual([]);

  const nextSlide = await captureNextViewTransition(page, () => page.keyboard.press("ArrowDown"));
  await waitForViewTransition(page, nextSlide, "ready");
  await expect(page).toHaveURL(/\/6$/u);
  await expect(stage).toHaveAttribute("data-page-number", "6");
  await expect(stage).toHaveAttribute("data-current-step", "0");
  await expect(pageNumber).toHaveText("06 / 12");
  expect(await stageIdentity()).toEqual({
    background: true,
    backgroundLayer: true,
    pageNumber: true,
    signal: true,
    stage: true,
  });
  expectStableBounds(await readElementBounds(stage), initialBounds);
  await waitForViewTransition(page, nextSlide, "finished");

  expect(await readViewTransitionCalls(page)).toEqual([
    { kind: "document", target: "document", types: ["drever-slide-forward"] },
  ]);
  health.expectHealthy();
});

test("the decision proof keeps stable geometry and paint through forward and reverse continuity", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await gotoReady(page, "/5/2");

  const group = page.locator(`${activeSlide} [data-motion-name="decision-proof"]`);
  const proof = page.locator(`${activeSlide} [data-testid="decision-proof"]`);
  await expect(group).toHaveAttribute("data-motion-intent", "continuity");
  await expect(group).toHaveCSS("view-transition-name", "drever-decision-proof");
  const sourceGroup = await readElementContract(group);
  const sourceProof = await readElementContract(proof);

  const forward = await captureNextViewTransition(page, () => page.keyboard.press("ArrowRight"));
  await waitForViewTransition(page, forward, "ready");
  await expect(page).toHaveURL(/\/6$/u);
  expect(await transitionPseudos(page)).toContain("::view-transition-group(drever-decision-proof)");
  await waitForViewTransition(page, forward, "finished");

  const decisionGroup = await readElementContract(group);
  const decisionProof = await readElementContract(proof);
  expectSameSize(decisionGroup.bounds, sourceGroup.bounds);
  expectSameSize(decisionProof.bounds, sourceProof.bounds);
  expect(decisionProof.paint).toEqual(sourceProof.paint);
  expect(decisionGroup.bounds.x).not.toBeCloseTo(sourceGroup.bounds.x, 3);

  const backward = await captureNextViewTransition(page, () => page.keyboard.press("ArrowLeft"));
  await waitForViewTransition(page, backward, "ready");
  await expect(page).toHaveURL(/\/5\/2$/u);
  expect(await transitionPseudos(page)).toContain("::view-transition-group(drever-decision-proof)");
  await waitForViewTransition(page, backward, "finished");

  const returnedGroup = await readElementContract(group);
  const returnedProof = await readElementContract(proof);
  expectStableBounds(returnedGroup.bounds, sourceGroup.bounds);
  expectStableBounds(returnedProof.bounds, sourceProof.bounds);
  expect(returnedProof.paint).toEqual(sourceProof.paint);
  expect(await readViewTransitionCalls(page)).toEqual([
    { kind: "document", target: "document", types: ["drever-slide-forward"] },
    { kind: "document", target: "document", types: ["drever-slide-backward"] },
  ]);
  health.expectHealthy();
});

test("the story core and persistent headline preserve their continuity in both directions", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await gotoReady(page, "/10");

  const coreGroup = page.locator(`${activeSlide} [data-motion-name="story-core"]`);
  const core = page.locator(`${activeSlide} [data-testid="story-core"]`);
  const story = page.getByTestId("tour-stage-story");
  const readStoryState = () =>
    story.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const source = element.querySelector<HTMLElement>('[data-story-copy="source"]');
      const result = element.querySelector<HTMLElement>('[data-story-copy="result"]');
      if (source === null || result === null) {
        throw new Error("The persistent story slot requires both copies.");
      }
      return {
        bounds: {
          height: bounds.height,
          width: bounds.width,
          x: bounds.x,
          y: bounds.y,
        },
        result: {
          opacity: getComputedStyle(result).opacity,
          translate: getComputedStyle(result).translate,
        },
        source: {
          opacity: getComputedStyle(source).opacity,
          translate: getComputedStyle(source).translate,
        },
      };
    });
  const finishStoryMotion = () =>
    story.evaluate(async (element) => {
      await Promise.all(element.getAnimations({ subtree: true }).map(({ finished }) => finished));
    });

  await expect(coreGroup).toHaveCSS("view-transition-name", "drever-story-core");
  await expect(story).toHaveCSS("view-transition-name", "none");
  await expect(story).toHaveAttribute("data-story-state", "source");
  const sourceGroup = await readElementContract(coreGroup);
  const sourceCore = await readElementContract(core);
  const sourceStory = await readStoryState();
  await story.evaluate((element) => {
    Reflect.set(globalThis, "__dreverProductTourStory", element);
  });

  const forward = await captureNextViewTransition(page, () => page.keyboard.press("ArrowRight"));
  await waitForViewTransition(page, forward, "ready");
  await expect(page).toHaveURL(/\/11$/u);
  expect(await transitionPseudos(page)).toContain("::view-transition-group(drever-story-core)");
  await expect(story).toHaveAttribute("data-story-state", "result");
  expect(
    await story.evaluate(
      (element) => element === Reflect.get(globalThis, "__dreverProductTourStory"),
    ),
  ).toBe(true);
  await waitForViewTransition(page, forward, "finished");
  await finishStoryMotion();

  const resultGroup = await readElementContract(coreGroup);
  const resultCore = await readElementContract(core);
  const resultStory = await readStoryState();
  expectStableBounds(resultGroup.bounds, sourceGroup.bounds);
  expectStableBounds(resultCore.bounds, sourceCore.bounds);
  expect(resultCore.paint).toEqual(sourceCore.paint);
  expectStableBounds(resultStory.bounds, sourceStory.bounds);
  expect(resultStory.source.opacity).toBe("0");
  expect(resultStory.result.opacity).toBe("1");
  expect(resultStory.source.translate).not.toBe("0px");
  expect(resultStory.result.translate).toBe("0px");

  const backward = await captureNextViewTransition(page, () => page.keyboard.press("ArrowLeft"));
  await waitForViewTransition(page, backward, "ready");
  await expect(page).toHaveURL(/\/10$/u);
  await waitForViewTransition(page, backward, "finished");
  await finishStoryMotion();
  await expect(story).toHaveAttribute("data-story-state", "source");
  expectStableBounds((await readElementContract(coreGroup)).bounds, sourceGroup.bounds);
  expectStableBounds((await readStoryState()).bounds, sourceStory.bounds);

  expect(await readViewTransitionCalls(page)).toEqual([
    { kind: "document", target: "document", types: ["drever-slide-forward"] },
    { kind: "document", target: "document", types: ["drever-slide-backward"] },
  ]);
  health.expectHealthy();
});

test("reduced motion changes every authored state without capturing motion", async ({ page }) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await page.emulateMedia({ reducedMotion: "reduce" });

  await gotoReady(page, "/5");
  await page.getByRole("button", { name: "Next presentation state" }).click();
  await expect(page).toHaveURL(/\/5\/1$/u);
  await expect(page.locator(`${activeSlide} [data-drever-step="1"]`)).toHaveAttribute(
    "data-step-state",
    "active",
  );
  expect(await readViewTransitionCalls(page)).toEqual([]);

  await gotoReady(page, "/5/2");
  await expect(page.locator(`${activeSlide} [data-motion-name="decision-proof"]`)).toHaveCSS(
    "view-transition-name",
    "none",
  );
  await page.getByRole("button", { name: "Next presentation state" }).click();
  await expect(page).toHaveURL(/\/6$/u);
  await expect(page.locator(`${activeSlide} [data-motion-name="decision-proof"]`)).toHaveCSS(
    "view-transition-name",
    "none",
  );

  await gotoReady(page, "/10");
  await expect(page.locator(`${activeSlide} [data-motion-name="story-core"]`)).toHaveCSS(
    "view-transition-name",
    "none",
  );
  await page.getByRole("button", { name: "Next presentation state" }).click();
  await expect(page).toHaveURL(/\/11$/u);
  await expect(page.locator(`${activeSlide} [data-motion-name="story-core"]`)).toHaveCSS(
    "view-transition-name",
    "none",
  );
  await expect(page.getByTestId("tour-stage-story")).toHaveAttribute("data-story-state", "result");
  expect(await readViewTransitionCalls(page)).toEqual([]);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);

  health.expectHealthy();
});

test("speaker and document surfaces render the complete story without motion identities", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });

  await gotoReady(page, "/speaker/7");
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
  await expect(speakerCurrent.getByTestId("tour-stage-page-number")).toHaveText("07 / 12");
  await expect(speakerNext.getByTestId("tour-stage-page-number")).toHaveText("08 / 12");
  await expect(speakerCurrent.locator(activeSlide).getByTestId("decision-proof")).toBeVisible();
  await expect(speakerNext.locator(activeSlide).getByTestId("decision-proof")).toBeVisible();
  await expect(
    speakerCurrent.locator(activeSlide).locator('[data-motion-name="decision-proof"]'),
  ).toHaveCSS("view-transition-name", "none");
  await expect(
    speakerNext.locator(activeSlide).locator('[data-motion-name="decision-proof"]'),
  ).toHaveCSS("view-transition-name", "none");

  await gotoReady(page, "/speaker/10");
  await expect(
    page.getByTestId("speaker-current").getByTestId("tour-stage-page-number"),
  ).toHaveText("10 / 12");
  await expect(page.getByTestId("speaker-next").getByTestId("tour-stage-page-number")).toHaveText(
    "11 / 12",
  );
  await expect(
    page.getByTestId("speaker-current").locator(activeSlide).getByTestId("story-core"),
  ).toBeVisible();
  await expect(
    page.getByTestId("speaker-next").locator(activeSlide).getByTestId("story-core"),
  ).toBeVisible();
  await expect(
    page
      .getByTestId("speaker-current")
      .locator(activeSlide)
      .locator('[data-motion-name="story-core"]'),
  ).toHaveCSS("view-transition-name", "none");
  await expect(
    page
      .getByTestId("speaker-next")
      .locator(activeSlide)
      .locator('[data-motion-name="story-core"]'),
  ).toHaveCSS("view-transition-name", "none");

  await gotoReady(page, "/document");
  const documentPages = page.locator("[data-drever-document-page]");
  const documentStages = documentPages.locator("[data-drever-stage]");
  const documentBackgrounds = documentPages.getByTestId("tour-stage-background");
  const documentPageNumbers = documentPages.getByTestId("tour-stage-page-number");
  await expect(documentPages).toHaveCount(12);
  await expect(documentStages).toHaveCount(12);
  await expect(documentBackgrounds).toHaveCount(12);
  await expect(documentPageNumbers).toHaveCount(12);
  await expect(documentPages.first().getByTestId("tour-stage-page-number")).toHaveText("01 / 12");
  await expect(documentPages.last().getByTestId("tour-stage-page-number")).toHaveText("12 / 12");
  await expect(documentStages.first()).toHaveAttribute("data-drever-render-mode", "document");
  await expect(documentStages.last()).toHaveAttribute("data-drever-render-mode", "document");
  await expect(documentBackgrounds.first()).toHaveCSS("view-transition-name", "none");
  expectStableBounds(
    await readElementBounds(documentStages.first()),
    await readElementBounds(documentPages.first()),
  );

  const documentProof = documentPages.nth(8).getByTestId("decision-proof");
  await expect(documentProof).toBeVisible();
  await expect(documentPages.nth(8).locator('[data-motion-name="decision-proof"]')).toHaveCSS(
    "view-transition-name",
    "none",
  );

  const documentStoryCores = page
    .locator("[data-drever-document]")
    .locator('[data-motion-name="story-core"]');
  await expect(documentStoryCores).toHaveCount(2);
  await expect(documentStoryCores.first()).toHaveCSS("view-transition-name", "none");
  await expect(documentStoryCores.last()).toHaveCSS("view-transition-name", "none");

  const documentSteps = page.locator("[data-drever-document] [data-drever-step]");
  await expect(documentSteps).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    await expect(documentSteps.nth(index)).toBeVisible();
    await expect(documentSteps.nth(index)).not.toHaveAttribute("aria-hidden", "true");
  }
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);

  health.expectHealthy();
});

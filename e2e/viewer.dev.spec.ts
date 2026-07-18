import { expect, test } from "@playwright/test";
import { monitorPageHealth } from "./support/page-health.ts";

const activeSlide = '[data-drever-slide][data-slide-state="active"]';

test("the public dev command runs the complete interactive presentation workflow", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await page.goto("/");

  await expect(page.locator("[data-drever-slide]")).toHaveCount(5);
  await expect(page.locator(activeSlide)).toHaveAttribute("id", "slide-1");
  await expect(page.locator(activeSlide)).toContainText("Slides can be software.");
  await expect(page.getByText("Pause at step 2", { exact: false })).toHaveCount(0);

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/2$/u);
  await expect(page.locator(activeSlide)).toHaveAttribute("id", "slide-2");
  await expect(page.locator('[data-testid="step-2"]')).toHaveAttribute(
    "data-step-state",
    "pending",
  );

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/2\/2$/u);
  await expect(page.locator('[data-testid="step-2"]')).toHaveAttribute("data-step-state", "active");
  await expect(page.locator('[data-testid="step-5"]')).toHaveAttribute(
    "data-step-state",
    "pending",
  );

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/2\/5$/u);
  await expect(page.locator('[data-testid="step-2"]')).toHaveAttribute(
    "data-step-state",
    "complete",
  );
  await expect(page.locator('[data-testid="step-5"]')).toHaveAttribute("data-step-state", "active");

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/3$/u);
  const previous = page.locator("#slide-2");
  await expect(previous).toBeHidden();
  await expect(previous).toHaveAttribute("aria-hidden", "true");
  await expect(previous).toHaveAttribute("inert", "");
  await expect(page.locator(activeSlide)).toBeFocused();

  await page.goBack();
  await expect(page).toHaveURL(/\/2\/5$/u);
  await expect(page.locator("#slide-2")).toBeFocused();
  await page.goForward();
  await expect(page).toHaveURL(/\/3$/u);

  health.expectHealthy();
});

test("deep links reload exactly and inactive slides preserve React state", async ({ page }) => {
  const health = monitorPageHealth(page);
  await page.goto("/2/5");
  await expect(page.locator(activeSlide)).toHaveAttribute("id", "slide-2");
  await expect(page.locator('[data-testid="step-5"]')).toHaveAttribute("data-step-state", "active");

  await page.reload();
  await expect(page).toHaveURL(/\/2\/5$/u);
  await expect(page.locator(activeSlide)).toHaveAttribute("id", "slide-2");

  const speakerPromise = page.waitForEvent("popup");
  await page.keyboard.press("p");
  const speaker = await speakerPromise;
  const speakerHealth = monitorPageHealth(speaker);
  await expect(speaker).toHaveURL(/\/speaker\/2\/5$/u);
  await expect(speaker.locator("[data-drever-speaker]")).toBeVisible();
  await expect(speaker.getByTestId("speaker-current").getByTestId("step-5")).toHaveAttribute(
    "data-step-state",
    "active",
  );
  speakerHealth.expectHealthy();
  await speaker.close();

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/3$/u);
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/4$/u);
  const increment = page.getByTestId("counter-increment");
  await increment.click();
  await expect(page.getByTestId("counter-value")).toHaveText("1");

  await increment.press("Space");
  await expect(page).toHaveURL(/\/4$/u);
  await expect(page.getByTestId("counter-value")).toHaveText("2");

  await increment.blur();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/5$/u);
  await page.goBack();
  await expect(page).toHaveURL(/\/4$/u);
  await expect(page.getByTestId("counter-value")).toHaveText("2");

  health.expectHealthy();
});

test("speaker view previews sparse steps and synchronizes a late audience window", async ({
  context,
  page,
}) => {
  const speakerHealth = monitorPageHealth(page);
  await page.goto("/speaker/2");

  await expect(page).toHaveURL(/\/speaker\/2$/u);
  await expect(page.locator("[data-drever-speaker]")).toBeVisible();
  const current = page.getByTestId("speaker-current");
  const next = page.getByTestId("speaker-next");
  await expect(current.locator('[data-drever-slide][data-slide-state="active"]')).toHaveAttribute(
    "data-slide-id",
    "slide-2",
  );
  await expect(current.locator('[data-drever-slide][data-slide-state="active"]')).toHaveAttribute(
    "id",
    "speaker-current-slide-2",
  );
  await expect(next.locator('[data-drever-slide][data-slide-state="active"]')).toHaveAttribute(
    "id",
    "speaker-next-slide-2",
  );
  await expect(current.getByTestId("step-2")).toHaveAttribute("data-step-state", "pending");
  await expect(next.getByTestId("step-2")).toHaveAttribute("data-step-state", "active");
  await expect(page.getByTestId("speaker-notes")).toContainText(
    "Pause at step 2, then jump to step 5.",
  );

  await page.getByRole("button", { name: "Next presentation state" }).click();
  await expect(page).toHaveURL(/\/speaker\/2\/2$/u);
  await expect(current.getByTestId("step-2")).toHaveAttribute("data-step-state", "active");
  await expect(next.getByTestId("step-5")).toHaveAttribute("data-step-state", "active");

  const audience = await context.newPage();
  const audienceHealth = monitorPageHealth(audience);
  await audience.goto("/");
  await expect(audience).toHaveURL(/\/2\/2$/u);
  await expect(audience.getByTestId("step-2")).toHaveAttribute("data-step-state", "active");

  await page.getByRole("button", { name: "Next presentation state" }).click();
  await expect(page).toHaveURL(/\/speaker\/2\/5$/u);
  await expect(audience).toHaveURL(/\/2\/5$/u);
  await expect(audience.getByTestId("step-5")).toHaveAttribute("data-step-state", "active");

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Open audience" }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/\/2\/5$/u);
  await popup.close();

  speakerHealth.expectHealthy();
  audienceHealth.expectHealthy();
});

test("speaker chrome keeps remote keys while buttons and notes retain native keyboard behavior", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await page.goto("/speaker/2");

  const next = page.getByRole("button", { name: "Next presentation state" });
  await next.click();
  await expect(next).toBeFocused();
  await expect(page).toHaveURL(/\/speaker\/2\/2$/u);

  await page.keyboard.press("PageDown");
  await expect(next).toBeFocused();
  await expect(page).toHaveURL(/\/speaker\/2\/5$/u);

  const previous = page.getByRole("button", { name: "Previous presentation state" });
  await previous.click();
  await expect(previous).toBeFocused();
  await expect(page).toHaveURL(/\/speaker\/2\/2$/u);

  await page.keyboard.press("ArrowRight");
  await expect(previous).toBeFocused();
  await expect(page).toHaveURL(/\/speaker\/2\/5$/u);

  const timerToggle = page.locator(".drever-speaker__timer button").first();
  await timerToggle.click();
  await expect(timerToggle).toHaveText("Resume");
  await timerToggle.press("Space");
  await expect(timerToggle).toHaveText("Pause");
  await timerToggle.press("Enter");
  await expect(timerToggle).toHaveText("Resume");
  await expect(page).toHaveURL(/\/speaker\/2\/5$/u);

  const notes = page.getByTestId("speaker-notes");
  await notes.focus();
  await expect(notes).toBeFocused();
  await notes.press("PageDown");
  await expect(page).toHaveURL(/\/speaker\/2\/5$/u);

  health.expectHealthy();
});

test("slide motion is scoped to the canvas without nested title transitions", async ({ page }) => {
  await page.addInitScript(() => {
    const calls: Array<Readonly<{ canvas: boolean; kind: "document" | "element" }>> = [];
    Object.defineProperty(globalThis, "__dreverTransitionCalls", { value: calls });

    const documentPrototype: object = Document.prototype;
    const documentStart = Reflect.get(documentPrototype, "startViewTransition") as (
      ...args: unknown[]
    ) => unknown;
    Reflect.set(
      documentPrototype,
      "startViewTransition",
      function (this: Document, ...args: unknown[]) {
        calls.push({ canvas: false, kind: "document" });
        return Reflect.apply(documentStart, this, args);
      },
    );

    const elementPrototype: object = Element.prototype;
    const elementStart = Reflect.get(elementPrototype, "startViewTransition") as (
      ...args: unknown[]
    ) => unknown;
    Reflect.set(
      elementPrototype,
      "startViewTransition",
      function (this: Element, ...args: unknown[]) {
        calls.push({
          canvas: this instanceof HTMLElement && this.hasAttribute("data-drever-canvas"),
          kind: "element",
        });
        return Reflect.apply(elementStart, this, args);
      },
    );
  });

  await page.goto("/");
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/2$/u);

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Reflect.get(globalThis, "__dreverTransitionCalls") as readonly Readonly<{
            canvas: boolean;
            kind: "document" | "element";
          }>[],
      ),
    )
    .toEqual([{ canvas: true, kind: "element" }]);
  await expect(page.locator('[data-drever-slide][data-slide-state="active"] h2')).toHaveCSS(
    "view-transition-name",
    "none",
  );
});

test("step motion keeps unchanged slide content stationary", async ({ page }) => {
  await page.goto("/2");
  await page.addStyleTag({
    content: ".drever-viewer { --drever-motion-duration: 1200ms !important; }",
  });

  const heading = page.locator('[data-drever-slide][data-slide-state="active"] h2');
  const headingBounds = () =>
    heading.evaluate((element) => {
      const { height, width, x, y } = element.getBoundingClientRect();
      return { height, width, x, y };
    });
  const before = await headingBounds();

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/2\/2$/u);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const canvas = document.querySelector<HTMLElement>("[data-drever-canvas]");
        return canvas === null
          ? "missing"
          : getComputedStyle(canvas, "::view-transition-new(root)").animationName;
      }),
    )
    .toBe("drever-soft-enter");

  const transition = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLElement>("[data-drever-canvas]");
    if (canvas === null) {
      throw new Error("Expected the Drever canvas during a Step transition.");
    }
    const oldRoot = getComputedStyle(canvas, "::view-transition-old(root)");
    const newRoot = getComputedStyle(canvas, "::view-transition-new(root)");
    return {
      newAnimation: newRoot.animationName,
      newOpacity: Number(newRoot.opacity),
      newTransform: newRoot.transform,
      oldAnimation: oldRoot.animationName,
      oldTransform: oldRoot.transform,
    };
  });

  expect(await headingBounds()).toEqual(before);
  expect(transition).toMatchObject({
    newAnimation: "drever-soft-enter",
    newTransform: "none",
    oldAnimation: "none",
    oldTransform: "none",
  });
  expect(transition.newOpacity).toBeLessThan(1);

  await expect
    .poll(() =>
      page.evaluate(() => {
        const canvas = document.querySelector<HTMLElement>("[data-drever-canvas]");
        return canvas === null
          ? "missing"
          : getComputedStyle(canvas, "::view-transition-new(root)").animationName;
      }),
    )
    .toBe("none");
  expect(await headingBounds()).toEqual(before);
});

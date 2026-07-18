import { expect, test } from "@playwright/test";
import { monitorPageHealth } from "./support/page-health.ts";

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
  await expect(page.locator('[data-drever-step="2"]')).toHaveAttribute("data-step-state", "active");
  await page.reload();
  await expect(page).toHaveURL(/\/4\/2$/u);
  await expect(page.locator('[data-drever-step="2"]')).toHaveAttribute("data-step-state", "active");

  await page.goto("/7");
  const canvasModel = page.locator(".tour-motion__canvas");
  await expect(canvasModel).toContainText("Claim");
  await page.getByRole("button", { name: "Change the moment" }).click();
  await expect(canvasModel).toContainText("Proof");
  await expect(page.getByRole("status")).toContainText("Proof");

  health.expectHealthy();
});

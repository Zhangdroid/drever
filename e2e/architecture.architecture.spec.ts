import { expect, test } from "@playwright/test";
import { monitorPageHealth } from "./support/page-health.ts";

const activeSlide = '[data-drever-slide][data-slide-state="active"]';

test("the architecture tour makes compiler artifacts inspectable", async ({ page }) => {
  const health = monitorPageHealth(page);
  await page.goto("/");

  await expect(page.locator(activeSlide).locator('[data-drever-layout="statement"]')).toBeVisible();
  await expect(page.locator('[data-drever-stage-layer="background"]')).toHaveCSS(
    "background-color",
    "rgb(11, 20, 31)",
  );
  await expect(page.locator(activeSlide)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

  await page.goto("/3");

  await expect(page.locator(activeSlide)).toContainText("The deck becomes data before UI.");
  const runtime = page.getByRole("button", { name: /Runtime/u });
  await runtime.click();
  await expect(runtime).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status")).toContainText('"surface": "audience"');
  await expect(page.getByRole("status")).toContainText("without inspecting DOM");

  await page.getByRole("button", { name: /Manifest/u }).click();
  await expect(page.getByRole("status")).toContainText('"stepStops": [1, 2, 3, 4, 5]');

  await page.goto("/5");
  const workbench = page.locator(activeSlide).locator('[data-drever-layout="workbench"]');
  await expect(workbench).toBeVisible();
  await expect(workbench).toContainText("Theme and plugin answer different questions.");
  await expect(workbench).toContainText("Changing a theme must not change content semantics.");
  const workbenchLabelId = await workbench.getAttribute("aria-labelledby");
  expect(workbenchLabelId).not.toBeNull();
  await expect(page.locator(`[id="${workbenchLabelId}"]`)).toHaveCount(1);
  expect(
    await workbench.evaluate((element) => {
      const slide = element.closest<HTMLElement>("[data-drever-slide]");
      if (slide === null) {
        throw new Error("A Workbench layout must render inside a Drever slide.");
      }
      const layoutBounds = element.getBoundingClientRect();
      const slideBounds = slide.getBoundingClientRect();
      const descendantsOverflow = Array.from(
        element.querySelectorAll<HTMLElement>(
          ".drever-studio-workbench__main, .drever-studio-workbench__rail",
        ),
        (region) =>
          region.scrollWidth > region.clientWidth || region.scrollHeight > region.clientHeight,
      ).some(Boolean);
      return (
        descendantsOverflow ||
        layoutBounds.left < slideBounds.left ||
        layoutBounds.right > slideBounds.right ||
        layoutBounds.top < slideBounds.top ||
        layoutBounds.bottom > slideBounds.bottom
      );
    }),
  ).toBe(false);

  await page.goto("/speaker/3");
  await expect(page.locator("[data-drever-speaker]")).toBeVisible();
  const explorerLabels = await page.evaluate(() => {
    const references = Array.from(
      document.querySelectorAll(".arch-explorer[aria-labelledby]"),
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
  expect(explorerLabels.references.length).toBeGreaterThanOrEqual(2);
  expect(new Set(explorerLabels.references).size).toBe(explorerLabels.references.length);
  expect(explorerLabels.allResolveOnce).toBe(true);

  health.expectHealthy();
});

test("the architecture tour demonstrates deterministic routes and valid manifest steps", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await page.goto("/6");

  await expect(page.locator(activeSlide)).toContainText("The URL is presentation state.");
  await page.getByRole("button", { name: "speaker", exact: true }).click();
  await page
    .getByRole("group", { name: "Slide" })
    .getByRole("button", { name: "4", exact: true })
    .click();
  await page
    .getByRole("group", { name: "Step" })
    .getByRole("button", { name: "2", exact: true })
    .click();
  const output = page.getByRole("status");
  await expect(output).toContainText("/speaker/4/2");
  await expect(output).toContainText("dist/speaker/4/2/index.html");

  await page.goto("/4/5");
  await expect(page.locator(activeSlide)).toContainText("Compilation is an owned sequence.");
  await expect(page.locator('[data-drever-step="5"]')).toHaveAttribute("data-step-state", "active");

  const staticEntry = await page.request.get("/4/5/index.html");
  expect(staticEntry.ok()).toBe(true);
  expect(await staticEntry.text()).toContain("const routeDepth = 2;");

  health.expectHealthy();
});

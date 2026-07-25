import { expect, test } from "@playwright/test";
import { monitorPageHealth } from "./support/page-health.ts";

const activeSlide = '[data-drever-slide][data-slide-state="active"]';

test("the architecture tour follows one compiler contract across its artifacts", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await page.goto("/");

  await expect(page.locator(`${activeSlide} .arch-opening`)).toBeVisible();
  await expect(page.getByTestId("architecture-stage-background")).toHaveAttribute(
    "data-scene",
    "opening",
  );
  await expect(page.locator(activeSlide)).toContainText("Every surface agrees.");

  await page.goto("/3");
  const artifact = page.locator(`${activeSlide} .arch-artifact-lens`);
  await expect(artifact).toContainText("Authored source");
  await expect(artifact).toContainText("# Ship one story.");

  await page.goto("/3/2");
  await expect(artifact).toContainText("Manifest");
  await expect(artifact).toContainText('"stepStops": [1]');

  await page.goto("/3/3");
  await expect(artifact).toContainText("Runtime");
  await expect(artifact).toContainText('"surface": "audience"');
  await expect(
    page.locator(`${activeSlide} .arch-step-caption [data-step-state="active"]`),
  ).toHaveText(/never reverse-engineers the DOM/u);

  await page.goto("/5");
  const boundary = page.locator(`${activeSlide} .arch-boundary-map`);
  await expect(boundary).toContainText(/design/iu);
  await expect(boundary).toContainText("Expression");
  await expect(boundary).toContainText(/plugin/iu);
  await expect(boundary).toContainText("Capability");
  await expect(boundary).toContainText(/unchanged semantics/iu);

  await page.goto("/speaker/3");
  await expect(page.locator("[data-drever-speaker]")).toBeVisible();
  await expect(
    page.getByTestId("speaker-current").getByTestId("architecture-stage-background"),
  ).toHaveAttribute("data-scene", "contract");

  await page.goto("/document");
  const compilerCaptions = page
    .locator('[data-drever-document-page][data-slide-index="3"]')
    .locator(".arch-step-caption > [data-drever-step]");
  await expect(compilerCaptions).toHaveCount(5);
  for (const caption of await compilerCaptions.all()) {
    await expect(caption).toBeVisible();
  }

  health.expectHealthy();
});

test("the architecture tour demonstrates deterministic routes and valid manifest steps", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await page.goto("/6");

  await expect(page.locator(activeSlide)).toContainText("One coordinate drives every surface.");
  await page
    .getByRole("group", { name: "Slide" })
    .getByRole("button", { name: "1", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Route /speaker; output dist/speaker/index.html.",
  );
  await expect(page.locator(`${activeSlide} .arch-route-expression`)).toHaveAttribute(
    "aria-label",
    "Canonical route /speaker",
  );
  await page.getByRole("button", { name: "audience", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Route /; output dist/index.html.");
  await expect(page.locator(`${activeSlide} .arch-route-expression`)).toHaveAttribute(
    "aria-label",
    "Canonical route /",
  );

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
  await expect(page.locator(`${activeSlide} .arch-route-expression`)).toHaveAttribute(
    "aria-label",
    "Canonical route /speaker/4/2",
  );

  await page.goto("/4/5");
  const pipeline = page.locator(`${activeSlide} .arch-compiler-rail`);
  await expect(page.locator(`${activeSlide} .arch-slide-heading h1`)).toHaveAccessibleName(
    "Five owned passes turn intent into certainty.",
  );
  await expect(page.locator('[data-drever-step="5"]')).toHaveAttribute("data-step-state", "active");
  await expect(pipeline.locator(".arch-compiler-pass[data-active]")).toContainText("Seal");
  await expect(pipeline.locator(".arch-compiler-pass[data-passed]")).toHaveCount(4);

  const staticEntry = await page.request.get("/4/5/index.html");
  expect(staticEntry.ok()).toBe(true);
  expect(await staticEntry.text()).toContain("const routeDepth = 2;");

  health.expectHealthy();
});

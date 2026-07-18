import { expect, test } from "@playwright/test";
import { monitorPageHealth } from "./support/page-health.ts";

test("the production build is standalone and keeps the viewer contract", async ({ page }) => {
  const health = monitorPageHealth(page);
  const response = await page.request.get("/");
  const html = await response.text();

  expect(response.ok()).toBe(true);
  expect(html).not.toContain("/@vite/client");
  expect(html).toMatch(/<script[^>]+data-drever-src="\.\/assets\/.+\.js"/u);

  await page.goto("/");
  await expect(page.locator("[data-drever-slide]")).toHaveCount(5);
  await expect(page.locator('[data-drever-slide][data-slide-state="active"]')).toHaveAttribute(
    "id",
    "slide-1",
  );

  const canvas = page.locator("[data-drever-canvas]");
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds?.width).toBeCloseTo(1440, 0);
  expect(bounds?.height).toBeCloseTo(810, 0);
  expect(bounds?.x).toBeCloseTo(0, 0);
  expect(bounds?.y).toBeCloseTo(45, 0);

  const cover = page.locator('[data-drever-layout="cover"]').first();
  await expect(cover).toHaveCSS("background-color", "rgb(40, 85, 231)");
  await expect(cover.locator("h1")).toHaveCSS("font-size", "88px");

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/2\/2$/u);
  await expect(page.locator('[data-testid="step-2"]')).toBeVisible();

  health.expectHealthy();
});

test("a production deep link is a reloadable static entry with a computed mount base", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  const response = await page.goto("/2/5");
  if (response === null) {
    throw new Error("The production deep link did not return a document response.");
  }

  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain('<meta name="drever-base" content="./" />');
  await expect(page).toHaveURL(/\/2\/5$/u);
  await expect(page.locator('[data-drever-slide][data-slide-state="active"]')).toHaveAttribute(
    "id",
    "slide-2",
  );
  await expect(page.locator('[data-testid="step-5"]')).toHaveAttribute("data-step-state", "active");

  await page.reload();
  await expect(page).toHaveURL(/\/2\/5$/u);
  await expect(page.locator('[data-testid="step-5"]')).toHaveAttribute("data-step-state", "active");

  const staticEntry = await page.request.get("/2/5/index.html");
  const staticHtml = await staticEntry.text();
  const scriptSource = staticHtml.match(/<script[^>]+data-drever-src="([^"]+\.js)"/u)?.[1];
  if (scriptSource === undefined) {
    throw new Error("The production deep-link entry did not reference a JavaScript asset.");
  }

  expect(staticEntry.ok()).toBe(true);
  expect(staticHtml).toContain('<meta name="drever-base" content="./" />');
  expect(staticHtml).toContain("const routeDepth = 2;");
  expect(scriptSource).toMatch(/^\.\/assets\//u);

  const documentBase = await page.evaluate(() => document.baseURI);
  expect(documentBase).toBe("http://127.0.0.1:4318/");
  const script = await page.request.get(new URL(scriptSource, documentBase).href);
  expect(script.ok()).toBe(true);
  expect(script.headers()["content-type"]).toMatch(/javascript/u);
  expect(await script.text()).not.toMatch(/^\s*<!doctype html>/iu);

  health.expectHealthy();
});

test("production audience controls keep their navigation and presentation tools", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await page.goto("/2");

  const controls = page.getByRole("navigation", { name: "Presentation controls" });
  await expect(controls).toBeVisible();
  await controls.getByRole("button", { name: "Next presentation state" }).click();
  await expect(page).toHaveURL(/\/2\/2$/u);

  await page.locator('[data-drever-slide][data-slide-state="active"]').focus();
  await page.keyboard.press("ArrowDown");
  await expect(page).toHaveURL(/\/3$/u);
  await page.keyboard.press("ArrowUp");
  await expect(page).toHaveURL(/\/2$/u);

  await page.keyboard.press("o");
  const navigator = page.getByRole("dialog", { name: "Slide navigator" });
  await navigator.getByRole("searchbox", { name: "Find a slide" }).fill("interfaces remember");
  await navigator.getByRole("button", { name: /Interfaces remember/u }).click();
  await expect(page).toHaveURL(/\/4$/u);

  await page.keyboard.press("2");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/2$/u);

  await page.keyboard.press("b");
  const pause = page.getByRole("button", {
    name: "Black pause screen. Press Escape to return.",
  });
  await expect(pause).toBeVisible();
  await pause.click();
  await expect(pause).toHaveCount(0);

  await page.keyboard.press("Shift+Slash");
  const help = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(help).toContainText("Go to slide");
  await help.getByRole("button", { name: "Close keyboard shortcuts" }).click();
  await expect(help).not.toBeVisible();

  const documentPromise = page.waitForEvent("popup");
  await page.keyboard.press("d");
  const documentView = await documentPromise;
  const documentHealth = monitorPageHealth(documentView);
  await expect(documentView).toHaveURL(/\/document#slide-2$/u);
  await expect(documentView.locator("[data-drever-document]")).toBeVisible();
  await expect(documentView.getByRole("link", { name: "Return to presentation" })).toHaveAttribute(
    "href",
    "http://127.0.0.1:4318/2",
  );
  await expect
    .poll(() =>
      documentView.locator("#slide-2").evaluate((slide) => {
        const top = slide.getBoundingClientRect().top;
        return top >= 0 && top < 96;
      }),
    )
    .toBe(true);
  documentHealth.expectHealthy();
  await documentView.close();

  health.expectHealthy();
});

test("the production document route exposes every fully revealed slide as a landmark", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  const response = await page.goto("/document");
  if (response === null) {
    throw new Error("The production document route did not return a document response.");
  }

  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain('<meta name="drever-base" content="./" />');
  await expect(page.locator("[data-drever-document]")).toBeVisible();
  const slides = page.locator("[data-drever-document] [data-drever-slide]");
  await expect(slides).toHaveCount(5);
  await expect(
    page.locator("[data-drever-document] [data-drever-slide][aria-current]"),
  ).toHaveCount(0);
  await expect(page.locator("[data-drever-document] [data-drever-slide][aria-hidden]")).toHaveCount(
    0,
  );
  await expect(slides.nth(0)).toHaveAttribute("aria-label", "Slides can be software.");
  await expect(slides.nth(1)).toHaveAttribute("aria-label", "Motion should carry meaning.");
  await expect(slides.nth(1).getByTestId("step-5")).toHaveAttribute("data-step-state", "active");

  const links = page.getByRole("navigation", { name: "Slides" }).getByRole("link");
  await expect(links).toHaveCount(5);
  await expect(links.nth(0)).toHaveAttribute("href", "http://127.0.0.1:4318/document#slide-1");
  const firstBounds = await slides.nth(0).boundingBox();
  const secondBounds = await slides.nth(1).boundingBox();
  expect(firstBounds?.width).toBeGreaterThan(1_000);
  expect(secondBounds?.y).toBeGreaterThan((firstBounds?.y ?? 0) + (firstBounds?.height ?? 0));
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(900);

  await links.nth(3).click();
  await expect(page).toHaveURL(/\/document#slide-4$/u);
  await expect
    .poll(() =>
      slides.nth(3).evaluate((slide) => {
        const top = slide.getBoundingClientRect().top;
        return top >= 0 && top < 96;
      }),
    )
    .toBe(true);

  await page.reload();
  await expect(page.locator("[data-drever-document]")).toBeVisible();
  health.expectHealthy();
});

test("the production document keeps slide content readable within mobile horizontal overflow", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await page.setViewportSize({ height: 812, width: 375 });
  await page.goto("/document");

  const pages = page.locator(".drever-document__pages");
  const metrics = await pages.evaluate((container) => {
    const deck = container.querySelector<HTMLElement>(".drever-document__deck");
    const paragraph = container.querySelector<HTMLElement>("#slide-2 p");
    if (deck === null || paragraph === null) {
      throw new Error("The document is missing its deck or readable sample paragraph.");
    }
    const zoom = Number.parseFloat(getComputedStyle(deck).zoom);
    const fontSize = Number.parseFloat(getComputedStyle(paragraph).fontSize) * zoom;
    return {
      clientWidth: container.clientWidth,
      fontSize,
      rootClientWidth: document.documentElement.clientWidth,
      rootScrollWidth: document.documentElement.scrollWidth,
      scrollWidth: container.scrollWidth,
      zoom,
    };
  });

  expect(metrics.zoom).toBeGreaterThanOrEqual(0.575);
  expect(metrics.fontSize).toBeGreaterThanOrEqual(16);
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
  expect(metrics.rootScrollWidth).toBe(metrics.rootClientWidth);
  health.expectHealthy();
});

test("the production speaker route is a reloadable static control surface", async ({ page }) => {
  const health = monitorPageHealth(page);
  const response = await page.goto("/speaker/2/5");
  if (response === null) {
    throw new Error("The production speaker route did not return a document response.");
  }

  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain('<meta name="drever-base" content="./" />');
  await expect(page.locator("[data-drever-speaker]")).toBeVisible();
  await expect(page).toHaveURL(/\/speaker\/2\/5$/u);
  await expect(page.getByTestId("speaker-notes")).toContainText(
    "Pause at step 2, then jump to step 5.",
  );
  await expect(page.getByTestId("speaker-current").getByTestId("step-5")).toHaveAttribute(
    "data-step-state",
    "active",
  );

  await page.reload();
  await expect(page.locator("[data-drever-speaker]")).toBeVisible();
  await expect(page).toHaveURL(/\/speaker\/2\/5$/u);

  health.expectHealthy();
});

test("static entries work from a subdirectory with and without trailing slashes", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  const cases = [
    { path: "/talk", canonicalPath: "/talk", surface: "audience", slide: "slide-1" },
    { path: "/talk/", canonicalPath: "/talk/", surface: "audience", slide: "slide-1" },
    {
      path: "/talk/index.html",
      canonicalPath: "/talk/",
      surface: "audience",
      slide: "slide-1",
    },
    { path: "/talk/2/5", canonicalPath: "/talk/2/5", surface: "audience", slide: "slide-2" },
    { path: "/talk/2/5/", canonicalPath: "/talk/2/5", surface: "audience", slide: "slide-2" },
    {
      path: "/talk/2/5/index.html",
      canonicalPath: "/talk/2/5",
      surface: "audience",
      slide: "slide-2",
    },
    {
      path: "/talk/speaker/2/5",
      canonicalPath: "/talk/speaker/2/5",
      surface: "speaker",
      slide: "slide-2",
    },
    {
      path: "/talk/speaker/2/5/",
      canonicalPath: "/talk/speaker/2/5",
      surface: "speaker",
      slide: "slide-2",
    },
    {
      path: "/talk/speaker/2/5/index.html",
      canonicalPath: "/talk/speaker/2/5",
      surface: "speaker",
      slide: "slide-2",
    },
    {
      path: "/talk/document",
      canonicalPath: "/talk/document",
      surface: "document",
      slide: "slide-1",
    },
    {
      path: "/talk/document/",
      canonicalPath: "/talk/document",
      surface: "document",
      slide: "slide-1",
    },
    {
      path: "/talk/document/index.html",
      canonicalPath: "/talk/document",
      surface: "document",
      slide: "slide-1",
    },
  ] as const;

  for (const route of cases) {
    const response = await page.goto(route.path);
    if (response === null) {
      throw new Error(`The static route ${route.path} did not return a document response.`);
    }
    expect(response.ok()).toBe(true);
    expect(new URL(page.url()).pathname).toBe(route.canonicalPath);
    expect(await page.evaluate(() => document.baseURI)).toBe("http://127.0.0.1:4318/talk/");
    expect(
      await page
        .locator('script[type="module"]')
        .evaluate((script) => (script as HTMLScriptElement).src),
    ).toMatch(/^http:\/\/127\.0\.0\.1:4318\/talk\/assets\//u);

    if (route.surface === "speaker") {
      await expect(page.locator("[data-drever-speaker]")).toBeVisible();
    } else if (route.surface === "document") {
      await expect(page.locator("[data-drever-document]")).toBeVisible();
    } else {
      await expect(page.locator('[data-drever-slide][data-slide-state="active"]')).toHaveAttribute(
        "id",
        route.slide,
      );
    }
  }

  const missing = await page.request.get("/talk/not-a-route");
  expect(missing.status()).toBe(404);
  health.expectHealthy();
});

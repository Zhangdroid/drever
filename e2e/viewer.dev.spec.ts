import { expect, test } from "@playwright/test";
import { expectStableBounds, readElementBounds } from "./support/element-bounds.ts";
import { monitorPageHealth } from "./support/page-health.ts";
import { waitForDreverReady } from "./support/drever-ready.ts";
import {
  captureNextViewTransition,
  monitorViewTransitions,
  readViewTransitionCalls,
  waitForViewTransition,
} from "./support/view-transitions.ts";

const activeSlide = '[data-drever-slide][data-slide-state="active"]';

test("the generated shell explains a cold first load before React is ready", async ({ page }) => {
  const releaseEntry = Promise.withResolvers<void>();
  await page.route(
    (url) => url.pathname === "/entry.js",
    async (route) => {
      await releaseEntry.promise;
      await route.continue();
    },
  );

  await page.goto("/", { waitUntil: "commit" });
  try {
    await expect(page.getByRole("status")).toContainText("Preparing the presentation");
    await expect(page.locator("[data-drever-loading]")).toBeVisible();
  } finally {
    releaseEntry.resolve();
  }

  await page.waitForLoadState("load");
  await expect(page.locator("[data-drever-loading]")).toHaveCount(0);
  await expect(page.locator(activeSlide)).toBeVisible();
});

test("the public dev command runs the complete interactive presentation workflow", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await page.goto("/");

  await expect(page.locator("[data-drever-slide]")).toHaveCount(5);
  await expect(page.locator(activeSlide)).toHaveAttribute("id", "slide-1");
  await expect(page.locator(activeSlide)).toContainText("Slides can stay useful.");
  await expect(page.getByText("Pause at step 2", { exact: false })).toHaveCount(0);

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/2$/u);
  await expect(page.locator(activeSlide)).toHaveAttribute("id", "slide-2");
  await expect(page.locator('[data-testid="step-2"]')).toHaveAttribute(
    "data-step-state",
    "pending",
  );
  await expect(page.locator(`${activeSlide} [data-drever-motion-group]`)).toHaveAttribute(
    "data-motion-flow",
    "block",
  );
  expect(
    await page.locator('[data-testid="step-2"]').evaluate((element) => {
      const [x = "0", y = "0"] = getComputedStyle(element).translate.split(" ");
      return [Number.parseFloat(x), Number.parseFloat(y)];
    }),
  ).toEqual([0, 12]);
  expect(
    await page.locator('[data-testid="step-2"]').evaluate((element) => {
      const style = getComputedStyle(element);
      return { clipPath: style.clipPath, scale: style.scale };
    }),
  ).toEqual({ clipPath: "none", scale: "1" });

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

test("the dev-only Pretext probe reports advisory layout evidence without entering production", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#drever-root")).toHaveAttribute("data-drever-ready", "");

  const report = await page.evaluate(async () => {
    const slide = document.querySelector<HTMLElement>(
      '[data-drever-slide][data-slide-state="active"]',
    );
    const audit = Reflect.get(globalThis, "__dreverExperimentalTextLayout");
    if (slide === null || typeof audit !== "function") {
      throw new Error("The development text-layout probe is unavailable.");
    }
    const sample = (
      text: string,
      width: number,
      height: number,
      styles: Readonly<Record<string, string>> = {},
      parent: HTMLElement = slide,
    ): HTMLElement => {
      const element = document.createElement("p");
      element.dataset.dreverTextAudit = "";
      element.textContent = text;
      Object.assign(element.style, {
        fontFamily: "Arial",
        fontFeatureSettings: "normal",
        fontSize: "20px",
        fontVariationSettings: "normal",
        height: `${height}px`,
        letterSpacing: "0px",
        lineHeight: "24px",
        margin: "0",
        overflow: "hidden",
        padding: "0",
        position: "absolute",
        textWrap: "wrap",
        width: `${width}px`,
        ...styles,
      });
      parent.append(element);
      return element;
    };
    sample("Short label", 240, 24);
    sample("This deliberately constrained label needs several lines to remain readable.", 120, 24);
    sample("  Preserved preformatted line\n\nwith a blank line.  ", 140, 24, {
      whiteSpace: "pre-wrap",
    });
    sample("Pretty wrapping is rendered by the browser.", 140, 48, {
      textWrap: "pretty",
    });
    sample("1234567890", 140, 24, {
      fontVariantNumeric: "tabular-nums",
    });
    const transparent = document.createElement("div");
    transparent.style.opacity = "0";
    slide.append(transparent);
    sample("Not visibly painted", 240, 24, {}, transparent);
    return await audit();
  });

  expect(report).toMatchObject({
    authority: "advisory",
    experimental: true,
    version: 1,
  });
  expect(report.checked, JSON.stringify(report.skipped)).toBeGreaterThanOrEqual(2);
  expect(report.skipped["font-or-transform"]).toBeGreaterThanOrEqual(1);
  expect(report.skipped["text-wrap-style"]).toBeGreaterThanOrEqual(1);
  expect(report.skipped["transparent-ancestor"]).toBeGreaterThanOrEqual(1);
  expect(report.measurements).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        element: expect.objectContaining({
          text: "Preserved preformatted line with a blank line.",
        }),
        whiteSpace: "pre-wrap",
      }),
    ]),
  );
  expect(report.findings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        actualOverflow: true,
        code: "DREVER_EXPERIMENTAL_TEXT_LAYOUT_RISK",
        element: expect.objectContaining({
          text: "This deliberately constrained label needs several lines to remain readable.",
        }),
        predictedOverflow: true,
      }),
    ]),
  );
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

test("the document route accepts a trailing directory slash in development", async ({ page }) => {
  const health = monitorPageHealth(page);
  const response = await page.goto("/document/");

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveURL(/\/document\/$/u);
  await expect(page.locator("[data-drever-document]")).toBeVisible();
  await expect(page.locator("[data-drever-document] [data-drever-slide]")).toHaveCount(5);
  health.expectHealthy();
});

test("audience controls navigate exact states with a pointer", async ({ page }) => {
  const health = monitorPageHealth(page);
  await page.goto("/");

  const controls = page.getByRole("navigation", { name: "Presentation controls" });
  const previous = controls.getByRole("button", { name: "Previous presentation state" });
  const next = controls.getByRole("button", { name: "Next presentation state" });
  const position = controls.getByRole("button", { name: "Open slide navigator" });

  await expect(controls).toBeVisible();
  await expect(position).toContainText("Slide 1 of 5");
  await expect(previous).toBeDisabled();

  await next.hover();
  await next.click();
  await expect(page).toHaveURL(/\/2$/u);
  await expect(controls).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).not.toBe("BUTTON");

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/2\/2$/u);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.matches(":active-view-transition")))
    .toBe(false);

  await page.mouse.move(10, 10);
  await page.mouse.move(220, 180);
  await expect(controls).toBeVisible();
  await expect(position).toContainText("Step 1 of 2");

  await previous.click();
  await expect(page).toHaveURL(/\/2$/u);
  await expect(previous).not.toBeFocused();

  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/\/$/u);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.matches(":active-view-transition")))
    .toBe(false);
  await page.mouse.move(10, 10);
  await page.mouse.move(220, 180);

  const fullscreen = controls.getByRole("button", { name: "Enter fullscreen" });
  await expect(fullscreen).toBeEnabled();
  await expect(fullscreen).toHaveAttribute("data-drever-tooltip", "Enter fullscreen · F");

  health.expectHealthy();
});

test("focus tools preserve marks across Steps and clear them across slides", async ({ page }) => {
  const health = monitorPageHealth(page);
  await page.goto("/2");
  await waitForDreverReady(page);

  const controls = page.getByRole("navigation", { name: "Presentation controls" });
  const focusLauncher = controls.getByRole("button", { name: "Open focus tools" });
  const launcherBounds = await focusLauncher.boundingBox();
  expect(launcherBounds).not.toBeNull();
  if (launcherBounds === null) return;
  const openFocusTools = async (): Promise<void> => {
    await page.mouse.move(
      launcherBounds.x + launcherBounds.width / 2,
      launcherBounds.y + launcherBounds.height / 2,
    );
    await focusLauncher.click();
  };

  await openFocusTools();
  const laser = controls.getByRole("button", { name: "Use laser pointer" });
  await expect(laser).toBeFocused();

  const layer = page.locator("[data-drever-focus-layer]");
  await expect(page.locator("[data-drever-canvas] > [data-drever-focus-layer]")).toHaveCount(1);
  await expect(page.locator("[data-drever-deck] [data-drever-focus-layer]")).toHaveCount(0);
  await expect(layer).not.toHaveAttribute("data-active", "");

  const laserBounds = await laser.boundingBox();
  expect(laserBounds).not.toBeNull();
  if (laserBounds === null) return;
  await page.mouse.move(
    laserBounds.x + laserBounds.width / 2,
    (laserBounds.y + laserBounds.height + launcherBounds.y) / 2,
    { steps: 8 },
  );
  await expect(controls.getByRole("toolbar", { name: "Focus tools" })).toBeVisible();
  await page.mouse.move(
    laserBounds.x + laserBounds.width / 2,
    laserBounds.y + laserBounds.height / 2,
    { steps: 4 },
  );
  await expect(laser).toBeVisible();
  await laser.click();
  await expect(layer).toHaveAttribute("data-active", "");

  const bounds = await layer.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds === null) return;

  await layer.dispatchEvent("pointermove", {
    clientX: bounds.x + 300,
    clientY: bounds.y + 180,
    isPrimary: true,
    pointerId: 11,
    pointerType: "pen",
  });
  await expect(page.locator("[data-drever-focus-laser]")).toHaveCount(1);
  await layer.dispatchEvent("pointercancel", {
    isPrimary: true,
    pointerId: 12,
    pointerType: "touch",
  });
  await expect(page.locator("[data-drever-focus-laser]")).toHaveCount(1);
  await layer.dispatchEvent("pointercancel", {
    isPrimary: true,
    pointerId: 11,
    pointerType: "pen",
  });
  await expect(page.locator("[data-drever-focus-laser]")).toHaveCount(0);

  await page.keyboard.press("l");
  await expect(layer).not.toHaveAttribute("data-active", "");

  for (const [key, tool] of [
    ["l", "laser"],
    ["i", "pen"],
    ["h", "highlighter"],
  ] as const) {
    await page.keyboard.press(key);
    await expect(layer).toHaveAttribute("data-active", "");
    await expect(layer).toHaveAttribute("data-focus-tool", tool);
    await page.keyboard.press(key);
    await expect(layer).not.toHaveAttribute("data-active", "");
  }

  await openFocusTools();
  await controls.getByRole("button", { name: "Use pen" }).click();

  const draw = async (offset: number): Promise<void> => {
    await page.mouse.move(bounds.x + 180, bounds.y + 150 + offset);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 440, bounds.y + 210 + offset, { steps: 8 });
    await page.mouse.up();
  };

  await draw(0);
  await expect(page.locator("[data-drever-focus-stroke]")).toHaveCount(1);
  await openFocusTools();
  await controls.getByRole("button", { name: "Undo focus stroke" }).click();
  await expect(page.locator("[data-drever-focus-stroke]")).toHaveCount(0);

  await page.keyboard.press("Escape");
  await page.mouse.move(bounds.x + 180, bounds.y + 150);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 440, bounds.y + 210, { steps: 8 });
  await layer.dispatchEvent("lostpointercapture", {
    isPrimary: true,
    pointerId: 1,
    pointerType: "mouse",
  });
  await page.mouse.up();
  await expect(page.locator("[data-drever-focus-stroke]")).toHaveCount(1);

  await openFocusTools();
  await controls.getByRole("button", { name: "Use highlighter" }).click();
  await draw(100);
  await expect(page.locator("[data-drever-focus-stroke]")).toHaveCount(2);

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/2\/2$/u);
  await expect(page.locator("[data-drever-focus-stroke]")).toHaveCount(2);

  await openFocusTools();
  await controls.getByRole("button", { name: "Clear focus marks" }).click();
  await expect(page.locator("[data-drever-focus-stroke]")).toHaveCount(0);
  await controls.getByRole("button", { name: "Use pen" }).click();
  await draw(40);
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/2\/5$/u);
  await expect(page.locator("[data-drever-focus-stroke]")).toHaveCount(1);
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/3$/u);
  await expect(page.locator("[data-drever-focus-stroke]")).toHaveCount(0);

  health.expectHealthy();
});

test("audience controls leave the canvas after pointer inactivity and return on intent", async ({
  page,
}) => {
  await monitorViewTransitions(page);
  await page.goto("/");
  const host = page.locator("[data-drever-audience-controls]");
  const controls = page.locator(".drever-audience-controls__bar");

  await page.mouse.move(200, 200);
  await expect(host).not.toHaveAttribute("data-drever-controls-idle", "");
  await expect.poll(() => host.getAttribute("data-drever-controls-idle")).toBe("");
  await expect(controls).toHaveCSS("pointer-events", "none");
  await expect(controls).toHaveCSS("view-transition-name", "none");
  const transition = await captureNextViewTransition(page, () => page.keyboard.press("ArrowRight"));
  await waitForViewTransition(page, transition, "ready");
  await expect(controls).toHaveCSS("view-transition-name", "none");
  await waitForViewTransition(page, transition, "finished");
  await expect(page).toHaveURL(/\/2$/u);

  await page.mouse.move(260, 220);
  await expect(host).not.toHaveAttribute("data-drever-controls-idle", "");
  await expect(controls).toHaveCSS("pointer-events", "auto");

  const next = controls.getByRole("button", { name: "Next presentation state" });
  await next.click();
  await expect(next).not.toBeFocused();
  await expect.poll(() => host.getAttribute("data-drever-controls-idle")).toBe("");

  await page.mouse.move(260, 220);
  await next.focus();
  await page.waitForTimeout(1_400);
  await expect(host).not.toHaveAttribute("data-drever-controls-idle", "");
});

test("fullscreen keeps the display awake and removes an idle cursor", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const state = globalThis as typeof globalThis & {
      __dreverFullscreen: boolean;
      __dreverWakeReleases: number;
      __dreverWakeRequests: number;
    };
    state.__dreverFullscreen = false;
    state.__dreverWakeReleases = 0;
    state.__dreverWakeRequests = 0;
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => (state.__dreverFullscreen ? document.documentElement : null),
    });
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        async request(type: string) {
          if (type !== "screen") throw new TypeError(`Unexpected wake lock type: ${type}`);
          state.__dreverWakeRequests += 1;
          return {
            addEventListener() {},
            async release() {
              state.__dreverWakeReleases += 1;
            },
            removeEventListener() {},
          };
        },
      },
    });
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: async () => {
        state.__dreverFullscreen = true;
        document.dispatchEvent(new Event("fullscreenchange"));
      },
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: async () => {
        state.__dreverFullscreen = false;
        document.dispatchEvent(new Event("fullscreenchange"));
      },
    });
  });

  const controls = page.getByRole("navigation", { name: "Presentation controls" });
  await controls.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(controls.getByRole("button", { name: "Exit fullscreen" })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (globalThis as typeof globalThis & { __dreverWakeRequests: number }).__dreverWakeRequests,
      ),
    )
    .toBe(1);
  await expect.poll(() => page.locator("html").getAttribute("data-drever-cursor-hidden")).toBe("");

  await page.mouse.move(300, 220);
  await expect(page.locator("html")).not.toHaveAttribute("data-drever-cursor-hidden", "");

  await controls.getByRole("button", { name: "Exit fullscreen" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (globalThis as typeof globalThis & { __dreverWakeReleases: number }).__dreverWakeReleases,
      ),
    )
    .toBe(1);
  await expect(page.locator("html")).not.toHaveAttribute("data-drever-cursor-hidden", "");
});

test("audience sharing copies the canonical visible slide and Step URL", async ({
  context,
  page,
}) => {
  const health = monitorPageHealth(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:4317",
  });
  await page.goto("/2/5?theme=dark#notes");

  await page.getByRole("button", { name: "Copy link to current presentation state" }).click();

  await expect(page.locator(".drever-audience-share-status")).toHaveText("Link copied.");
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("http://127.0.0.1:4317/2/5?theme=dark#notes");
  health.expectHealthy();
});

test("audience shortcuts skip Steps, search slides, and jump by number", async ({ page }) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await page.setViewportSize({ height: 480, width: 390 });
  await page.goto("/2/2");
  await expect(page.locator("#drever-root")).toHaveAttribute("data-drever-ready", "");

  await page.keyboard.press("ArrowDown");
  await expect(page).toHaveURL(/\/3$/u);

  await page.keyboard.press("ArrowUp");
  await expect(page).toHaveURL(/\/2$/u);
  await expect(page.getByTestId("step-2")).toHaveAttribute("data-step-state", "pending");

  await page.keyboard.press("o");
  const navigator = page.getByRole("dialog", { name: "Slide navigator" });
  await expect(navigator).toBeVisible();
  await expect(navigator.locator("[data-drever-slide-preview]")).toHaveCount(5);
  await expect(
    navigator.locator(
      '.drever-audience-slide-card[data-slide-index="1"] [data-drever-stage][data-drever-render-mode="export"]',
    ),
  ).toHaveAttribute("data-current-step", "5");
  await expect(
    navigator.locator('.drever-audience-slide-card[data-slide-index="1"] [data-drever-stage]'),
  ).toHaveAttribute("data-drever-reduced-motion", "");
  const lastPreview = navigator.locator(
    '.drever-audience-slide-card[data-slide-index="4"] [data-drever-stage]',
  );
  await expect(lastPreview).toHaveCount(0);
  await navigator
    .locator('.drever-audience-slide-card[data-slide-index="4"]')
    .scrollIntoViewIfNeeded();
  await expect(lastPreview).toHaveCount(1);
  await navigator.getByRole("searchbox", { name: "Find a slide" }).fill("static output");
  await expect(navigator.locator("[data-drever-slide-preview]")).toHaveCount(1);
  const transition = await captureNextViewTransition(page, () =>
    navigator.getByRole("button", { name: /Static output/u }).click(),
  );
  await expect(page).toHaveURL(/\/3$/u);
  await waitForViewTransition(page, transition, "finished");

  await page.keyboard.press("g");
  await expect(navigator).toBeVisible();
  await navigator.getByRole("searchbox", { name: "Find a slide" }).fill("5");
  await navigator.getByRole("button", { name: /Ship the story/u }).click();
  await expect(page).toHaveURL(/\/5$/u);

  await page.keyboard.press("4");
  const goto = page.getByRole("status");
  await expect(goto).toContainText("Go to slide");
  await expect(goto).toContainText("4");
  await expect(goto).toContainText("Press Enter");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/4$/u);

  health.expectHealthy();
});

test("audience pause screens and keyboard help are dismissible", async ({ page }) => {
  const health = monitorPageHealth(page);
  await page.goto("/2/5");
  await waitForDreverReady(page);

  await page.keyboard.press("b");
  const blackPause = page.getByRole("button", {
    name: "Black pause screen. Press Escape to return.",
  });
  await expect(blackPause).toBeVisible();
  await expect(blackPause).toHaveAttribute("data-pause-screen", "black");
  await page.keyboard.press("Escape");
  await expect(blackPause).toHaveCount(0);
  await expect(page).toHaveURL(/\/2\/5$/u);

  await page.keyboard.press("w");
  const whitePause = page.getByRole("button", {
    name: "White pause screen. Press Escape to return.",
  });
  await expect(whitePause).toHaveAttribute("data-pause-screen", "white");
  await whitePause.click();
  await expect(whitePause).toHaveCount(0);

  await page.keyboard.press("Shift+Slash");
  const help = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(help).toBeVisible();
  await expect(help).toContainText("Next / previous slide");
  await expect(help).toContainText("Pause on black / white");
  await page.keyboard.press("Escape");
  await expect(help).not.toBeVisible();

  health.expectHealthy();
});

test.describe("touch audience controls", () => {
  test.use({ hasTouch: true });

  test("navigate sparse Step states without a keyboard", async ({ page }) => {
    const health = monitorPageHealth(page);
    await page.goto("/2");

    const controls = page.getByRole("navigation", { name: "Presentation controls" });
    const next = controls.getByRole("button", { name: "Next presentation state" });
    const previous = controls.getByRole("button", { name: "Previous presentation state" });

    await expect(controls).toBeVisible();
    await next.tap();
    await expect(page).toHaveURL(/\/2\/2$/u);
    await previous.tap();
    await expect(page).toHaveURL(/\/2$/u);

    health.expectHealthy();
  });
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

  const focusSurface = current.locator("[data-drever-focus-layer]");
  await expect(page.getByRole("button", { name: "Use audience laser pointer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Use audience pen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Use audience highlighter" })).toBeVisible();
  await page.getByRole("button", { name: "Use audience pen" }).click();
  const focusBounds = await focusSurface.boundingBox();
  if (focusBounds === null) {
    throw new Error("The speaker focus surface must have visible canvas bounds.");
  }
  await page.mouse.move(
    focusBounds.x + focusBounds.width * 0.3,
    focusBounds.y + focusBounds.height * 0.35,
  );
  await page.mouse.down();
  await page.mouse.move(
    focusBounds.x + focusBounds.width * 0.62,
    focusBounds.y + focusBounds.height * 0.48,
  );
  await page.mouse.up();
  await expect(current.locator('[data-focus-source="local"][data-focus-tool="pen"]')).toHaveCount(
    1,
  );

  const audience = await context.newPage();
  const audienceHealth = monitorPageHealth(audience);
  await audience.goto("/");
  await expect(audience).toHaveURL(/\/2\/2$/u);
  await expect(audience.getByTestId("step-2")).toHaveAttribute("data-step-state", "active");
  const speakerPen = audience.locator('[data-focus-source="speaker"][data-focus-tool="pen"]');
  await expect(speakerPen).toHaveCount(1);

  await page.getByRole("button", { name: "Use audience laser pointer" }).click();
  await page.mouse.move(
    focusBounds.x + focusBounds.width * 0.68,
    focusBounds.y + focusBounds.height * 0.38,
  );
  await expect(audience.locator("[data-drever-focus-laser]")).toHaveCount(1);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(audience.locator("[data-drever-focus-laser]")).toHaveCount(0);
  await page.getByRole("button", { name: "Use audience laser pointer" }).click();
  await expect(audience.locator("[data-drever-focus-laser]")).toHaveCount(0);

  await page.getByRole("button", { name: "Next presentation state" }).click();
  await expect(page).toHaveURL(/\/speaker\/2\/5$/u);
  await expect(audience).toHaveURL(/\/2\/5$/u);
  await expect(audience.getByTestId("step-5")).toHaveAttribute("data-step-state", "active");
  await expect(speakerPen).toHaveCount(1);

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Open audience" }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/\/2\/5$/u);
  await expect(popup.locator('[data-focus-source="speaker"][data-focus-tool="pen"]')).toHaveCount(
    1,
  );
  await popup.close();

  await page.getByRole("button", { name: /Browse slides/u }).click();
  const navigator = page.getByRole("dialog", { name: "Jump to a slide" });
  await expect(navigator).toBeVisible();
  await expect(navigator.getByRole("searchbox", { name: "Find a slide" })).toBeFocused();
  await navigator.getByRole("searchbox", { name: "Find a slide" }).fill("interfaces");
  await navigator.getByRole("button", { name: "Go to slide 4: Interfaces remember." }).click();
  await expect(page).toHaveURL(/\/speaker\/4$/u);
  await expect(audience).toHaveURL(/\/4$/u);
  await expect(speakerPen).toHaveCount(0);
  await expect(navigator).not.toBeVisible();

  speakerHealth.expectHealthy();
  audienceHealth.expectHealthy();
});

test("speaker rehearsal accounts for slide visits, targets, pause, and reset", async ({ page }) => {
  const health = monitorPageHealth(page);
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.goto("/speaker/2");
  await expect(page.locator("[data-drever-speaker]")).toBeVisible();
  await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));

  const elapsed = page.getByTestId("rehearsal-elapsed");
  const currentSlide = page.getByTestId("rehearsal-current-slide");
  const pace = page.getByTestId("rehearsal-pace");
  const target = page.getByTestId("rehearsal-target");
  const pause = page.getByRole("button", { name: "Pause" });
  const next = page.getByRole("button", { name: "Next presentation state" });
  const previous = page.getByRole("button", { name: "Previous presentation state" });

  await page.getByRole("button", { name: "Reset" }).click();
  await expect(target).toHaveValue("5");
  await page.clock.runFor(10_000);
  await next.click();
  await expect(page).toHaveURL(/\/speaker\/2\/2$/u);
  await page.clock.runFor(5_000);
  await expect(elapsed).toHaveText("00:00:15");
  await expect(currentSlide).toHaveText("00:00:15");
  await expect(pace).toHaveText("00:04:45");

  await next.click();
  await next.click();
  await expect(page).toHaveURL(/\/speaker\/3$/u);
  await page.clock.runFor(7_000);
  await previous.click();
  await expect(page).toHaveURL(/\/speaker\/2\/5$/u);
  await page.clock.runFor(3_000);

  await page.locator('summary[aria-label="Open per-slide timing summary"]').click();
  const timings = page.getByTestId("rehearsal-timings");
  const slideTwo = timings.locator('[data-slide-id="slide-2"]');
  const slideThree = timings.locator('[data-slide-id="slide-3"]');
  await expect(slideTwo).toContainText("2 visits");
  await expect(slideTwo.locator("time")).toHaveText("00:00:18");
  await expect(slideThree).toContainText("1 visit");
  await expect(slideThree.locator("time")).toHaveText("00:00:07");

  await pause.click();
  await page.clock.runFor(30_000);
  await expect(elapsed).toHaveText("00:00:25");
  await expect(currentSlide).toHaveText("00:00:03");
  await target.fill("0.3");
  await expect(pace).toHaveText("00:00:07");
  await expect(pace.locator("..")).toHaveAttribute("data-rehearsal-pace", "over");
  await expect(page.getByTestId("rehearsal-status")).toHaveText("Behind");

  await page.getByRole("button", { name: "Reset" }).click();
  await expect(elapsed).toHaveText("00:00:00");
  await expect(currentSlide).toHaveText("00:00:00");
  await expect(pace).toHaveText("00:00:18");
  await expect(slideTwo).toContainText("1 visit");
  await expect(slideThree).toContainText("Not visited");

  await page.getByRole("button", { name: "Resume" }).click();
  await page.clock.runFor(2_000);
  await expect(elapsed).toHaveText("00:00:02");
  health.expectHealthy();
});

test.describe("compact speaker rehearsal", () => {
  test.use({ viewport: { height: 720, width: 480 } });

  test("keeps controls and the timing summary inside the viewport", async ({ page }) => {
    const health = monitorPageHealth(page);
    await page.goto("/speaker/2");

    const header = page.locator(".drever-speaker__header");
    await expect(header).toBeVisible();
    expect(
      await header.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      })),
    ).toEqual({ clientWidth: 480, scrollWidth: 480 });
    await expect(page.getByTestId("rehearsal-target")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset" })).toBeVisible();

    await page.locator('summary[aria-label="Open per-slide timing summary"]').click();
    const popover = page.getByTestId("rehearsal-timings");
    await expect(popover).toBeVisible();
    expect(
      await popover.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return { left: bounds.left, right: bounds.right };
      }),
    ).toEqual({ left: 8, right: 472 });
    health.expectHealthy();
  });

  test("keeps the current slide, notes, and controls usable at phone width", async ({ page }) => {
    const health = monitorPageHealth(page);
    await page.setViewportSize({ height: 720, width: 320 });
    await page.goto("/speaker/2");

    await expect(page.getByTestId("speaker-current")).toBeVisible();
    await expect(page.getByTestId("speaker-next")).not.toBeVisible();
    await expect(page.getByTestId("speaker-notes")).toBeVisible();

    for (const name of [
      "Previous presentation state",
      "Next presentation state",
      "Use audience laser pointer",
      "Use audience pen",
      "Use audience highlighter",
      "Open audience",
    ]) {
      await expect(page.getByRole("button", { name })).toBeInViewport();
    }

    const speaker = page.locator("[data-drever-speaker]");
    expect(
      await speaker.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      })),
    ).toEqual({ clientWidth: 320, scrollWidth: 320 });
    health.expectHealthy();
  });
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

  const pen = page.getByRole("button", { name: "Use audience pen" });
  const highlighter = page.getByRole("button", { name: "Use audience highlighter" });
  await pen.click();
  await expect(pen).toBeFocused();
  await expect(pen).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("h");
  await expect(highlighter).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("h");
  await expect(highlighter).toHaveAttribute("aria-pressed", "false");

  const notes = page.getByTestId("speaker-notes");
  await notes.focus();
  await expect(notes).toBeFocused();
  await notes.press("PageDown");
  await expect(page).toHaveURL(/\/speaker\/2\/5$/u);

  health.expectHealthy();
});

test("audience controls remain usable within a narrow viewport", async ({ page }) => {
  const health = monitorPageHealth(page);
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/2/2");

  const toolbar = page.getByRole("navigation", { name: "Presentation controls" });
  const scrollStrip = toolbar.locator(".drever-audience-controls__scroll");
  const previous = page.getByRole("button", { name: "Previous presentation state" });
  const overview = page.getByRole("button", { name: "Open slide navigator" });
  const next = page.getByRole("button", { name: "Next presentation state" });
  const share = page.getByRole("button", { name: "Copy link to current presentation state" });

  await expect(toolbar).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Mobile viewing options" })).toBeVisible();
  await page.getByRole("button", { name: "Dismiss mobile viewing hint" }).click();
  await expect(
    page.getByRole("complementary", { name: "Mobile viewing options" }),
  ).not.toBeVisible();
  await expect(previous).toBeInViewport();
  await expect(overview).toBeInViewport();
  await expect(next).toBeInViewport();
  await expect(share).toBeInViewport();

  const initial = await toolbar.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      left: Math.round(bounds.left),
      pageScrollWidth: document.documentElement.scrollWidth,
      right: Math.round(bounds.right),
      viewportWidth: window.innerWidth,
    };
  });
  expect(initial).toMatchObject({
    left: 8,
    pageScrollWidth: 390,
    right: 382,
    viewportWidth: 390,
  });
  const scrollWidths = await scrollStrip.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(scrollWidths.scrollWidth).toBeGreaterThan(scrollWidths.clientWidth);

  await scrollStrip.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await expect(page.getByRole("button", { name: "Open speaker view" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Show keyboard shortcuts" })).toBeInViewport();
  await page.getByRole("button", { name: "Open focus tools" }).click();
  await expect(page.getByRole("toolbar", { name: "Focus tools" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Use laser pointer" })).toBeInViewport();
  await page.keyboard.press("Escape");

  await scrollStrip.evaluate((element) => {
    element.scrollLeft = 0;
  });
  await previous.click();
  await expect(page).toHaveURL(/\/2$/u);
  health.expectHealthy();
});

test("document transitions capture the deck while audience controls leave the snapshot", async ({
  page,
}) => {
  await monitorViewTransitions(page);

  await page.goto("/");
  await waitForDreverReady(page);
  const controlsHost = page.locator("[data-drever-audience-controls]");
  const toolbar = page.locator(".drever-audience-controls__bar");
  await expect(controlsHost).not.toHaveAttribute("data-drever-controls-navigation-hidden", "");
  await expect(toolbar).toHaveCSS("visibility", "visible");
  await expect(toolbar).toHaveCSS("view-transition-name", "drever-toolbar");
  await page.evaluate(() => {
    Reflect.set(
      globalThis,
      "__dreverAudienceControls",
      document.querySelector("[data-drever-audience-controls]"),
    );
  });

  const transition = await captureNextViewTransition(page, () => page.keyboard.press("ArrowRight"));
  await waitForViewTransition(page, transition, "ready");
  await expect(page).toHaveURL(/\/2$/u);
  await expect(controlsHost).toHaveAttribute("data-drever-controls-navigation-hidden", "");
  await expect(toolbar).toHaveCSS("visibility", "hidden");
  await expect(toolbar).toHaveCSS("view-transition-name", "none");

  expect(await readViewTransitionCalls(page)).toEqual([
    { kind: "document", target: "document", types: ["drever-slide-forward"] },
  ]);
  const transitionStyles = await page.evaluate(() => {
    const deck = document.querySelector<HTMLElement>("[data-drever-deck]");
    const controls = document.querySelector<HTMLElement>("[data-drever-audience-controls]");
    const toolbar = document.querySelector<HTMLElement>(".drever-audience-controls__bar");
    const canvas = document.querySelector<HTMLElement>("[data-drever-canvas]");
    if (deck === null || controls === null || toolbar === null || canvas === null) {
      throw new Error("Expected the audience viewer surfaces to be mounted.");
    }
    const read = (pseudo: string) => {
      const style = getComputedStyle(document.documentElement, pseudo);
      return {
        animationName: style.animationName,
        filter: style.filter,
        mixBlendMode: style.mixBlendMode,
        opacity: Number(style.opacity),
      };
    };
    return {
      controlsLeaveTheSnapshot:
        controls === Reflect.get(globalThis, "__dreverAudienceControls") &&
        !deck.contains(controls) &&
        !canvas.contains(controls) &&
        getComputedStyle(controls).viewTransitionName === "none" &&
        getComputedStyle(toolbar).viewTransitionName === "none" &&
        getComputedStyle(toolbar).visibility === "hidden",
      deckName: getComputedStyle(deck).viewTransitionName,
      deckPairOverflow: getComputedStyle(
        document.documentElement,
        "::view-transition-image-pair(drever-deck)",
      ).overflow,
      newDeck: read("::view-transition-new(drever-deck)"),
      oldDeck: read("::view-transition-old(drever-deck)"),
      overlayPointerEvents: getComputedStyle(document.documentElement, "::view-transition")
        .pointerEvents,
      rootName: getComputedStyle(document.documentElement).viewTransitionName,
    };
  });
  expect(transitionStyles).toMatchObject({
    controlsLeaveTheSnapshot: true,
    deckName: "drever-deck",
    deckPairOverflow: "clip",
    newDeck: {
      animationName: "drever-slide-cover",
      filter: "none",
      mixBlendMode: "normal",
      opacity: 1,
    },
    oldDeck: { animationName: "none", mixBlendMode: "normal", opacity: 0 },
    overlayPointerEvents: "none",
    rootName: "none",
  });
  await waitForViewTransition(page, transition, "finished");
  await expect(controlsHost).toHaveAttribute("data-drever-controls-navigation-hidden", "");
  await page.mouse.move(10, 10);
  await page.mouse.move(220, 180);
  await expect(controlsHost).not.toHaveAttribute("data-drever-controls-navigation-hidden", "");
  await expect(toolbar).toHaveCSS("visibility", "visible");
  await expect(page.locator('[data-drever-slide][data-slide-state="active"] h2')).toHaveCSS(
    "view-transition-name",
    "none",
  );
});

test("step motion keeps unchanged slide content stationary", async ({ page }) => {
  await monitorViewTransitions(page);
  await page.goto("/2");
  await waitForDreverReady(page);

  const heading = page.locator('[data-drever-slide][data-slide-state="active"] h2');
  const lead = page.locator(`${activeSlide} > p`).first();
  const contentBounds = async () => ({
    heading: await readElementBounds(heading),
    lead: await readElementBounds(lead),
  });
  const before = await contentBounds();

  for (const navigation of [
    { key: "ArrowRight", route: /\/2\/2$/u },
    { key: "ArrowRight", route: /\/2\/5$/u },
    { key: "ArrowLeft", route: /\/2\/2$/u },
  ]) {
    await page.keyboard.press(navigation.key);
    await expect(page).toHaveURL(navigation.route);

    const during = await contentBounds();
    expectStableBounds(during.heading, before.heading);
    expectStableBounds(during.lead, before.lead);
    const activeStep = page.locator(`${activeSlide} [data-drever-step][data-step-state="active"]`);
    await expect(activeStep).toHaveCSS("view-transition-name", "none");
    expect(
      await activeStep.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          duration: style.transitionDuration,
          property: style.transitionProperty,
        };
      }),
    ).toMatchObject({ property: expect.stringContaining("opacity") });
    const after = await contentBounds();
    expectStableBounds(after.heading, before.heading);
    expectStableBounds(after.lead, before.lead);
  }

  expect(await readViewTransitionCalls(page)).toEqual([]);
});

test("back-to-back Step commands commit only the newest exact state", async ({ page }) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await page.goto("/2");
  await waitForDreverReady(page);

  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }));
  });

  await expect(page).toHaveURL(/\/2\/5$/u);
  await expect(page.locator('[data-testid="step-5"]')).toHaveAttribute("data-step-state", "active");
  expect(await readViewTransitionCalls(page)).toEqual([]);
  health.expectHealthy();
});

test("a second slide navigation supersedes an in-flight transition cleanly", async ({ page }) => {
  const health = monitorPageHealth(page);
  await monitorViewTransitions(page);
  await page.goto("/2/5");
  await waitForDreverReady(page);

  const first = await captureNextViewTransition(page, () => page.keyboard.press("ArrowRight"));
  await waitForViewTransition(page, first, "ready");
  await expect(page).toHaveURL(/\/3$/u);

  const second = await captureNextViewTransition(page, () => page.keyboard.press("ArrowRight"));
  await waitForViewTransition(page, second, "finished");
  await expect(page).toHaveURL(/\/4$/u);
  await waitForViewTransition(page, first, "finished");

  expect(await readViewTransitionCalls(page)).toEqual([
    { kind: "document", target: "document", types: ["drever-slide-forward"] },
    { kind: "document", target: "document", types: ["drever-slide-forward"] },
  ]);
  health.expectHealthy();
});

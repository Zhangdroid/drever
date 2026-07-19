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

  await next.click();
  await expect(page).toHaveURL(/\/2\/2$/u);
  await expect(position).toContainText("Step 1 of 2");

  await previous.click();
  await expect(page).toHaveURL(/\/2$/u);

  const fullscreen = controls.getByRole("button", { name: "Enter fullscreen" });
  await expect(fullscreen).toBeEnabled();
  await expect(fullscreen).toHaveAttribute("title", "Enter fullscreen (F)");

  health.expectHealthy();
});

test("audience controls leave the canvas after pointer inactivity and return on intent", async ({
  page,
}) => {
  await page.goto("/");
  const host = page.locator("[data-drever-audience-controls]");
  const controls = page.getByRole("navigation", { name: "Presentation controls" });

  await page.mouse.move(200, 200);
  await expect(host).not.toHaveAttribute("data-drever-controls-idle", "");
  await expect.poll(() => host.getAttribute("data-drever-controls-idle")).toBe("");
  await expect(controls).toHaveCSS("pointer-events", "none");

  await page.mouse.move(260, 220);
  await expect(host).not.toHaveAttribute("data-drever-controls-idle", "");
  await expect(controls).toHaveCSS("pointer-events", "auto");

  const next = controls.getByRole("button", { name: "Next presentation state" });
  await next.focus();
  await page.waitForTimeout(2_000);
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
  await page.goto("/2/2");

  await page.keyboard.press("ArrowDown");
  await expect(page).toHaveURL(/\/3$/u);

  await page.keyboard.press("ArrowUp");
  await expect(page).toHaveURL(/\/2$/u);
  await expect(page.getByTestId("step-2")).toHaveAttribute("data-step-state", "pending");

  await page.keyboard.press("o");
  const navigator = page.getByRole("dialog", { name: "Slide navigator" });
  await expect(navigator).toBeVisible();
  await navigator.getByRole("searchbox", { name: "Find a slide" }).fill("static output");
  await navigator.getByRole("button", { name: /Static output/u }).click();
  await expect(page).toHaveURL(/\/3$/u);

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

test("React owns one slide transition while the document surface stays still", async ({ page }) => {
  await monitorViewTransitions(page);

  await page.goto("/");
  const transition = await captureNextViewTransition(page, () => page.keyboard.press("ArrowRight"));
  await waitForViewTransition(page, transition, "ready");
  await expect(page).toHaveURL(/\/2$/u);

  expect(await readViewTransitionCalls(page)).toEqual([
    { kind: "document", target: "document", types: ["drever-slide-forward"] },
  ]);
  const transitionStyles = await page.evaluate(() => {
    const root = document.documentElement;
    const read = (pseudo: string) => {
      const style = getComputedStyle(root, pseudo);
      return {
        animationName: style.animationName,
        filter: style.filter,
        height: Number.parseFloat(style.height),
        mixBlendMode: style.mixBlendMode,
        opacity: Number(style.opacity),
        width: Number.parseFloat(style.width),
        zIndex: style.zIndex,
      };
    };
    return {
      chromeGroup: read("::view-transition-group(drever-audience-chrome)"),
      newChrome: read("::view-transition-new(drever-audience-chrome)"),
      newRoot: read("::view-transition-new(root)"),
      newSlide: read("::view-transition-new(drever-slide-1)"),
      oldRoot: read("::view-transition-old(root)"),
      oldSlide: read("::view-transition-old(drever-slide-0)"),
    };
  });
  expect(transitionStyles).toMatchObject({
    chromeGroup: { animationName: "none", zIndex: "4" },
    newChrome: { animationName: "none", opacity: 0 },
    newRoot: { animationName: "none", mixBlendMode: "normal", opacity: 1 },
    newSlide: {
      animationName: "drever-slide-cover",
      filter: "none",
      mixBlendMode: "normal",
      opacity: 1,
    },
    oldRoot: { animationName: "none", mixBlendMode: "normal", opacity: 0 },
    oldSlide: { filter: "none", mixBlendMode: "normal", opacity: 0 },
  });
  expect(transitionStyles.chromeGroup.height).toBeLessThan(100);
  expect(transitionStyles.chromeGroup.width).toBeLessThan(1_000);
  await waitForViewTransition(page, transition, "finished");
  await expect(page.locator('[data-drever-slide][data-slide-state="active"] h2')).toHaveCSS(
    "view-transition-name",
    "none",
  );
});

test("step motion keeps unchanged slide content stationary", async ({ page }) => {
  await monitorViewTransitions(page);
  await page.goto("/2");

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

import { expect, test } from "@playwright/test";
import { monitorPageHealth } from "./support/page-health.ts";
import {
  captureNextViewTransition,
  monitorViewTransitions,
  readViewTransitionCalls,
  waitForViewTransition,
} from "./support/view-transitions.ts";

test("the specimen renders the canonical local brand system at desktop and mobile sizes", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  const foreignOrigins = new Set<string>();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith("http") && url.hostname !== "127.0.0.1") {
      foreignOrigins.add(url.origin);
    }
  });

  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ideas, in motion.");
  await expect(page.getByText("Keep 25% of the rendered mark height clear")).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(246, 243, 233)");

  const tokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(
      ["ink", "paper", "signal", "continuity"].map((name) => [
        name,
        style.getPropertyValue(`--drever-brand-color-${name}`).trim().toUpperCase(),
      ]),
    );
  });
  expect(tokens).toEqual({
    continuity: "#5B45D8",
    ink: "#19172B",
    paper: "#F6F3E9",
    signal: "#C7F03A",
  });

  const images = page.locator("[data-drever-lockup], [data-drever-mark]");
  expect(await images.count()).toBeGreaterThanOrEqual(8);
  await expect
    .poll(() =>
      images.evaluateAll((elements) =>
        elements.every(
          (element) =>
            element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0,
        ),
      ),
    )
    .toBe(true);

  const brandFontsLoaded = await page.evaluate(async () => {
    await document.fonts.ready;
    const loadedFamilies = new Set(
      [...document.fonts]
        .filter((face) => face.status === "loaded")
        .map((face) => face.family.replaceAll('"', "")),
    );
    return ["Bricolage Grotesque", "Instrument Sans"].every((family) => loadedFamilies.has(family));
  });
  expect(brandFontsLoaded).toBe(true);
  expect([...foreignOrigins]).toEqual([]);

  await page.setViewportSize({ height: 844, width: 390 });
  await expect(page.locator(".site-header")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  health.expectHealthy();
});

test("theme switching uses a native View Transition and swaps the approved dark assets", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await page.emulateMedia({ colorScheme: "light" });
  await monitorViewTransitions(page);
  await page.goto("/");

  const toggle = page.locator("[data-theme-toggle]");
  const heroMark = page.locator(".hero-mark");
  const headerLockup = page.locator(".brand-home [data-drever-lockup]");
  const readHeroMark = async (): Promise<string> =>
    decodeURIComponent((await heroMark.getAttribute("src")) ?? "");
  await expect(toggle).toHaveAccessibleName("Switch to dark mode");
  expect(await readHeroMark()).toContain("#19172B");
  await expect(headerLockup).not.toHaveAttribute("src", /lockup-dark/u);

  const transition = await captureNextViewTransition(page, () => toggle.click());
  await waitForViewTransition(page, transition, "ready");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveAccessibleName("Switch to light mode");
  await expect.poll(readHeroMark).toContain("#F6F3E9");
  await expect(headerLockup).toHaveAttribute("src", /lockup-dark/u);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#111018");
  await waitForViewTransition(page, transition, "finished");

  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(17, 16, 24)");
  expect(await readViewTransitionCalls(page)).toEqual([
    { kind: "document", target: "document", types: [] },
  ]);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".brand-home [data-drever-lockup]")).toHaveAttribute(
    "src",
    /lockup-dark/u,
  );

  health.expectHealthy();
});

test("the motion specimen animates one changed state and becomes static for reduced motion", async ({
  page,
}) => {
  const health = monitorPageHealth(page);
  await page.goto("/");

  const demo = page.locator("[data-motion-demo]");
  const replay = page.getByRole("button", { name: "Replay" });
  const pulse = page.locator(".motion-pulse");
  await replay.click();
  await expect(demo).toHaveClass(/is-playing/u);
  await expect(pulse).toHaveCSS("animation-name", "motion-pulse");
  await expect(demo).not.toHaveClass(/is-playing/u);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await replay.click();
  await expect(demo).not.toHaveClass(/is-playing/u);
  await expect(pulse).toHaveCSS("animation-name", "none");

  health.expectHealthy();
});

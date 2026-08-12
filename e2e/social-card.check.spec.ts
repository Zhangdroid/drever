import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";

const root = join(import.meta.dirname, "..");
const sourcePath = join(root, ".github", "assets", "drever-social-card.svg");
const imagePath = join(root, "website", "public", "social-card.png");

test("the social card renders with the website brand fonts", async ({ page }) => {
  await page.goto(pathToFileURL(sourcePath).href);
  await page.evaluate(async () => document.fonts.ready);

  const loadedFamilies = await page.evaluate(() =>
    [...document.fonts]
      .filter((font) => font.status === "loaded")
      .map((font) => font.family.replaceAll('"', "")),
  );
  expect(loadedFamilies).toContain("Bricolage Grotesque");
  expect(loadedFamilies).toContain("Instrument Sans");

  const headline = page.locator("text.hero-display").first();
  await expect(headline).toHaveCSS(
    "font-family",
    /Bricolage Grotesque.*Instrument Sans.*sans-serif/iu,
  );
  const headlineWidth = await headline.evaluate((element) =>
    element instanceof SVGGraphicsElement ? element.getBBox().width : 0,
  );
  expect(headlineWidth).toBeGreaterThan(425);
  expect(headlineWidth).toBeLessThan(431);

  const png = await readFile(imagePath);
  expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
});

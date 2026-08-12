import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";

const root = join(import.meta.dirname, "..");
const sourcePath = join(root, ".github", "assets", "drever-social-card-source.svg");
const svgImagePath = join(root, ".github", "assets", "drever-social-card.svg");
const imagePath = join(root, "website", "public", "social-card.png");
const readmePath = join(root, "README.md");

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

  const underlineGeometry = await page.evaluate(() => {
    const text = document.querySelectorAll<SVGGraphicsElement>("text.hero-display")[1];
    const underline = document.querySelector<SVGGraphicsElement>(".hero-underline");
    if (text === undefined || underline === null) return;
    const textBox = text.getBBox();
    const underlineBox = underline.getBBox();
    return {
      leftExtension: textBox.x - underlineBox.x,
      rightExtension: underlineBox.x + underlineBox.width - (textBox.x + textBox.width),
      underlineHeight: underlineBox.height,
    };
  });
  expect(underlineGeometry).toEqual({
    leftExtension: 2,
    rightExtension: expect.closeTo(5.4, 0),
    underlineHeight: 19,
  });

  const png = await readFile(imagePath);
  expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);

  const svgImage = await readFile(svgImagePath, "utf8");
  expect(svgImage).toContain('data-social-text="drafts"');
  expect(svgImage).toContain('data-social-underline="true"');
  expect(svgImage).not.toContain("data:");
  expect(svgImage).not.toContain("<image");
  expect(svgImage).not.toContain("<text");
  expect(svgImage).not.toContain("@font-face");
  await page.goto(pathToFileURL(svgImagePath).href);
  const outlinedHeadline = await page.locator('[data-social-text="drafts"]').evaluate((element) => {
    const box = (element as SVGGraphicsElement).getBBox();
    return { height: box.height, width: box.width };
  });
  expect(outlinedHeadline.width).toBeGreaterThan(425);
  expect(outlinedHeadline.width).toBeLessThan(431);
  expect(outlinedHeadline.height).toBeGreaterThan(50);
  expect(outlinedHeadline.height).toBeLessThan(58);
  await expect(page.locator('[data-social-underline="true"]')).toHaveAttribute("width", "260");

  const readme = await readFile(readmePath, "utf8");
  expect(readme).toContain('src="./website/public/social-card.png?v=website-hero"');
});

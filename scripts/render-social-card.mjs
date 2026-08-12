import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, ".github", "assets", "drever-social-card-source.svg");
const svgOutputPath = join(root, ".github", "assets", "drever-social-card.svg");
const outputPath = join(root, "website", "public", "social-card.png");
const svgImageHref = "../../website/public/social-card.png?v=website-hero";

export const renderSocialCard = async () => {
  const browser = await chromium.launch({ channel: "chromium", headless: true });

  try {
    const page = await browser.newPage({
      deviceScaleFactor: 1,
      viewport: { height: 630, width: 1200 },
    });
    await page.goto(pathToFileURL(sourcePath).href, { waitUntil: "load" });
    await page.evaluate(async () => document.fonts.ready);

    const fontFamilies = await page.evaluate(() =>
      [...document.fonts]
        .filter((font) => font.status === "loaded")
        .map((font) => font.family.replaceAll('"', "")),
    );
    if (
      !fontFamilies.includes("Bricolage Grotesque") ||
      !fontFamilies.includes("Instrument Sans")
    ) {
      throw new Error("Social-card fonts did not load before capture.");
    }

    const headlineWidth = await page
      .locator("text.hero-display")
      .first()
      .evaluate((element) => (element instanceof SVGGraphicsElement ? element.getBBox().width : 0));
    if (headlineWidth < 425 || headlineWidth > 431) {
      throw new Error(
        `Social-card headline did not render with the expected brand metrics (${headlineWidth}).`,
      );
    }

    const image = await page.screenshot({
      animations: "disabled",
      clip: { height: 630, width: 1200, x: 0, y: 0 },
      type: "png",
    });
    await writeFile(outputPath, image);
    await writeFile(
      svgOutputPath,
      `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <title>Drever: Your agent drafts. You direct.</title>
  <image width="1200" height="630" href="${svgImageHref}" />
</svg>
`,
    );
  } finally {
    await browser.close();
  }
};

const invokedPath = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  await renderSocialCard();
}

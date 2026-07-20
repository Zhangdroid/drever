import { readFileSync, statSync } from "node:fs";
import {
  collectTokens,
  renderCss,
  renderTypescript,
  toCssValue,
} from "../scripts/generate-tokens.mjs";
import { brandTokens, brandTokenValues } from "./generated-tokens.ts";
import { describe, expect, it } from "vite-plus/test";

const readPackageFile = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const pathData = (source: string): readonly string[] =>
  [...source.matchAll(/<path\b[^>]*\bd="([^"]+)"/gu)].map((match) => match[1]!);

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/gu)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);

  if (channels === undefined) throw new Error(`Invalid hex color ${hex}.`);
  return channels
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce(
      (luminance, channel, index) => luminance + channel * [0.2126, 0.7152, 0.0722][index]!,
      0,
    );
}

function contrast(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("@drever/brand", () => {
  it("keeps CSS and TypeScript outputs deterministic from the DTCG source", () => {
    const source = JSON.parse(readPackageFile("tokens.json"));
    const tokens = collectTokens(source);

    expect(readPackageFile("tokens.css")).toBe(renderCss(tokens));
    expect(readPackageFile("src/generated-tokens.ts")).toBe(renderTypescript(tokens));
    expect(Object.keys(brandTokenValues)).toHaveLength(tokens.length);
    expect(brandTokens.motion.duration.standard).toBe("320ms");
    expect(brandTokens.geometry.shift).toBe("0.75rem");
    expect(brandTokens.font.family.display).toContain('"Bricolage Grotesque"');
  });

  it("rejects malformed token names and values at generation time", () => {
    expect(() =>
      collectTokens({ color: { $type: "color", "Invalid token": { $value: {} } } }),
    ).toThrow("invalid token name");
    expect(() => toCssValue("dimension", { unit: "em", value: 1 }, "space.bad")).toThrow(
      "invalid dimension unit",
    );
    expect(() => toCssValue("cubicBezier", [1.2, 0, 0.4, 1], "motion.bad")).toThrow(
      "invalid Bézier x coordinate",
    );
    expect(() =>
      toCssValue(
        "color",
        { colorSpace: "srgb", components: [1, 0, 0], hex: "#000000" },
        "color.bad",
      ),
    ).toThrow("do not match its hex fallback");
  });

  it("rejects CSS name collisions while preserving legal object-key paths", () => {
    expect(() =>
      collectTokens({
        foo: { $type: "number", bar: { $value: 1 } },
        fooBar: { $type: "number", $value: 2 },
      }),
    ).toThrow("normalize to the same CSS property");

    const source = {
      constructor: { $type: "number", inner: { $value: 1 } },
    };
    expect(renderTypescript(collectTokens(source))).toContain('constructor: {\n    inner: "1",');
  });

  it("defines intentional accessible foreground and surface pairs", () => {
    const pairs = [
      [brandTokens.color.ink, brandTokens.color.paper],
      [brandTokens.color.paper, brandTokens.color.ink],
      [brandTokens.color.white, brandTokens.color.indigo],
      [brandTokens.color.ink, brandTokens.color.coral],
      [brandTokens.color.ink, brandTokens.color.coralSoft],
      [brandTokens.color.nightText, brandTokens.color.night],
      [brandTokens.color.nightMuted, brandTokens.color.night],
    ] as const;

    for (const [foreground, background] of pairs) {
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("ships self-hosted variable fonts with their complete licenses", () => {
    const fontSizes = [
      "InstrumentSans[wdth,wght].woff2",
      "BricolageGrotesque-Latin[opsz,wdth,wght].woff2",
      "BricolageGrotesque-LatinExt[opsz,wdth,wght].woff2",
    ].map((font) => statSync(new URL(`../fonts/${font}`, import.meta.url)).size);

    for (const size of fontSizes) {
      expect(size).toBeGreaterThan(40_000);
      expect(size).toBeLessThan(150_000);
    }

    expect(readPackageFile("fonts/OFL.txt")).toContain("SIL OPEN FONT LICENSE Version 1.1");
    expect(readPackageFile("fonts/OFL-Bricolage-Grotesque.txt")).toContain(
      "SIL OPEN FONT LICENSE Version 1.1",
    );
    expect(readPackageFile("LICENSE")).toContain("MIT License");
    expect(readPackageFile("fonts.css")).toContain('font-family: "Bricolage Grotesque"');
    expect(readPackageFile("fonts.css")).toContain("font-weight: 200 800");
    expect(readPackageFile("fonts.css")).toContain("font-weight: 400 700");
    expect(readPackageFile("fonts.css")).toContain("font-stretch: 75% 100%");
  });

  it("ships safe, portable, and text-independent SVG assets", () => {
    const assets = [
      "drever-mark.svg",
      "drever-mark-dark.svg",
      "drever-mark-mono.svg",
      "drever-lockup.svg",
      "drever-lockup-dark.svg",
      "favicon.svg",
    ];

    for (const asset of assets) {
      const source = readPackageFile(`assets/${asset}`);
      expect(source).toContain("<svg");
      expect(source).toContain("viewBox=");
      expect(source).not.toMatch(/<(?:foreignObject|image|script|text)\b/iu);
      expect(source).not.toMatch(/(?:href|src)=["']https?:/iu);
      expect(Buffer.byteLength(source)).toBeLessThan(20_000);
    }

    expect(readPackageFile("assets/drever-mark.svg")).toContain("#FF704D");
    expect(readPackageFile("assets/drever-mark-mono.svg")).toContain("currentColor");
  });

  it("keeps the canonical Break Frame geometry synchronized across variants", () => {
    const canonical = pathData(readPackageFile("assets/drever-mark.svg"));

    expect(canonical).toHaveLength(2);
    expect(pathData(readPackageFile("assets/drever-mark-dark.svg"))).toEqual(canonical);
    expect(pathData(readPackageFile("assets/drever-mark-mono.svg"))).toEqual(canonical);
    expect(pathData(readPackageFile("assets/drever-lockup.svg")).slice(0, 2)).toEqual(canonical);
    expect(pathData(readPackageFile("assets/drever-lockup-dark.svg")).slice(0, 2)).toEqual(
      canonical,
    );

    const favicon = pathData(readPackageFile("assets/favicon.svg"));
    expect(favicon).toHaveLength(2);
    expect(favicon).not.toEqual(canonical);
  });
});

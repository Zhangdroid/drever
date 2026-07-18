import { readFileSync } from "node:fs";
import { createCompilePlan } from "@drever/compiler";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import editorialTheme, { editorialRecipes, theme } from "./index.ts";
import { Feature, Masthead } from "./layouts.tsx";

describe("@drever/theme-editorial", () => {
  it("resolves a complete theme contract and its public layout registry", () => {
    expect(editorialTheme).toBe(theme);

    const result = createCompilePlan({ theme });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.diagnostics).toEqual([]);
    expect(result.value.theme).toMatchObject({
      id: "@drever/theme-editorial",
      canvas: { width: 1600, height: 900 },
      motion: {
        id: "editorial",
        intents: ["focus", "replace", "compare", "stagger", "continuity"],
      },
    });
    expect(result.value.runtime.styles).toEqual([
      {
        owner: { kind: "theme", id: "@drever/theme-editorial" },
        style: { specifier: "@drever/theme-editorial/theme.css", layer: "theme" },
      },
    ]);
    expect(theme.layouts?.[0]).toMatchObject({
      name: "Masthead",
      variants: ["left", "center"],
      constraints: {
        toneComposesWithAlignment: true,
        tones: ["paper", "ink"],
      },
    });
    expect(
      result.value.runtime.layouts.map(({ module, name, slots }) => ({
        module,
        name,
        requiredSlots: slots.filter(({ required }) => required).map(({ name }) => name),
      })),
    ).toEqual([
      {
        name: "Masthead",
        module: { specifier: "@drever/theme-editorial/layouts", exportName: "Masthead" },
        requiredSlots: ["title"],
      },
      {
        name: "Feature",
        module: { specifier: "@drever/theme-editorial/layouts", exportName: "Feature" },
        requiredSlots: ["heading", "body", "visual"],
      },
    ]);
  });

  it("publishes bounded, unique recipes for AI composition", () => {
    expect(new Set(editorialRecipes.map(({ id }) => id)).size).toBe(editorialRecipes.length);
    expect(editorialRecipes.map(({ layout }) => layout)).toEqual([
      "Masthead",
      "Feature",
      "Markdown",
    ]);
    for (const recipe of editorialRecipes) {
      expect(recipe.prompt.trim().length).toBeGreaterThan(20);
      expect(recipe.constraints.length).toBeGreaterThanOrEqual(3);
      expect(recipe.constraints.every((constraint) => constraint.trim().length > 8)).toBe(true);
    }
  });

  it("renders semantic regions without hiding author-provided HTML attributes", () => {
    const masthead = renderToStaticMarkup(
      <Masthead
        align="center"
        aria-label="Opening"
        deck="A testable medium."
        kicker="Field notes"
        meta="Drever · 2026"
        title="Presentations become software."
        tone="ink"
      />,
    );
    const feature = renderToStaticMarkup(
      <Feature
        balance="visual-led"
        body={<p>Motion preserves context.</p>}
        caption="Transition model"
        heading="Change stays legible."
        visual={<svg aria-label="Diagram" />}
      />,
    );

    expect(masthead).toContain("<header");
    expect(masthead).toContain('aria-label="Opening"');
    expect(masthead).toContain('data-drever-layout="masthead"');
    expect(masthead).toContain('data-align="center"');
    expect(masthead).toContain('data-tone="ink"');
    expect(feature).toContain("<article");
    expect(feature).toContain('data-drever-layout="feature"');
    expect(feature).toContain("<figure");
    expect(feature).toContain("<figcaption>Transition model</figcaption>");
  });

  it("keeps CSS tokens aligned with metadata and covers core content states", () => {
    const css = readFileSync(new URL("../theme.css", import.meta.url), "utf8");
    const colorTokens = theme.tokens.color;

    expect(css).toContain(`--drever-editorial-paper: ${colorTokens.canvas}`);
    expect(css).toContain(`--drever-editorial-ink: ${colorTokens.ink}`);
    expect(css).toContain(`--drever-editorial-accent: ${colorTokens.accent}`);
    for (const selector of [
      "h1",
      "h2",
      ":where(p, li)",
      ":where(ul, ol)",
      "blockquote",
      ":not(pre) > code",
      "pre",
      "a",
      "table",
      'data-step-state="active"',
      'data-drever-render-mode^="speaker"',
    ]) {
      expect(css).toContain(selector);
    }
    expect(css).toMatch(/\.drever-editorial-feature__visual \{[^}]*margin: 0;/su);

    const profileKeys = new Set(css.match(/--drever-recipe-[\w-]+(?=:)/gu));

    expect(profileKeys.size).toBe(18);
    expect(css).toContain("grid-area: 1 / 1;");
    expect(css.match(/:not\(\[data-drever-render-mode="document"\]\)/gu)).toHaveLength(3);
    expect(css).toContain("--drever-recipe-stagger-gap: 48ms;");
    expect(css).toContain("--drever-recipe-continuity-new-from-opacity: 0.5;");
    expect(css).toContain("[data-drever-reduced-motion]");
    expect(theme.motion?.guidance?.every((entry) => entry.trim().length > 20)).toBe(true);
  });
});

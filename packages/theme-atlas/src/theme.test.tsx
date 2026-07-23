import { readFileSync } from "node:fs";
import { createCompilePlan } from "@drever/compiler";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import atlasTheme, { atlasRecipes, theme } from "./index.ts";
import { Route, Survey } from "./layouts.tsx";

describe("@drever/theme-atlas", () => {
  it("resolves a complete theme contract and public layout registry", () => {
    expect(atlasTheme).toBe(theme);

    const result = createCompilePlan({ theme });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.diagnostics).toEqual([]);
    expect(result.value.theme).toMatchObject({
      id: "@drever/theme-atlas",
      canvas: { width: 1600, height: 900 },
      motion: {
        id: "atlas",
        intents: ["focus", "replace", "compare", "stagger", "continuity"],
      },
    });
    expect(result.value.runtime.styles).toEqual([
      {
        owner: { kind: "theme", id: "@drever/theme-atlas" },
        style: { specifier: "@drever/theme-atlas/theme.css", layer: "theme" },
      },
    ]);
    expect(
      result.value.runtime.layouts.map(({ module, name, slots }) => ({
        module,
        name,
        requiredSlots: slots.filter(({ required }) => required).map(({ name }) => name),
      })),
    ).toEqual([
      {
        name: "Route",
        module: { specifier: "@drever/theme-atlas/layouts", exportName: "Route" },
        requiredSlots: ["title", "origin", "waypoints", "destination"],
      },
      {
        name: "Survey",
        module: { specifier: "@drever/theme-atlas/layouts", exportName: "Survey" },
        requiredSlots: ["title", "finding", "visual", "legend"],
      },
    ]);
  });

  it("publishes bounded, unique recipes for AI composition", () => {
    expect(new Set(atlasRecipes.map(({ id }) => id)).size).toBe(atlasRecipes.length);
    expect(atlasRecipes.map(({ layout }) => layout)).toEqual(["Route", "Survey", "Markdown"]);
    for (const recipe of atlasRecipes) {
      expect(recipe.prompt.trim().length).toBeGreaterThan(30);
      expect(recipe.constraints.length).toBeGreaterThanOrEqual(3);
      expect(recipe.constraints.every((constraint) => constraint.trim().length > 12)).toBe(true);
    }
  });

  it("renders an ordered route and a labelled survey without swallowing HTML attributes", () => {
    const route = renderToStaticMarkup(
      <Route
        aria-label="Migration route"
        caption="Pilot to general availability"
        data-study="migration"
        destination="Public infrastructure"
        label="Migration / 2026"
        origin="Prototype"
        title="A careful route to scale."
        tone="terrain"
        waypoints={["Partner trials", "Regional validation"]}
      />,
    );
    const survey = renderToStaticMarkup(
      <Survey
        balance="visual-led"
        caption="Annual exposure model"
        finding={<p>Risk moved inland.</p>}
        label="Coastal survey"
        legend={
          <ul>
            <li>Annual threshold</li>
          </ul>
        }
        title="Three districts crossed the threshold."
        visual={<svg aria-label="Risk map" />}
      />,
    );

    expect(route).toContain("<section");
    expect(route).toContain('aria-label="Migration route"');
    expect(route).toContain('data-study="migration"');
    expect(route).toContain('data-drever-layout="route"');
    expect(route).toContain('data-tone="terrain"');
    expect(route).toContain("<ol");
    expect(route.match(/<li/g)).toHaveLength(4);
    expect(route).toContain('data-stop="origin"');
    expect(route).toContain('data-stop="destination"');

    expect(survey).toContain("<article");
    expect(survey).toContain('data-drever-layout="survey"');
    expect(survey).toContain('data-balance="visual-led"');
    expect(survey).toContain("<figure");
    expect(survey).toContain("<figcaption>Annual exposure model</figcaption>");
    expect(survey).toContain("<aside");
    const surveyTitleId = survey.match(/aria-labelledby="([^"]+)"/u)?.[1];
    expect(surveyTitleId).toBeDefined();
    expect(survey).toContain(`id="${surveyTitleId}"`);
  });

  it("keeps CSS metadata aligned and covers semantic, motion, and layout states", () => {
    const css = readFileSync(new URL("../theme.css", import.meta.url), "utf8");
    const colorTokens = theme.tokens.color;

    expect(css).toContain(`--drever-atlas-canvas: ${colorTokens.canvas}`);
    expect(css).toContain(`--drever-atlas-ink: ${colorTokens.ink}`);
    expect(css).toContain(`--drever-atlas-ocean: ${colorTokens.accent}`);
    expect(css).toContain("--drever-theme-accent: var(--drever-atlas-ocean);");
    for (const alias of [
      "ink",
      "muted",
      "accent",
      "accent-strong",
      "accent-soft",
      "surface",
      "border",
      "code-canvas",
      "code-ink",
      "radius",
    ]) {
      expect(css).toContain(`--drever-theme-${alias}:`);
    }
    expect(css).toMatch(/\[data-drever-stage-layer="background"\] \{[^}]*background:/su);
    expect(css).toMatch(/\[data-drever-slide\] \{[^}]*background: transparent;/su);
    expect(css).toMatch(
      /\.drever-canvas:has\(\s*\[data-drever-slide\]\[data-slide-state="active"\]\s+\.drever-atlas-route\[data-tone="terrain"\]\s*\)/su,
    );
    expect(css).not.toContain('.drever-canvas:has(.drever-atlas-route[data-tone="terrain"])');
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
      "thead th:first-child",
      'data-step-state="active"',
      'data-drever-render-mode^="speaker"',
      ".drever-atlas-route__track",
      ".drever-atlas-survey__visual",
    ]) {
      expect(css).toContain(selector);
    }

    const profileKeys = [...new Set(css.match(/--drever-recipe-[\w-]+(?=:)/gu))].sort();
    expect(profileKeys).toEqual([
      "--drever-recipe-enter-duration",
      "--drever-recipe-replace-block-from-translate",
      "--drever-recipe-replace-from-translate",
      "--drever-recipe-replace-inline-from-translate",
      "--drever-recipe-stagger-block-from-translate",
      "--drever-recipe-stagger-duration",
      "--drever-recipe-stagger-from-translate",
      "--drever-recipe-stagger-gap",
      "--drever-recipe-stagger-inline-from-translate",
      "--drever-recipe-step-block-from-translate",
      "--drever-recipe-step-from-translate",
      "--drever-recipe-step-inline-from-translate",
    ]);
    expect(css).toContain("grid-area: 1 / 1;");
    expect(css).toContain("@keyframes drever-atlas-step-inline-enter");
    expect(css).toContain(`--drever-motion-duration: ${theme.tokens.motion.duration}ms;`);
    expect(css).toContain('data-step-state="active"]::before');
    expect(css).toContain(
      '[data-drever-deck]:not([data-drever-render-mode="document"])\n  [data-drever-motion-group=""]:is(',
    );
    expect(css).not.toMatch(/data-step-state="complete"\]\s*\{\s*opacity: 0\./u);
    expect(css).toContain("[data-drever-slide] ::selection");
    expect(css).not.toMatch(/^::selection/mu);
    expect(css).toContain("[data-drever-reduced-motion]");
    expect(css).toContain(":root:has(.drever-viewer),");
    expect(css).not.toContain("--drever-recipe-step-from-transform");
    expect(theme.motion?.guidance?.every((entry) => entry.trim().length > 20)).toBe(true);
  });
});

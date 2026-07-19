import { readFileSync } from "node:fs";
import { createCompilePlan } from "@drever/compiler";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import studioTheme, { studioRecipes, theme } from "./index.ts";
import { Statement, Workbench } from "./layouts.tsx";

describe("@drever/theme-studio", () => {
  it("resolves a complete theme contract and its public layout registry", () => {
    expect(studioTheme).toBe(theme);

    const result = createCompilePlan({ theme });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.diagnostics).toEqual([]);
    expect(result.value.theme).toMatchObject({
      id: "@drever/theme-studio",
      canvas: { width: 1600, height: 900 },
      motion: {
        id: "studio",
        intents: ["focus", "replace", "compare", "stagger", "continuity"],
      },
    });
    expect(result.value.runtime.styles).toEqual([
      {
        owner: { kind: "theme", id: "@drever/theme-studio" },
        style: { specifier: "@drever/theme-studio/theme.css", layer: "theme" },
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
        name: "Statement",
        module: { specifier: "@drever/theme-studio/layouts", exportName: "Statement" },
        requiredSlots: ["title"],
      },
      {
        name: "Workbench",
        module: { specifier: "@drever/theme-studio/layouts", exportName: "Workbench" },
        requiredSlots: ["main", "rail"],
      },
    ]);
  });

  it("publishes bounded, unique recipes for AI composition", () => {
    expect(new Set(studioRecipes.map(({ id }) => id)).size).toBe(studioRecipes.length);
    expect(studioRecipes.map(({ layout }) => layout)).toEqual([
      "Statement",
      "Workbench",
      "Markdown",
    ]);
    for (const recipe of studioRecipes) {
      expect(recipe.prompt.trim().length).toBeGreaterThan(20);
      expect(recipe.constraints.length).toBeGreaterThanOrEqual(3);
      expect(recipe.constraints.every((constraint) => constraint.trim().length > 8)).toBe(true);
    }
  });

  it("renders semantic artifact and thesis regions with author attributes", () => {
    const statement = renderToStaticMarkup(
      <Statement
        aria-label="Architecture thesis"
        eyebrow="Architecture"
        index="02"
        supporting="Runtime receives a frozen plan."
        title="The compiler owns certainty."
        tone="signal"
      />,
    );
    const workbench = renderToStaticMarkup(
      <Workbench
        label="State model"
        main={<svg aria-label="State diagram" />}
        rail={<p>Every URL identifies one exact state.</p>}
        ratio="equal"
      />,
    );

    expect(statement).toContain("<header");
    expect(statement).toContain('aria-label="Architecture thesis"');
    expect(statement).toContain('data-drever-layout="statement"');
    expect(statement).toContain('data-tone="signal"');
    expect(workbench).toContain("<section");
    expect(workbench).toContain('data-drever-layout="workbench"');
    expect(workbench).toContain('data-ratio="equal"');
    expect(workbench).toContain("<aside");
    const workbenchLabelId = workbench.match(/aria-labelledby="([^"]+)"/u)?.[1];
    expect(workbenchLabelId).toBeDefined();
    expect(workbench).toContain(`id="${workbenchLabelId}"`);
  });

  it("keeps CSS tokens aligned with metadata and covers code, data, and runtime states", () => {
    const css = readFileSync(new URL("../theme.css", import.meta.url), "utf8");
    const colorTokens = theme.tokens.color;

    expect(css).toContain(`--drever-studio-canvas: ${colorTokens.canvas}`);
    expect(css).toContain(`--drever-studio-ink: ${colorTokens.ink}`);
    expect(css).toContain(`--drever-studio-signal: ${colorTokens.signal}`);
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
    ]) {
      expect(css).toContain(selector);
    }

    const profileKeys = [...new Set(css.match(/--drever-recipe-[\w-]+(?=:)/gu))].sort();

    expect(profileKeys).toEqual([
      "--drever-recipe-enter-duration",
      "--drever-recipe-replace-from-translate",
      "--drever-recipe-stagger-duration",
      "--drever-recipe-stagger-from-translate",
      "--drever-recipe-stagger-gap",
      "--drever-recipe-step-from-translate",
    ]);
    expect(css).toContain("grid-area: 1 / 1;");
    expect(css.match(/:not\(\[data-drever-render-mode="document"\]\)/gu)).toHaveLength(3);
    expect(css).toContain(":root:has(.drever-viewer),");
    expect(css).toContain("--drever-motion-slide-offset: 2.8%;");
    expect(css).toContain("--drever-recipe-stagger-gap: 32ms;");
    expect(css).not.toContain("--drever-recipe-step-from-transform");
    expect(css).toContain("[data-drever-reduced-motion]");
    expect(theme.motion?.guidance?.every((entry) => entry.trim().length > 20)).toBe(true);
  });
});

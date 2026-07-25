import { readFileSync } from "node:fs";
import { createCompilePlan } from "@drever/compiler";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import studioTheme, { studioRecipes, theme } from "./index.ts";
import { Statement, Workbench } from "./layouts.tsx";

describe("@drever/designs/studio", () => {
  it("resolves a complete theme contract and its public layout registry", () => {
    expect(studioTheme).toBe(theme);

    const result = createCompilePlan({ theme });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.diagnostics).toEqual([]);
    expect(result.value.theme).toMatchObject({
      id: "@drever/designs/studio",
      canvas: { width: 1600, height: 900 },
      motion: {
        id: "studio",
        intents: ["focus", "replace", "compare", "stagger", "continuity"],
      },
    });
    expect(result.value.runtime.styles).toEqual([
      {
        owner: { kind: "theme", id: "@drever/designs/studio" },
        style: { specifier: "@drever/designs/studio/theme.css", layer: "theme" },
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
        module: { specifier: "@drever/designs/studio/layouts", exportName: "Statement" },
        requiredSlots: ["title"],
      },
      {
        name: "Workbench",
        module: { specifier: "@drever/designs/studio/layouts", exportName: "Workbench" },
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
    const css = readFileSync(new URL("../../themes/studio/theme.css", import.meta.url), "utf8");
    const colorTokens = theme.tokens.color;

    expect(css).toContain(`--drever-studio-canvas: ${colorTokens.canvas}`);
    expect(css).toContain(`--drever-studio-ink: ${colorTokens.ink}`);
    expect(css).toContain(`--drever-studio-signal: ${colorTokens.signal}`);
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
    expect(css).toMatch(
      /\[data-drever-deck\]:not\(\[data-drever-render-mode="document"\]\)\s+\[data-drever-motion-group=""\]\[data-motion-intent="replace"\]\s*\{/u,
    );
    expect(css).toContain(":root:has(.drever-viewer),");
    expect(css).toContain("--drever-motion-slide-offset: 2.8%;");
    expect(css).toContain("--drever-motion-slide-enter-animation: drever-studio-slide-enter;");
    expect(css).toContain("--drever-motion-slide-exit-animation: drever-studio-slide-exit;");
    expect(css).toContain("--drever-recipe-stagger-gap: 32ms;");
    expect(css).toContain("--drever-recipe-step-block-from-translate: 0 10px;");
    expect(css).toContain("--drever-recipe-step-inline-from-translate: 10px 0;");
    expect(css).toContain(`--drever-motion-duration: ${theme.tokens.motion.duration}ms;`);
    expect(css).toContain('data-step-state="active"]::before');
    expect(css).toMatch(
      /data-step-state="active"\]::before \{[^}]*position: absolute;[^}]*content: "";/su,
    );
    expect(css).not.toMatch(/data-step-state="complete"\]\s*\{\s*opacity: 0\./u);
    expect(css).toContain("[data-drever-slide] ::selection");
    expect(css).not.toMatch(/^::selection/mu);
    expect(css).toContain("@keyframes drever-studio-stagger-enter");
    expect(css).toContain("@keyframes drever-studio-slide-enter");
    expect(css).toContain("@keyframes drever-studio-slide-exit");
    expect(css).toContain("scale: 0.985;");
    expect(css).not.toContain("--drever-recipe-step-from-transform");
    expect(css).toContain("[data-drever-reduced-motion]");
    expect(theme.motion?.guidance?.every((entry) => entry.trim().length > 20)).toBe(true);
  });
});

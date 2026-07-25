import { readFileSync } from "node:fs";
import { createCompilePlan } from "@drever/compiler";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import constructTheme, { constructRecipes, theme } from "./index.ts";
import { Assembly, Prompt } from "./layouts.tsx";

describe("@drever/designs/construct", () => {
  it("resolves a complete theme contract and public layout registry", () => {
    expect(constructTheme).toBe(theme);

    const result = createCompilePlan({ theme });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.diagnostics).toEqual([]);
    expect(result.value.theme).toMatchObject({
      id: "@drever/designs/construct",
      canvas: { width: 1600, height: 900 },
      motion: {
        id: "construct",
        intents: ["focus", "replace", "compare", "stagger", "continuity"],
      },
    });
    expect(result.value.runtime.styles).toEqual([
      {
        owner: { kind: "theme", id: "@drever/designs/construct" },
        style: { specifier: "@drever/designs/construct/theme.css", layer: "theme" },
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
        name: "Prompt",
        module: { specifier: "@drever/designs/construct/layouts", exportName: "Prompt" },
        requiredSlots: ["question"],
      },
      {
        name: "Assembly",
        module: { specifier: "@drever/designs/construct/layouts", exportName: "Assembly" },
        requiredSlots: ["title", "parts", "result"],
      },
    ]);
  });

  it("publishes bounded, unique recipes for AI composition", () => {
    expect(new Set(constructRecipes.map(({ id }) => id)).size).toBe(constructRecipes.length);
    expect(constructRecipes.map(({ layout }) => layout)).toEqual([
      "Prompt",
      "Assembly",
      "Markdown",
    ]);
    for (const recipe of constructRecipes) {
      expect(recipe.prompt.trim().length).toBeGreaterThan(30);
      expect(recipe.constraints.length).toBeGreaterThanOrEqual(3);
      expect(recipe.constraints.every((constraint) => constraint.trim().length > 12)).toBe(true);
    }
  });

  it("renders a labelled prompt and an ordered assembly with author attributes", () => {
    const prompt = renderToStaticMarkup(
      <Prompt
        align="center"
        context={<p>Change the interface without changing its contract.</p>}
        cue="Write one invariant."
        data-activity="invariant"
        eyebrow="Workshop / 02"
        question="What must remain true?"
        tone="yellow"
      />,
    );
    const assembly = renderToStaticMarkup(
      <Assembly
        aria-label="Delivery guarantees"
        caption="The guarantees form one delivery contract."
        label="Delivery contract"
        parts={["Stable URLs", "Deterministic export", "Inspectable state"]}
        result={<strong>Ship exactly what was tested.</strong>}
        title="Three guarantees make one dependable release."
        tone="green"
      />,
    );

    expect(prompt).toContain("<section");
    expect(prompt).toContain('data-activity="invariant"');
    expect(prompt).toContain('data-drever-layout="prompt"');
    expect(prompt).toContain('data-align="center"');
    expect(prompt).toContain('data-tone="yellow"');
    expect(prompt).toContain('aria-labelledby="');

    expect(assembly).toContain("<section");
    expect(assembly).toContain('aria-label="Delivery guarantees"');
    expect(assembly).toContain('data-drever-layout="assembly"');
    expect(assembly).toContain('data-part-count="3"');
    expect(assembly).toContain('data-tone="green"');
    expect(assembly).toContain("<ol");
    expect(assembly.match(/<li/g)).toHaveLength(3);
  });

  it("keeps CSS metadata aligned and covers semantic, tone, motion, and layout states", () => {
    const css = readFileSync(new URL("../../themes/construct/theme.css", import.meta.url), "utf8");
    const colorTokens = theme.tokens.color;

    expect(css).toContain('@import "@drever/brand/fonts.css";');
    expect(css).toContain(`--drever-construct-canvas: ${colorTokens.canvas}`);
    expect(css).toContain(`--drever-construct-ink: ${colorTokens.ink}`);
    expect(css).toContain(`--drever-construct-blue: ${colorTokens.accent}`);
    expect(css).toContain(`--drever-construct-coral-strong: ${colorTokens.coralStrong}`);
    expect(css).toContain(`--drever-construct-green-strong: ${colorTokens.greenStrong}`);
    expect(css).toContain("--drever-theme-accent: var(--drever-construct-blue);");
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
      /\.drever-canvas:has\(\s*\[data-drever-slide\]\[data-slide-state="active"\]\s+\.drever-construct-prompt\[data-tone="yellow"\]\s*\)/su,
    );
    expect(css).not.toContain('.drever-canvas:has(.drever-construct-prompt[data-tone="yellow"])');
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
      'data-tone="coral"',
      'data-tone="yellow"',
      ".drever-construct-prompt__cue",
      ".drever-construct-assembly__parts",
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
    expect(css).toContain("@keyframes drever-construct-stagger-enter");
    expect(css).toContain("--drever-motion-slide-enter-animation: drever-construct-slide-enter;");
    expect(css).toContain("--drever-motion-slide-exit-animation: drever-construct-slide-exit;");
    expect(css).toContain("--drever-motion-slide-offset: 0%;");
    expect(css).toContain(`--drever-motion-duration: ${theme.tokens.motion.duration}ms;`);
    expect(css).toContain('data-step-state="active"]::before');
    expect(css).toContain(
      '[data-drever-deck]:not([data-drever-render-mode="document"])\n  [data-drever-motion-group=""]:is(',
    );
    expect(css).not.toMatch(/data-step-state="complete"\]\s*\{\s*opacity: 0\./u);
    expect(css).toContain(
      "[data-drever-slide] .drever-construct-assembly__result :where(p, li, strong, em, a)",
    );
    expect(css).toContain("[data-drever-slide] ::selection");
    expect(css).not.toMatch(/^::selection/mu);
    expect(css).toContain("[data-drever-reduced-motion]");
    expect(css).toContain(":root:has(.drever-viewer),");
    expect(css).not.toContain("--drever-recipe-step-from-transform");
    expect(theme.motion?.guidance?.every((entry) => entry.trim().length > 20)).toBe(true);
  });
});

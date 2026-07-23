import { readFileSync } from "node:fs";
import { createCompilePlan } from "@drever/compiler";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import cinemaTheme, { cinemaRecipes, theme } from "./index.ts";
import { Frame, TitleCard } from "./layouts.tsx";

describe("@drever/theme-cinema", () => {
  it("resolves a complete theme contract and its public layout registry", () => {
    expect(cinemaTheme).toBe(theme);

    const result = createCompilePlan({ theme });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.diagnostics).toEqual([]);
    expect(result.value.theme).toMatchObject({
      id: "@drever/theme-cinema",
      canvas: { width: 1600, height: 900 },
      motion: {
        id: "cinema",
        intents: ["focus", "replace", "compare", "stagger", "continuity"],
      },
    });
    expect(result.value.runtime.styles).toEqual([
      {
        owner: { kind: "theme", id: "@drever/theme-cinema" },
        style: { specifier: "@drever/theme-cinema/theme.css", layer: "theme" },
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
        name: "TitleCard",
        module: { specifier: "@drever/theme-cinema/layouts", exportName: "TitleCard" },
        requiredSlots: ["title"],
      },
      {
        name: "Frame",
        module: { specifier: "@drever/theme-cinema/layouts", exportName: "Frame" },
        requiredSlots: ["media"],
      },
    ]);
  });

  it("publishes bounded, unique recipes for AI composition", () => {
    expect(new Set(cinemaRecipes.map(({ id }) => id)).size).toBe(cinemaRecipes.length);
    expect(cinemaRecipes.map(({ layout }) => layout)).toEqual(["TitleCard", "Frame", "Markdown"]);
    for (const recipe of cinemaRecipes) {
      expect(recipe.prompt.trim().length).toBeGreaterThan(20);
      expect(recipe.constraints.length).toBeGreaterThanOrEqual(3);
      expect(recipe.constraints.every((constraint) => constraint.trim().length > 8)).toBe(true);
    }
  });

  it("renders semantic title and media regions while preserving author attributes", () => {
    const titleCard = renderToStaticMarkup(
      <TitleCard
        aria-label="Opening title"
        className="authored-title"
        credit="Drever · 2026"
        eyebrow="Act I"
        logline="Structure survives the stage."
        title="Every state deserves a URL."
        tone="paper"
      />,
    );
    const frame = renderToStaticMarkup(
      <Frame
        caption="One exact state."
        credit="Runtime model / 04"
        heading="The route is the state."
        media={<img alt="Route state diagram" src="/route-state.svg" />}
        ratio="academy"
      />,
    );

    expect(titleCard).toContain("<header");
    expect(titleCard).toContain('aria-label="Opening title"');
    expect(titleCard).toContain("drever-cinema-title-card authored-title");
    expect(titleCard).toContain('data-drever-layout="title-card"');
    expect(titleCard).toContain('data-tone="paper"');
    expect(frame).toContain("<figure");
    expect(frame).toContain("<figcaption");
    expect(frame).toContain('data-drever-layout="frame"');
    expect(frame).toContain('data-ratio="academy"');
    expect(frame).toContain('alt="Route state diagram"');
    const frameHeadingId = frame.match(/aria-labelledby="([^"]+)"/u)?.[1];
    expect(frameHeadingId).toBeDefined();
    expect(frame).toContain(`id="${frameHeadingId}"`);
  });

  it("keeps CSS tokens aligned with metadata and media motion geometry stable", () => {
    const css = readFileSync(new URL("../theme.css", import.meta.url), "utf8");
    const colorTokens = theme.tokens.color;

    expect(css).toContain(`--drever-cinema-canvas: ${colorTokens.canvas}`);
    expect(css).toContain(`--drever-cinema-ink: ${colorTokens.ink}`);
    expect(css).toContain(`--drever-cinema-cue: ${colorTokens.accent}`);
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
      ".drever-cinema-title-card",
      ".drever-cinema-frame__media",
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
    expect(css).toContain("--drever-motion-slide-offset: 1.2%;");
    expect(css).toContain("--drever-recipe-stagger-gap: 40ms;");
    expect(css).toContain("--drever-recipe-step-block-from-translate: 0 6px;");
    expect(css).toContain("--drever-recipe-step-inline-from-translate: 8px 0;");
    expect(css).toContain(`--drever-motion-duration: ${theme.tokens.motion.duration}ms;`);
    expect(css).toContain('data-step-state="active"]::before');
    expect(css).toContain(
      '[data-drever-deck]:not([data-drever-render-mode="document"])\n  [data-drever-motion-group=""]:is(',
    );
    expect(css).not.toMatch(/data-step-state="complete"\]\s*\{\s*opacity: 0\./u);
    expect(css).toContain("[data-drever-slide] :where(:lang(zh), :lang(ja), :lang(ko))");
    expect(css).toContain("[data-drever-slide] ::selection");
    expect(css).not.toMatch(/^::selection/mu);
    expect(css).toContain("@keyframes drever-cinema-stagger-enter");
    expect(css).toContain("object-fit: contain;");
    expect(css).toContain("aspect-ratio: 16 / 9;");
    expect(css).toContain("aspect-ratio: 4 / 3;");
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
    expect(css).not.toContain("clip-path");
    expect(css).not.toContain("scale:");
    expect(css).not.toContain("--drever-recipe-step-from-transform");
    expect(css).toContain("[data-drever-reduced-motion]");
    expect(theme.motion?.guidance).toContain(
      "Never scale, pan, or re-crop still media merely to make a slide feel cinematic.",
    );
  });
});

import { readFileSync } from "node:fs";
import { createCompilePlan } from "@drever/compiler";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import fieldnoteTheme, { fieldnoteRecipes, theme } from "./index.ts";
import { Annotated, Notebook } from "./layouts.tsx";

describe("@drever/designs/fieldnote", () => {
  it("resolves the complete theme, layouts, and motion contract", () => {
    expect(fieldnoteTheme).toBe(theme);

    const result = createCompilePlan({ theme });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.diagnostics).toEqual([]);
    expect(result.value.theme).toMatchObject({
      id: "@drever/designs/fieldnote",
      canvas: { width: 1600, height: 900 },
      motion: {
        id: "fieldnote",
        intents: ["focus", "replace", "compare", "stagger", "continuity"],
      },
    });
    expect(result.value.runtime.styles).toEqual([
      {
        owner: { kind: "theme", id: "@drever/designs/fieldnote" },
        style: { specifier: "@drever/designs/fieldnote/theme.css", layer: "theme" },
      },
    ]);
    expect(
      result.value.runtime.layouts.map(({ name, slots }) => ({
        name,
        required: slots.filter(({ required }) => required).map(({ name }) => name),
      })),
    ).toEqual([
      { name: "Notebook", required: ["title"] },
      { name: "Annotated", required: ["heading", "evidence", "annotations"] },
    ]);
  });

  it("publishes bounded composition recipes instead of generic style prompts", () => {
    expect(fieldnoteRecipes.map(({ id }) => id)).toEqual([
      "opening-notebook",
      "annotated-evidence",
      "guided-sequence",
    ]);
    expect(new Set(fieldnoteRecipes.map(({ layout }) => layout))).toEqual(
      new Set(["Notebook", "Annotated", "Markdown"]),
    );
    for (const recipe of fieldnoteRecipes) {
      expect(recipe.prompt.length).toBeGreaterThan(30);
      expect(recipe.constraints).toHaveLength(3);
    }
  });

  it("renders semantic opening and evidence regions with author attributes", () => {
    const notebook = renderToStaticMarkup(
      <Notebook
        aria-label="Workshop opening"
        eyebrow="Workshop"
        footer="Field notes"
        note="A useful story starts with the change."
        title="Start with what changed."
        tone="blue"
      />,
    );
    const annotated = renderToStaticMarkup(
      <Annotated
        annotations={
          <ol>
            <li>The decision loses an owner.</li>
          </ol>
        }
        annotationsLabel="Research recommendations"
        balance="balanced"
        caption="Workshop synthesis"
        evidence={<svg aria-label="Process sketch" />}
        heading="The gap appears at handoff."
      />,
    );

    expect(notebook).toContain("<header");
    expect(notebook).toContain('aria-label="Workshop opening"');
    expect(notebook).toContain('data-drever-layout="notebook"');
    expect(notebook).toContain('data-tone="blue"');
    expect(annotated).toContain("<article");
    expect(annotated).toContain('data-drever-layout="annotated"');
    expect(annotated).toContain('data-balance="balanced"');
    expect(annotated).toContain("<figure");
    expect(annotated).toContain(
      '<aside class="drever-fieldnote-annotated__notes" aria-label="Research recommendations">',
    );
  });

  it("keeps metadata, font delivery, semantic aliases, and stable motion aligned", () => {
    const css = readFileSync(new URL("../../themes/fieldnote/theme.css", import.meta.url), "utf8");

    expect(css).toContain("@font-face");
    expect(css).toContain('url("./fonts/Caveat[wght].ttf")');
    expect(css).toMatch(/\[data-drever-stage-layer="background"\] \{[^}]*background:/su);
    expect(css).toMatch(/\[data-drever-slide\] \{[^}]*background: transparent;/su);
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
    for (const selector of [
      "h1",
      ":where(p, li)",
      ":where(ul, ol)",
      "blockquote",
      ":not(pre) > code",
      "pre",
      "img",
      "table",
      'data-step-state="active"',
      'data-drever-render-mode^="speaker"',
      "[data-drever-reduced-motion]",
    ]) {
      expect(css).toContain(selector);
    }
    expect(css).toContain("grid-area: 1 / 1;");
    expect(css).not.toContain("clip-path");
    expect(theme.tokens.motion).toEqual({
      duration: 420,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    });
    expect(css).toContain("--drever-motion-duration: 420ms;");
    expect(css).toContain('data-step-state="active"]::before');
    expect(css).toContain(
      '[data-drever-deck]:not([data-drever-render-mode="document"])\n  [data-drever-motion-group=""]:is(',
    );
    expect(css).not.toMatch(/data-step-state="complete"\]\s*\{\s*opacity: 0\./u);
    expect(css).toContain("[data-drever-slide] :where(:lang(zh), :lang(ja), :lang(ko))");
    expect(css).toContain("[data-drever-slide] ::selection");
    expect(css).not.toMatch(/^::selection/mu);
  });
});

import { readFileSync } from "node:fs";
import { createCompilePlan } from "@drever/compiler";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import defaultTheme, { theme } from "./index.ts";
import { Cover, TwoColumn } from "./layouts.tsx";

describe("@drever/theme-default", () => {
  it("is a valid public theme contribution with resolvable package subpaths", () => {
    expect(defaultTheme).toBe(theme);

    const result = createCompilePlan({ theme });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.diagnostics).toEqual([]);
    expect(result.value.theme).toMatchObject({
      id: "@drever/theme-default",
      canvas: { width: 1600, height: 900 },
      motion: {
        id: "default",
        intents: ["focus", "replace", "compare", "stagger", "continuity"],
      },
    });
    expect(result.value.runtime.styles).toEqual([
      {
        owner: { kind: "theme", id: "@drever/theme-default" },
        style: { specifier: "@drever/theme-default/theme.css", layer: "theme" },
      },
    ]);
    expect(result.value.runtime.layouts.map(({ module, name }) => ({ module, name }))).toEqual([
      {
        name: "Cover",
        module: { specifier: "@drever/theme-default/layouts", exportName: "Cover" },
      },
      {
        name: "TwoColumn",
        module: { specifier: "@drever/theme-default/layouts", exportName: "TwoColumn" },
      },
    ]);
  });

  it("renders the documented layout regions as semantic public markup", () => {
    const cover = renderToStaticMarkup(
      <Cover
        eyebrow="Chapter one"
        footer="Drever"
        supporting="A short supporting idea."
        title="Presentations can be software."
        tone="accent"
      />,
    );
    const columns = renderToStaticMarkup(
      <TwoColumn primary={<h2>Problem</h2>} ratio="wide-primary" secondary={<p>Answer</p>} />,
    );

    expect(cover).toContain('<header class="drever-layout-cover" data-drever-layout="cover"');
    expect(cover).toContain('data-tone="accent"');
    expect(cover).toContain("<h1");
    expect(columns).toContain('data-drever-layout="two-column"');
    expect(columns).toContain('data-ratio="wide-primary"');
    expect(columns.match(/data-column=/gu)).toHaveLength(2);
  });

  it("implements every declared semantic motion recipe with bounded choreography", () => {
    const css = readFileSync(new URL("../theme.css", import.meta.url), "utf8");

    expect(css).toMatch(/\[data-drever-stage-layer="background"\] \{[^}]*background:/su);
    expect(css).toMatch(/\[data-drever-slide\] \{[^}]*background: transparent;/su);

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
    expect(css.match(/:not\(\[data-drever-render-mode="document"\]\)/gu)).toHaveLength(3);
    expect(css).toContain(":root:has(.drever-viewer),");
    expect(css).toContain("--drever-motion-slide-offset: 2.4%;");
    expect(css).toContain("--drever-recipe-stagger-gap: 40ms;");
    expect(css).toContain("--drever-recipe-step-block-from-translate: 0 12px;");
    expect(css).toContain("--drever-recipe-step-inline-from-translate: 12px 0;");
    expect(css).not.toContain("--drever-recipe-step-from-transform");
    expect(css).toContain("[data-drever-reduced-motion]");
    expect(theme.motion?.guidance?.every((entry) => entry.trim().length > 20)).toBe(true);
  });
});

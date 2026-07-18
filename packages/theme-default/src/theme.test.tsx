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

    const profileKeys = new Set(css.match(/--drever-recipe-[\w-]+(?=:)/gu));

    expect(profileKeys.size).toBe(18);
    expect(css).toContain("grid-area: 1 / 1;");
    expect(css.match(/:not\(\[data-drever-render-mode="document"\]\)/gu)).toHaveLength(3);
    expect(css).toContain("--drever-recipe-stagger-gap: 42ms;");
    expect(css).toContain("--drever-recipe-continuity-new-from-opacity: 0.44;");
    expect(css).toContain("[data-drever-reduced-motion]");
    expect(theme.motion?.guidance?.every((entry) => entry.trim().length > 20)).toBe(true);
  });
});

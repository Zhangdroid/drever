import { readFileSync } from "node:fs";
import { createCompilePlan } from "@drever/compiler";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import ledgerTheme, { ledgerRecipes, theme } from "./index.ts";
import { Evidence, Metric } from "./layouts.tsx";

describe("@drever/theme-ledger", () => {
  it("resolves a JSON-safe theme contract and its public layout registry", () => {
    expect(ledgerTheme).toBe(theme);
    expect(JSON.parse(JSON.stringify(theme))).toEqual(theme);

    const result = createCompilePlan({ theme });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.diagnostics).toEqual([]);
    expect(result.value.theme).toMatchObject({
      id: "@drever/theme-ledger",
      canvas: { width: 1600, height: 900 },
      motion: {
        id: "ledger",
        intents: ["focus", "replace", "compare", "stagger", "continuity"],
      },
    });
    expect(result.value.runtime.styles).toEqual([
      {
        owner: { kind: "theme", id: "@drever/theme-ledger" },
        style: { specifier: "@drever/theme-ledger/theme.css", layer: "theme" },
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
        name: "Metric",
        module: { specifier: "@drever/theme-ledger/layouts", exportName: "Metric" },
        requiredSlots: ["label", "value", "context"],
      },
      {
        name: "Evidence",
        module: { specifier: "@drever/theme-ledger/layouts", exportName: "Evidence" },
        requiredSlots: ["claim", "interpretation", "evidence"],
      },
    ]);
  });

  it("publishes bounded, unique recipes for evidence-led composition", () => {
    expect(new Set(ledgerRecipes.map(({ id }) => id)).size).toBe(ledgerRecipes.length);
    expect(ledgerRecipes.map(({ layout }) => layout)).toEqual(["Metric", "Evidence", "Markdown"]);
    for (const recipe of ledgerRecipes) {
      expect(recipe.purpose.trim().length).toBeGreaterThan(30);
      expect(recipe.prompt.trim().length).toBeGreaterThan(50);
      expect(recipe.constraints).toHaveLength(3);
      expect(recipe.constraints.every((constraint) => constraint.trim().length > 12)).toBe(true);
    }
  });

  it("renders labelled metric and semantic evidence regions while forwarding HTML attributes", () => {
    const metric = renderToStaticMarkup(
      <Metric
        benchmark="Target 65%"
        change="+7.2 pp vs Q1"
        context="Guided setup moved more teams to their first shared result."
        data-study="activation"
        label="Activation rate"
        period="Q2 · New accounts"
        tone="positive"
        unit="%"
        value="68.4"
      />,
    );
    const evidence = renderToStaticMarkup(
      <Evidence
        aria-label="Cycle-time finding"
        balance="balanced"
        claim="Most delay enters before review."
        evidence={<svg aria-label="Cycle-time chart" />}
        interpretation={<p>Queue time explains the missed service level.</p>}
        label="Finding 04"
        source="Workflow events · Apr–Jun 2026 · n=1,842"
      />,
    );

    expect(metric).toContain("<article");
    expect(metric).toContain('data-study="activation"');
    expect(metric).toContain('data-drever-layout="metric"');
    expect(metric).toContain('data-tone="positive"');
    expect(metric).toContain('<strong class="drever-ledger-metric__value">68.4</strong>');
    expect(metric).toContain('<span class="drever-ledger-metric__unit">%</span>');
    expect(metric).toContain('<p class="drever-ledger-metric__benchmark">Target 65%</p>');
    expect(metric).not.toContain(">Benchmark<");
    const metricLabelId = metric.match(/aria-labelledby="([^"]+)"/u)?.[1];
    expect(metricLabelId).toBeDefined();
    expect(metric).toContain(`id="${metricLabelId}"`);

    expect(evidence).toContain("<article");
    expect(evidence).toContain('aria-label="Cycle-time finding"');
    expect(evidence).toContain('data-drever-layout="evidence"');
    expect(evidence).toContain('data-balance="balanced"');
    expect(evidence).toContain("<section");
    expect(evidence).toContain("<figure");
    expect(evidence).toContain('aria-label="Cycle-time chart"');
    expect(evidence).toContain("<figcaption>Workflow events · Apr–Jun 2026 · n=1,842</figcaption>");
  });

  it("keeps CSS aligned with tokens and covers semantics, data, motion, and layouts", () => {
    const css = readFileSync(new URL("../theme.css", import.meta.url), "utf8");
    const colorTokens = theme.tokens.color;

    for (const [cssToken, value] of [
      ["canvas", colorTokens.canvas],
      ["ink", colorTokens.ink],
      ["muted", colorTokens.muted],
      ["accent", colorTokens.accent],
      ["accent-strong", colorTokens.accentStrong],
      ["accent-soft", colorTokens.accentSoft],
      ["positive", colorTokens.positive],
      ["positive-soft", colorTokens.positiveSoft],
      ["surface", colorTokens.surface],
      ["border", colorTokens.border],
      ["grid", colorTokens.grid],
      ["code", colorTokens.codeCanvas],
      ["code-ink", colorTokens.codeInk],
    ] as const) {
      expect(css).toContain(`--drever-ledger-${cssToken}: ${value};`);
    }
    for (const alias of [
      "ink",
      "muted",
      "accent",
      "accent-strong",
      "accent-soft",
      "positive",
      "positive-soft",
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
    expect(css).toContain("font-variant-numeric: tabular-nums lining-nums;");
    expect(css).toMatch(
      /\.drever-ledger-metric\[data-tone="attention"\]\s*\{\s*--drever-ledger-metric-tone:\s*var\(--drever-ledger-accent-strong\);/su,
    );
    expect(css).toContain("[data-drever-slide] .drever-ledger-metric__value {");
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
      ".drever-ledger-metric__value",
      ".drever-ledger-evidence__artifact",
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
    expect(css).toContain("--drever-motion-slide-offset: 2%;");
    expect(css).toContain("--drever-recipe-stagger-gap: 36ms;");
    expect(css).toContain("--drever-recipe-step-block-from-translate: 0 8px;");
    expect(css).toContain("--drever-recipe-step-inline-from-translate: 10px 0;");
    expect(css).toContain(`--drever-motion-duration: ${theme.tokens.motion.duration}ms;`);
    expect(css).toContain('data-step-state="active"]::before');
    expect(css).toContain(
      '[data-drever-deck]:not([data-drever-render-mode="document"])\n  [data-drever-motion-group=""]:is(',
    );
    expect(css).not.toMatch(/data-step-state="complete"\]\s*\{\s*opacity: 0\./u);
    expect(css).toContain("@keyframes drever-ledger-step-inline-enter");
    expect(css).toContain("@keyframes drever-ledger-stagger-block-enter");
    expect(css).toContain("[data-drever-reduced-motion]");
    expect(css).not.toContain("--drever-recipe-step-from-transform");
    expect(css).not.toMatch(/@import|url\(/u);
    expect(theme.motion?.guidance?.every((entry) => entry.trim().length > 20)).toBe(true);
  });
});

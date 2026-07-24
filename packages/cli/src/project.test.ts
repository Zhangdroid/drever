import { createCompilePlan } from "@drever/compiler";
import gfmPlugin from "@drever/plugin-gfm";
import shikiPlugin from "@drever/plugin-shiki";
import tailwindCssPlugin, { tailwindCss } from "@drever/plugin-tailwindcss";
import defaultTheme from "@drever/designs/default";
import { describe, expect, it } from "vite-plus/test";
import { resolvePluginRegistrations } from "./project.ts";

describe("default plugin registrations", () => {
  it("enables GFM, Shiki, and Tailwind CSS as ordered defaults", () => {
    expect(resolvePluginRegistrations()).toMatchObject([
      { origin: "default", plugin: gfmPlugin },
      { origin: "default", plugin: shikiPlugin },
      { origin: "default", plugin: tailwindCssPlugin },
    ]);
  });

  it("lets config disable or configure a default without registering it twice", () => {
    const result = createCompilePlan({
      theme: defaultTheme,
      plugins: resolvePluginRegistrations([
        { plugin: shikiPlugin, enabled: false },
        tailwindCss({ optimize: false }),
      ]),
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        plugins: [
          {
            id: "@drever/plugin-gfm",
            origin: "default",
            config: { singleTilde: true },
          },
          {
            id: "@drever/plugin-tailwindcss",
            origin: "default",
            config: { optimize: false },
          },
        ],
      },
    });
  });

  it("keeps a second override visible to the compiler's duplicate diagnostic", () => {
    const result = createCompilePlan({
      theme: defaultTheme,
      plugins: resolvePluginRegistrations([shikiPlugin, shikiPlugin]),
    });

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "DREVER_PLUGIN_DUPLICATE",
          plugin: "@drever/plugin-shiki",
          details: { origins: ["default", "user"] },
        },
      ],
    });
  });
});

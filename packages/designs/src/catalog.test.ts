import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vite-plus/test";
import { officialDesigns } from "./index.ts";

const designNames = [
  "atlas",
  "basic",
  "cinema",
  "construct",
  "editorial",
  "fieldnote",
  "ledger",
  "studio",
] as const;

describe("@drever/designs", () => {
  it("publishes one explicit runtime namespace for every official design study", () => {
    expect(Object.keys(officialDesigns)).toEqual(designNames);

    for (const [name, theme] of Object.entries(officialDesigns)) {
      const namespace = `@drever/designs/${name}`;

      expect(theme.id).toBe(namespace);
      expect(theme.styles).toEqual([{ specifier: `${namespace}/theme.css`, layer: "theme" }]);
      for (const layout of theme.layouts ?? []) {
        expect(layout.module.specifier).toBe(`${namespace}/layouts`);
      }
    }
  });

  it("resolves every custom whole-slide animation declared by an official study", async () => {
    await Promise.all(
      designNames.map(async (name) => {
        const css = await readFile(new URL(`../themes/${name}/theme.css`, import.meta.url), "utf8");
        const value = (property: string): string =>
          css.match(new RegExp(`${property}:\\s*([^;]+);`, "u"))?.[1]?.trim() ?? "default";
        const animations = [
          value("--drever-motion-slide-enter-animation"),
          value("--drever-motion-slide-exit-animation"),
        ];

        for (const animation of animations) {
          if (animation === "default" || animation === "none") {
            continue;
          }
          expect(css, `${name} must define ${animation}`).toMatch(
            new RegExp(`@keyframes\\s+${animation}\\b`, "u"),
          );
        }
      }),
    );
  });

  it("preserves each reference study's authored motion role", async () => {
    const sources = Object.fromEntries(
      await Promise.all(
        designNames.map(async (name) => [
          name,
          await readFile(
            new URL(`../../../examples/theme-showcase/decks/${name}.mdx`, import.meta.url),
            "utf8",
          ),
        ]),
      ),
    );

    expect(sources.basic).toContain('<SlideTransition from="next" mode="local" />');
    expect(sources.basic).not.toMatch(/<Step\b|intent="continuity"/u);

    expect(sources.editorial).toContain("theme-showcase-editorial-study__margin-note");
    expect(sources.editorial).toContain("<Step at={1}");

    expect(sources.studio).toContain("theme-showcase-studio-study__diagnosis");
    expect(sources.studio).toContain('<RequestTrace phase="verified" />');

    expect(sources.fieldnote).toContain("fieldnote-study__observation-layer");
    expect(sources.fieldnote).toContain("fieldnote-study__interpretation");

    expect(sources.atlas).toContain('name="atlas-river-corridor"');
    expect(sources.atlas).toContain('<SlideTransition from="previous" mode="local" />');

    expect(sources.ledger).toContain('className="ledger-record__audit-rows"');
    expect(sources.ledger).toContain('role="list"');
    expect(sources.ledger).not.toContain('intent="continuity"');

    expect(sources.construct).toContain('intent="stagger"');
    expect(sources.construct).toContain("theme-showcase-construct-test");

    const cinemaSlides = sources.cinema.split(/\n---\n/u);

    expect(cinemaSlides).toHaveLength(6);
    expect(cinemaSlides[1]).toContain('<SlideTransition from="next" mode="local" />');
    expect(cinemaSlides[2]).toContain('<SlideTransition from="previous" mode="local" />');
  });
});

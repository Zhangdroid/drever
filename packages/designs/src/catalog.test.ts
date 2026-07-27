import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vite-plus/test";
import {
  CJK_HANDWRITTEN_FONT_STACKS,
  CJK_SANS_FONT_STACKS,
  CJK_SERIF_FONT_STACKS,
} from "./cjk-typography.ts";
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

const cjkFontFamilies = [
  ...Object.values(CJK_HANDWRITTEN_FONT_STACKS),
  ...Object.values(CJK_SANS_FONT_STACKS),
  ...Object.values(CJK_SERIF_FONT_STACKS),
].flatMap((stack) => stack.split(", "));

const expectLocaleAwareFontRole = (
  css: string,
  design: string,
  role: "handwritten" | "sans" | "serif",
): void => {
  for (const locale of ["zh-hans", "zh-hant", "ja", "ko"]) {
    expect(css, `${design} must include its ${role} ${locale} stack`).toContain(
      `--drever-theme-font-cjk-${role}-${locale}:`,
    );
  }

  for (const [language, locale] of [
    ["ja", "ja"],
    ["ko", "ko"],
    ["zh-Hant", "zh-hant"],
  ] as const) {
    expect(css, `${design} must select its ${role} ${locale} stack from lang`).toMatch(
      new RegExp(
        `:lang\\(${language}\\)[\\s\\S]*?\\{[^}]*--drever-theme-font-cjk-${role}:\\s*var\\(--drever-theme-font-cjk-${role}-${locale}\\);`,
        "u",
      ),
    );
  }
};

const expectNestedLocaleAwareFontRole = (
  css: string,
  design: string,
  role: "handwritten" | "sans" | "serif",
): void => {
  for (const [language, locale] of [
    ["zh", "zh-hans"],
    ["zh-Hant", "zh-hant"],
    ["ja", "ja"],
    ["ko", "ko"],
  ] as const) {
    const blocks = [
      ...css.matchAll(
        new RegExp(
          `\\[data-drever-slide\\][^{]*:lang\\(${language}\\)[^{]*\\{(?<body>[^}]*)\\}`,
          "gsu",
        ),
      ),
    ];
    const declaration = new RegExp(
      `--drever-theme-font-cjk-${role}:\\s*var\\(--drever-theme-font-cjk-${role}-${locale}\\);`,
      "u",
    );

    expect(
      blocks.some((block) => declaration.test(block.groups?.body ?? "")),
      `${design} must select its nested ${role} ${locale} stack from lang`,
    ).toBe(true);
  }
};

const expectLanguageBoundaryFontRole = (
  css: string,
  design: string,
  role: "handwritten" | "sans",
): void => {
  const boundary = css.match(
    /:where\(\[data-drever-slide\] \[lang\]\):where\(:lang\(zh\), :lang\(ja\), :lang\(ko\)\)\s*\{(?<body>[^}]*)\}/su,
  )?.groups?.body;

  expect(boundary, `${design} must recompute its explicit language boundary`).toContain(
    "font-family:",
  );
  expect(boundary, `${design} must retain its Latin body role at language boundaries`).toContain(
    "var(--drever-theme-font-body-latin)",
  );
  expect(boundary, `${design} must consume its locale-selected boundary role`).toContain(
    `var(--drever-theme-font-cjk-${role})`,
  );
};

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

  it("keeps every official study readable when the document language is CJK", async () => {
    expect(CJK_SANS_FONT_STACKS.zhHant).not.toMatch(/PingFang SC|Microsoft YaHei/u);
    expect(CJK_SANS_FONT_STACKS.ja).not.toMatch(/PingFang|Microsoft YaHei/u);
    expect(CJK_SANS_FONT_STACKS.ko).not.toMatch(/PingFang|Hiragino|Microsoft YaHei/u);

    await Promise.all(
      designNames.map(async (name) => {
        const theme = officialDesigns[name];
        const typography = theme.tokens.typography;
        const css = await readFile(new URL(`../themes/${name}/theme.css`, import.meta.url), "utf8");

        expect(typography, `${name} must publish typography metadata`).toEqual(
          expect.objectContaining({
            body: expect.any(String),
            cjk: expect.any(Object),
            display: expect.any(String),
          }),
        );
        if (name === "fieldnote") {
          expect(typography?.cjk).toEqual(
            expect.objectContaining({ handwritten: CJK_HANDWRITTEN_FONT_STACKS }),
          );
        } else {
          expect(typography?.cjk).toEqual(expect.objectContaining({ sans: CJK_SANS_FONT_STACKS }));
        }
        if (["atlas", "cinema", "editorial"].includes(name)) {
          expect(typography?.cjk).toEqual(
            expect.objectContaining({ serif: CJK_SERIF_FONT_STACKS }),
          );
        }

        for (const role of ["body", "display"] as const) {
          for (const family of cjkFontFamilies) {
            expect(
              typography?.[role],
              `${name} typography.${role} must remain locale-neutral; publish ${family} through typography.cjk`,
            ).not.toContain(family);
          }
        }

        expect(css, `${name} must separate its Latin display stack`).toContain(
          "--drever-theme-font-display-latin:",
        );
        expect(css, `${name} must separate its Latin body stack`).toContain(
          "--drever-theme-font-body-latin:",
        );
        const cjkRole = name === "fieldnote" ? "handwritten" : "sans";
        expectLocaleAwareFontRole(css, name, cjkRole);
        expectNestedLocaleAwareFontRole(css, name, cjkRole);
        expectLanguageBoundaryFontRole(css, name, cjkRole);
        if (["atlas", "cinema", "editorial"].includes(name)) {
          expectLocaleAwareFontRole(css, name, "serif");
          expectNestedLocaleAwareFontRole(css, name, "serif");
        }
        expect(css, `${name} must publish its CJK heading rhythm`).toContain(
          "--drever-theme-font-cjk-title-line-height:",
        );
        expect(css, `${name} must publish its CJK prose rhythm`).toContain(
          "--drever-theme-font-cjk-body-line-height:",
        );
        expect(css, `${name} must consume one semantic CJK family`).toMatch(
          /var\(--drever-theme-font-cjk-(?:handwritten|sans|serif)\)/u,
        );
        expect(css, `${name} must not force Latin casing onto CJK content`).toMatch(
          /:where\(:lang\(zh\), :lang\(ja\), :lang\(ko\)\)\s*\{[^}]*text-transform:\s*none;/su,
        );
        expect(css, `${name} must calibrate CJK heading rhythm`).toMatch(
          /:where\(h1, h2, h3, h4, h5, h6\):where\(:lang\(zh\), :lang\(ja\), :lang\(ko\)\)\s*\{[^}]*line-height:/su,
        );
        expect(css, `${name} must calibrate CJK prose rhythm`).toMatch(
          /:where\(p, li, blockquote, figcaption, th, td\):where\(:lang\(zh\), :lang\(ja\), :lang\(ko\)\)\s*\{[^}]*line-height:/su,
        );
        const prose = css.match(
          /:where\(p, li, blockquote, figcaption, th, td\):where\(:lang\(zh\), :lang\(ja\), :lang\(ko\)\)\s*\{(?<body>[^}]*)\}/su,
        )?.groups?.body;

        expect(prose, `${name} must recompute its CJK prose family`).toContain("font-family:");
        expect(prose, `${name} must retain its Latin body role around CJK glyphs`).toContain(
          "var(--drever-theme-font-body-latin)",
        );
        expect(prose, `${name} must consume its locale-selected CJK prose role`).toContain(
          `var(--drever-theme-font-cjk-${cjkRole})`,
        );
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

  it("keeps the Atlas continuity snapshot in one invariant frame", async () => {
    const css = await readFile(
      new URL("../../../examples/theme-showcase/components/atlas-decision.css", import.meta.url),
      "utf8",
    );

    expect(css).toMatch(
      /\.atlas-study__artifact\s*\{[^}]*width:\s*850px;[^}]*height:\s*396px;[^}]*box-sizing:\s*border-box;/su,
    );
    expect(css).toMatch(/\.atlas-river\s*\{[^}]*width:\s*850px;[^}]*height:\s*396px;/su);
    expect(css).not.toMatch(
      /\.atlas-study--(?:route|gates)\s+\.atlas-river\s*\{[^}]*\b(?:width|height):/su,
    );
  });
});

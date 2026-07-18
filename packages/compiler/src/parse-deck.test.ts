import { describe, expect, it } from "vite-plus/test";
import type { DeckIR, SourceFragment } from "@drever/schema";
import { parseDeck } from "./parse-deck.ts";

const expectExactFragments = (source: string, deck: DeckIR): void => {
  const fragments: SourceFragment[] = [
    ...deck.preamble,
    ...deck.slides.flatMap((slide) => slide.fragments),
  ];

  for (const fragment of fragments) {
    expect(source.slice(fragment.range.start.offset, fragment.range.end.offset)).toBe(
      fragment.value,
    );
  }

  for (const slide of deck.slides) {
    expect(slide.source).toBe(slide.fragments.map((fragment) => fragment.value).join(""));
  }
};

describe("parseDeck", () => {
  it("creates one slide when no separator is present", () => {
    const result = parseDeck("# Hello\n\nWelcome to Drever.", { path: "talk.mdx" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.diagnostics).toEqual([]);
    expect(result.value).toMatchObject({
      version: 1,
      sourcePath: "talk.mdx",
      slides: [{ id: "slide-1", index: 0, source: "# Hello\n\nWelcome to Drever." }],
    });
  });

  it("splits root thematic breaks but not code fence content", () => {
    const result = parseDeck(`
# First

\`\`\`md
---
\`\`\`

---

# Second
`);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.slides).toHaveLength(2);
    expect(result.value.slides[0]?.source).toContain("```md\n---\n```");
    expect(result.value.slides[1]?.source).toBe("# Second");
  });

  it("does not let nested Markdown or MDX content redefine slide boundaries", () => {
    const result = parseDeck(`# First

> ---

<section>

---

</section>

---

# Second`);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.slides).toHaveLength(2);
    expect(result.value.slides[0]?.source).toContain("> ---");
    expect(result.value.slides[0]?.source).toContain("<section>\n\n---\n\n</section>");
    expect(result.value.slides[1]?.source).toBe("# Second");
  });

  it("reserves exactly three dashes for slides and preserves other thematic breaks", () => {
    const result = parseDeck("# First\n\n***\n\nStill first\n\n---\n\n# Second");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.slides.map((slide) => slide.source)).toEqual([
      "# First\n\n***\n\nStill first",
      "# Second",
    ]);
  });

  it("warns when three dashes are consumed by Setext heading syntax", () => {
    const result = parseDeck("First slide\n---\n\n# Still the first slide", { path: "talk.mdx" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.slides).toHaveLength(1);
    expect(result.diagnostics).toMatchObject([
      {
        code: "DREVER_DECK_AMBIGUOUS_SEPARATOR",
        severity: "warning",
        stage: "parse",
        source: {
          path: "talk.mdx",
          start: { line: 2, column: 1, offset: 12 },
          end: { line: 2, column: 4, offset: 15 },
        },
      },
    ]);
  });

  it("extracts MDX ESM while retaining exact source fragments", () => {
    const source = `
import { Demo } from "./demo.tsx"

# Demo

export const topic = "Drever"

<Demo />

---

# Summary
`;
    const result = parseDeck(source);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.preamble.map((fragment) => fragment.value)).toEqual([
      'import { Demo } from "./demo.tsx"',
      'export const topic = "Drever"',
    ]);
    expect(result.value.slides[0]?.source).toContain("# Demo");
    expect(result.value.slides[0]?.source).toContain("<Demo />");
    expect(result.value.slides[0]?.source).not.toContain("export const");
    expect(result.value.slides[0]?.fragments).toHaveLength(2);
    expect(result.value.slides[1]?.source).toBe("# Summary");
    expectExactFragments(source, result.value);
  });

  it("reports empty slides without throwing", () => {
    const result = parseDeck("# First\n\n---\n\n---\n\n# Third");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.slides).toHaveLength(3);
    expect(result.diagnostics).toMatchObject([
      {
        code: "DREVER_DECK_EMPTY_SLIDE",
        severity: "warning",
        stage: "parse",
        slideId: "slide-2",
      },
    ]);
  });

  it("returns a structured diagnostic for invalid MDX", () => {
    const result = parseDeck("# Broken\n\n<Component", { path: "broken.mdx" });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({
      code: "DREVER_MDX_PARSE",
      severity: "error",
      stage: "parse",
      source: {
        path: "broken.mdx",
        start: { line: 3, column: 11, offset: 20 },
        end: { line: 3, column: 11, offset: 20 },
      },
    });
  });
});

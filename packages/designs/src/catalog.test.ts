import { describe, expect, it } from "vite-plus/test";
import { officialDesigns } from "./index.ts";

describe("@drever/designs", () => {
  it("publishes one explicit runtime namespace for every official design study", () => {
    expect(Object.keys(officialDesigns)).toEqual([
      "atlas",
      "cinema",
      "construct",
      "default",
      "editorial",
      "fieldnote",
      "ledger",
      "studio",
    ]);

    for (const [name, theme] of Object.entries(officialDesigns)) {
      const namespace = `@drever/designs/${name}`;

      expect(theme.id).toBe(namespace);
      expect(theme.styles).toEqual([{ specifier: `${namespace}/theme.css`, layer: "theme" }]);
      for (const layout of theme.layouts ?? []) {
        expect(layout.module.specifier).toBe(`${namespace}/layouts`);
      }
    }
  });
});

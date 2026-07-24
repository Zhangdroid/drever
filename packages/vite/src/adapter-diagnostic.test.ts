import { describe, expect, it } from "vite-plus/test";
import { errorMessage } from "./adapter-diagnostic.ts";

describe("adapter diagnostics", () => {
  it("preserves unified source location and rule ownership", () => {
    const failure = Object.assign(new Error("Footnotes are not supported."), {
      column: 6,
      line: 1,
      ruleId: "gfm-footnotes-unsupported",
      source: "drever",
    });

    expect(errorMessage(failure)).toBe(
      "1:6: Footnotes are not supported. [drever:gfm-footnotes-unsupported]",
    );
  });
});

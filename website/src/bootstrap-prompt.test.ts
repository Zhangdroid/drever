import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vite-plus/test";

const prompt = await readFile(new URL("../public/prompt.md", import.meta.url), "utf8");

describe("public bootstrap prompt", () => {
  it("asks a concrete question before offering the surprise escape", () => {
    const topicQuestion = prompt.indexOf("Make the topic the first question");
    const surpriseEscape = prompt.indexOf("Skip remaining questions — surprise me");

    expect(topicQuestion).toBeGreaterThanOrEqual(0);
    expect(surpriseEscape).toBeGreaterThan(topicQuestion);
    expect(prompt).toMatch(/Never lead\s+with that option/u);
  });

  it("makes rendered text readability a blocking contract", () => {
    expect(prompt).toMatch(/not immediately readable[^.]*blocking defect/iu);
    expect(prompt).toMatch(/Do not assume[^.]*wrapper[^.]*descendant text/iu);
    expect(prompt).toMatch(/computed foreground styles/iu);
    expect(prompt).toMatch(/across every Step/iu);
  });

  it("requires a varied transition vocabulary and structurally distinct references", () => {
    expect(prompt).toMatch(/transition vocabulary rather than one effect on\s+every page/iu);
    expect(prompt).toMatch(/direct cuts[^.]*restrained fades[^.]*local live-DOM/iu);
    expect(prompt).toMatch(/vary their narrative length,\s+density,\s+composition rhythm/iu);
  });
});

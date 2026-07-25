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
});

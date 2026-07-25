import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vite-plus/test";

const prompt = await readFile(new URL("../public/prompt.md", import.meta.url), "utf8");

describe("public bootstrap prompt", () => {
  it("asks one useful opening round and offers only the skip-remaining escape", () => {
    const topicQuestion = prompt.indexOf("make it the first question");
    const commonQuestions = prompt.indexOf("same opening round");
    const surpriseEscape = prompt.indexOf("Skip remaining questions — surprise me");

    expect(topicQuestion).toBeGreaterThanOrEqual(0);
    expect(commonQuestions).toBeGreaterThan(topicQuestion);
    expect(surpriseEscape).toBeGreaterThan(topicQuestion);
    expect(prompt).toMatch(/audience outcome\s+and duration/iu);
    expect(prompt).toMatch(/append exactly one escape/iu);
    expect(prompt).not.toMatch(/Or answer “Surprise me”|choose the subject too/iu);
  });

  it("defines topic-specific signature moments and a refinement ceiling", () => {
    expect(prompt).toMatch(/topic fingerprint/iu);
    expect(prompt).toMatch(
      /claim[^→]*→ focal\s+artifact[^→]*→ initial\s+state[^→]*→ meaningful\s+transformation[^→]*→ settled\s+payoff[^→]*→ static or reduced-motion\s+endpoint/iu,
    );
    expect(prompt).toMatch(/generic fade or slide entrance alone does not count/iu);
    expect(prompt).toMatch(/what one scene the audience will remember/iu);
    expect(prompt).toMatch(/redesign exactly one high-value beat/iu);
  });

  it("makes rendered text readability a blocking contract", () => {
    expect(prompt).toMatch(/Every visible authored string is a\s+reading promise/iu);
    expect(prompt).toMatch(
      /not immediately legible at presentation distance[^.]*blocking P0 defect/iu,
    );
    expect(prompt).toMatch(/Do not assume[^.]*wrapper[^.]*descendant text/iu);
    expect(prompt).toMatch(/computed foreground styles/iu);
    expect(prompt).toMatch(/across every Step/iu);
    expect(prompt).toMatch(/fully contained within the shape or surface that visually owns it/iu);
    expect(prompt).toMatch(/usable inner silhouette[^.]*rectangular bounding box/iu);
    expect(prompt).toMatch(/every slide at Step 0 and\s+every exact authored Step route/iu);
  });

  it("requires a varied transition vocabulary and structurally distinct references", () => {
    expect(prompt).toMatch(/transition\s+vocabulary rather than one effect on\s+every page/iu);
    expect(prompt).toMatch(/direct cuts[^.]*restrained fades[^.]*local live-DOM/iu);
    expect(prompt).toMatch(
      /shared shell identical explicit width,\s+height,\s+aspect ratio,\s+and box\s+sizing/iu,
    );
    expect(prompt).toMatch(
      /incompatible bounds,\s+use a cut,\s+replacement,\s+or\s+restrained\s+dissolve/iu,
    );
    expect(prompt).toMatch(/vary their narrative length,\s+density,\s+composition rhythm/iu);
  });
});

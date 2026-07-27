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
    expect(prompt).toMatch(/Do not\s+assume[^.]*wrapper[^.]*descendant text/iu);
    expect(prompt).toMatch(/computed font size[^.]*foreground/iu);
    expect(prompt).toMatch(/across every Step/iu);
    expect(prompt).toMatch(/fully contained within the shape or surface that visually owns it/iu);
    expect(prompt).toMatch(/usable inner silhouette[^.]*rectangular bounding box/iu);
    expect(prompt).toMatch(/every slide at Step 0\s+and\s+every exact authored Step route/iu);
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

  it("requires stable Step geometry and rendered CSS evidence", () => {
    expect(prompt).toMatch(/`Step` as a real DOM wrapper/iu);
    expect(prompt).toMatch(/containing block[^.]*absolute descendant[^.]*invariant/iu);
    expect(prompt).toContain('[data-drever-slide][data-slide-state="active"]');
    expect(prompt).toContain('[data-drever-step][data-step-state="active"]');
    expect(prompt).toMatch(/exactly one motion owner/iu);
    expect(prompt).toMatch(/inactive slides stay mounted/iu);
    expect(prompt).toMatch(/computed font size[^.]*margin,\s+padding,\s+gap/iu);
    expect(prompt).toMatch(/Theme-owned Markdown margins/iu);
    expect(prompt).toMatch(/full-canvas scene[^.]*stable positioned slide-relative root/iu);
    expect(prompt).toMatch(/Source review[^.]*do not count as the Draft 1 rendered refinement/iu);
  });

  it("hands final rendering to browser evidence and keeps Pretext advisory", () => {
    expect(prompt).toMatch(/Prefer a connected Chrome DevTools\s+MCP server/iu);
    expect(prompt).toMatch(/dev-only experimental Pretext layout probe/iu);
    expect(prompt).toMatch(/probe is advisory/iu);
    expect(prompt).toMatch(/rendered DOM and pixels remain authoritative/iu);
  });
});

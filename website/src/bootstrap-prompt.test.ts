import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vite-plus/test";

const prompt = await readFile(new URL("../public/prompt.md", import.meta.url), "utf8");
const createDeckSkill = await readFile(
  new URL("../../packages/cli/agent-kit/skills/drever-create-deck/SKILL.md", import.meta.url),
  "utf8",
);
const createDesignSkill = await readFile(
  new URL("../../packages/cli/agent-kit/skills/drever-create-design/SKILL.md", import.meta.url),
  "utf8",
);
const briefingContractMarker = /<!-- drever-briefing-contract:(v\d+) -->/u;
const planReviewContractMarker = /<!-- drever-plan-review-contract:(v\d+) -->/u;
const previewContractMarker = /<!-- drever-preview-contract:(v\d+) -->/u;
const authoringScopeContractMarker = /<!-- drever-authoring-scope-contract:(v\d+) -->/u;

const expectAdaptiveBriefingContract = (source: string): void => {
  expect(source).toMatch(/topic is missing[^.]*ask for it by itself/iu);
  expect(source).toMatch(/one to three questions per round/iu);
  expect(source).toMatch(/two to four mutually distinct,\s+topic-specific options/iu);
  expect(source).toMatch(/consequence (?:after|of) each option/iu);
  expect(source).toMatch(/at most one option \*\*Recommended\*\*/iu);
  expect(source).toContain("1A, 2C, 3B");
  expect(source).toMatch(/combine options,\s+answer in your own words/iu);
  expect(source).toMatch(/two or three\s+rounds and four to seven decisions/iu);
  expect(source).toMatch(/follow-up should depend on an earlier answer/iu);
  expect(source).toMatch(/Decision,\s+proposal,\s+or sales/iu);
  expect(source).toMatch(/Technical update or tutorial/iu);
  expect(source).toMatch(/Research,\s+report,\s+or data story/iu);
  expect(source).toMatch(/Product launch or demo/iu);
  expect(source).toMatch(/Keynote,\s+brand,\s+or narrative/iu);
  expect(source).toMatch(/Workshop or training/iu);
  expect(source.match(/Skip remaining questions — surprise\s+me/gu)).toHaveLength(1);
  expect(source).toMatch(
    /(?:append exactly one escape to every round|End every round with exactly one escape)/iu,
  );
  expect(source).toMatch(/stop asking[^.]*every unanswered choice/iu);
  expect(source).not.toMatch(/choose the subject too|Or answer “Surprise me”/iu);
  expect(source).toMatch(/density is a required decision/iu);
  expect(source).toMatch(/concise presenter-led[^.]*balanced[^.]*more detailed reader-led/iu);
  expect(source).toMatch(/visible copy,\s+slide count,\s+and\s+notes/iu);
  expect(source).toMatch(/Do not ask a separate notes-depth question/iu);
};

const expectPlanReviewContract = (source: string): void => {
  expect(source).toMatch(/status as \*\*Awaiting\s+approval\*\*/iu);
  expect(source).toMatch(/planned slide count or range/iu);
  expect(source).toMatch(/speaker-note strategy/iu);
  expect(source).toMatch(/motion intensity/iu);
  expect(source).toMatch(/numbered slide-by-slide outline/iu);
  expect(source).toMatch(/working title and one clear job/iu);
  expect(source).toMatch(/Present the complete brief and outline/iu);
  expect(source).toMatch(/invite edits or explicit\s+approval,\s+and stop/iu);
  expect(source).toMatch(/mandatory (?:review gate|for a new deck)/iu);
  expect(source).toMatch(/create it now[^.]*does not bypass/iu);
  expect(source).toMatch(/After explicit\s+approval,\s+mark it\s+\*\*Approved\*\*/iu);
  expect(source).toMatch(
    /Do not[^.]*configured MDX entry[^.]*development server[^.]*build[^.]*export[^.]*preview/isu,
  );
};

const expectPreviewFirstContract = (source: string): void => {
  expect(source).toMatch(/time to first useful preview/iu);
  expect(source).toMatch(/coherent Draft 1/iu);
  expect(source).toMatch(/every planned slide[^.]*real readable copy/iu);
  expect(source).toMatch(
    /Defer[^.]*signature choreography[^.]*optional\s+third-party integrations[^.]*export-only polish/iu,
  );
  expect(source).toMatch(
    /minimum preview gate[^.]*entry\s+compiles[^.]*audience\s+route responds[^.]*first and last slides open/isu,
  );
  expect(source).toMatch(/Do not block[^.]*drever build[^.]*PDF export[^.]*every Step/isu);
  expect(source).toMatch(/non-blocking progress update/iu);
  expect(source).toMatch(/do not stop[^.]*approval/iu);
  expect(source).toMatch(/discard stale validation/iu);
  expect(source).toMatch(/production build[^.]*only after[^.]*stable/iu);
  expect(source).toMatch(/(?:a )?PDF only\s+when requested/iu);
  expect(source).toMatch(/never invent a preview URL/iu);
  expect(source).toMatch(/preview as Draft 1,\s+not delivery/iu);
  expect(source).toMatch(/parallel (?:design|work|workers)/iu);
  expect(source).toMatch(
    /(?:(?:first preview|Draft 1 URL)[^.]*must not (?:delay|wait)|must not delay[^.]*Draft 1)/iu,
  );
};

const expectAuthoringScopeContract = (source: string): void => {
  expect(source).toMatch(/complete (?:Drever\s+)?(?:public\s+|authoring\s+)?contract/iu);
  expect(source).toMatch(/do not (?:search or )?inspect[^.]*Drever repository/iu);
  expect(source).toMatch(/`node_modules`/u);
  expect(source).toMatch(/declaration files/iu);
  expect(source).toMatch(/official design implementations/iu);
  expect(source).toMatch(/example decks/iu);
  expect(source).toMatch(/configured MDX entry[^.]*local TypeScript,\s+React,\s+and CSS/iu);
  expect(source).toMatch(/concrete compile\s+or type diagnostic/iu);
  expect(source).toMatch(/one named\s+public declaration\s+or\s+guide/iu);
};

describe("public bootstrap prompt", () => {
  it("keeps the public bootstrap and installed skill on one adaptive briefing contract", () => {
    const promptVersion = prompt.match(briefingContractMarker)?.[1];
    const skillVersion = createDeckSkill.match(briefingContractMarker)?.[1];

    expect(promptVersion).toBe("v3");
    expect(skillVersion).toBe(promptVersion);
    expectAdaptiveBriefingContract(prompt);
    expectAdaptiveBriefingContract(createDeckSkill);
  });

  it("stops on a complete brief and slide outline before authoring", () => {
    const promptVersion = prompt.match(planReviewContractMarker)?.[1];
    const skillVersion = createDeckSkill.match(planReviewContractMarker)?.[1];

    expect(promptVersion).toBe("v1");
    expect(skillVersion).toBe(promptVersion);
    expectPlanReviewContract(prompt);
    expectPlanReviewContract(createDeckSkill);
  });

  it("keeps first preview fast without weakening final delivery", () => {
    const promptVersion = prompt.match(previewContractMarker)?.[1];
    const skillVersion = createDeckSkill.match(previewContractMarker)?.[1];

    expect(promptVersion).toBe("v2");
    expect(skillVersion).toBe(promptVersion);
    expectPreviewFirstContract(prompt);
    expectPreviewFirstContract(createDeckSkill);
  });

  it("authors from the public contract without framework archaeology", () => {
    const promptVersion = prompt.match(authoringScopeContractMarker)?.[1];
    const skillVersion = createDeckSkill.match(authoringScopeContractMarker)?.[1];

    expect(promptVersion).toBe("v1");
    expect(skillVersion).toBe(promptVersion);
    expectAuthoringScopeContract(prompt);
    expectAuthoringScopeContract(createDeckSkill);
    expect(prompt).toMatch(/read only[^.]*`drever-create-deck` skill/iu);
    expect(createDeckSkill).toMatch(
      /Load the design,\s+authoring,\s+review,\s+or delivery skill only/iu,
    );
    expect(createDesignSkill).toMatch(/Do not scan the official studies/iu);
    expect(createDesignSkill).not.toMatch(/Scan all eight studies/iu);
    expect(createDesignSkill).not.toMatch(/packages\/designs\/src\/<study>/u);
  });

  it("defines topic-specific signature moments and a refinement ceiling", () => {
    expect(prompt).toMatch(/topic\s+fingerprint/iu);
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
    expect(prompt).toMatch(/every\s+slide at Step 0\s+and\s+every exact authored Step route/iu);
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
    expect(prompt).toMatch(/Source review[^.]*do not count as the Draft 1 rendered\s+refinement/iu);
  });

  it("hands final rendering to browser evidence and keeps Pretext advisory", () => {
    expect(prompt).toMatch(/Prefer a connected\s+Chrome DevTools\s+MCP server/iu);
    expect(prompt).toMatch(/dev-only experimental Pretext\s+layout probe/iu);
    expect(prompt).toMatch(/probe is advisory/iu);
    expect(prompt).toMatch(/rendered DOM and pixels remain authoritative/iu);
  });
});

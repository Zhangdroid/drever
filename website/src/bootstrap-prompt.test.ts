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
const authorDeckSkill = await readFile(
  new URL("../../packages/cli/agent-kit/skills/drever-author-deck/SKILL.md", import.meta.url),
  "utf8",
);
const reviewDeckSkill = await readFile(
  new URL("../../packages/cli/agent-kit/skills/drever-review-deck/SKILL.md", import.meta.url),
  "utf8",
);
const deliverDeckSkill = await readFile(
  new URL("../../packages/cli/agent-kit/skills/drever-deliver-deck/SKILL.md", import.meta.url),
  "utf8",
);

const wordCount = (source: string): number => source.trim().split(/\s+/u).length;

describe("public bootstrap prompt", () => {
  it("delegates quickly to the installed version-matched workflow", () => {
    expect(wordCount(prompt)).toBeLessThan(450);
    expect(prompt).toMatch(/Follow these instructions now[^.]*do not merely summarize/iu);
    expect(prompt).toMatch(/MDX\/React web project/iu);
    expect(prompt).toMatch(/only authoring contract/iu);
    expect(prompt).toMatch(/another artifact skill[^.]*do not use it/iu);
    expect(prompt.split("## Follow the installed contract")[0]).not.toMatch(
      /presentation|slide deck|powerpoint|pptx/iu,
    );
    expect(prompt).toMatch(/project-local\s+`drever-create-deck` skill/iu);
    expect(prompt).toMatch(/Use `drever-author-deck` for an edit/iu);
    expect(prompt).toMatch(/Never infer\s+replacement/iu);
    expect(prompt).toMatch(/When scaffolding is required/iu);
    expect(prompt).toMatch(/no local adapter[^.]*drever agent sync/iu);
    expect(prompt).toMatch(/generated project contract is authoritative/iu);
    expect(prompt).toMatch(/do not search the\s+Drever repository/iu);
    expect(prompt).toContain("`node_modules`");
    expect(prompt).toMatch(/handoff transfers action handling, not process\s+ownership/iu);
    expect(prompt).toMatch(
      /keep\s+the development command and parent task alive through delivery/iu,
    );
    expect(prompt).toMatch(/one-shot host[^.]*chat plus\s+Storyboard/iu);
    expect(prompt).not.toMatch(/drever-(?:briefing|plan-review|preview)-contract/iu);
    expect(prompt).not.toMatch(/topic-fingerprint|usable inner silhouette|MotionGroup/iu);
  });

  it("keeps the adaptive interview in one canonical skill", () => {
    expect(createDeckSkill).toContain("<!-- drever-authoring-scope-contract:v3 -->");
    expect(createDeckSkill).toContain("<!-- drever-briefing-contract:v4 -->");
    expect(createDeckSkill).toMatch(/one to\s+three decisions per round/iu);
    expect(createDeckSkill).toMatch(/two to four topic-specific choices/iu);
    expect(createDeckSkill).toMatch(/consequence of each choice/iu);
    expect(createDeckSkill).toMatch(/at most one \*\*Recommended\*\* option/iu);
    expect(createDeckSkill).toContain("1A, 2C");
    expect(createDeckSkill.match(/Skip remaining questions — surprise me/gu)).toHaveLength(1);
    expect(createDeckSkill).toMatch(
      /audience, desired change, duration, and visible slide density/iu,
    );
    expect(createDeckSkill).toMatch(/later\s+question should depend on an earlier answer/iu);
    expect(createDeckSkill).not.toMatch(/choose the subject too|Or answer “Surprise me”/iu);
    expect(createDeckSkill).toMatch(
      /Never repeat supplied information or silently choose duration or density/iu,
    );
  });

  it("requires a machine-checkable story contract before authoring", () => {
    expect(createDeckSkill).toContain("<!-- drever-plan-review-contract:v3 -->");
    expect(createDeckSkill).toContain("`brief.md`");
    expect(createDeckSkill).toContain("`drever.plan.json`");
    expect(createDeckSkill).toMatch(/stable lowercase hyphenated id/iu);
    expect(createDeckSkill).toMatch(/narrative job/iu);
    expect(createDeckSkill).toMatch(/evidence and one focal artifact/iu);
    expect(createDeckSkill).toMatch(/composition recipe/iu);
    expect(createDeckSkill).toMatch(/motion[^.]*named intent, purpose, and single owner/iu);
    expect(createDeckSkill).toMatch(/check --json[^.]*before presenting/iu);
    expect(createDeckSkill).toMatch(/invite\s+edits or explicit\s+approval,\s+and stop/iu);
    expect(createDeckSkill).toMatch(/Prefer the local creation room/iu);
    expect(createDeckSkill).toContain("npm run dev -- --open studio");
    expect(createDeckSkill).toMatch(/browser auto-open is unavailable[^.]*browser control/iu);
    expect(createDeckSkill).toContain("drever studio status --json");
    expect(createDeckSkill).toContain("drever studio wait --after <latestActionRevision>");
    expect(createDeckSkill).toContain("drever studio publish --file <path> --json");
    expect(createDeckSkill).toMatch(/publish the `plan-review` phase/iu);
    expect(createDeckSkill).toMatch(/exact \*\*Storyboard\*\* URL reported by\s+Drever/iu);
    expect(createDeckSkill).toMatch(/without importing the deck MDX/iu);
    expect(createDeckSkill).toMatch(/After explicit\s+approval,\s+mark\s+both files approved/iu);
    expect(createDeckSkill).toMatch(/skip-remaining escape does not bypass either approval path/iu);
  });

  it("separates first preview, deterministic checks, and human visual judgment", () => {
    expect(createDeckSkill).toContain("<!-- drever-preview-contract:v6 -->");
    expect(createDeckSkill).toMatch(/every approved slide[^.]*real readable copy/iu);
    expect(createDeckSkill).toMatch(/only pre-preview gate[^.]*drever check --json/iu);
    expect(createDeckSkill).toMatch(/embedded audience\s+iframe[^.]*HMR/iu);
    expect(createDeckSkill).toMatch(/Before that publication[^.]*do not invoke Playwright/iu);
    expect(createDeckSkill).toMatch(/continue in the same turn/iu);
    expect(createDeckSkill).toMatch(/later mutation invalidates[^.]*evidence/iu);
    expect(createDeckSkill).toMatch(/never invent or guess a preview address/iu);
    expect(createDeckSkill).not.toContain("drever check --rendered --json");
    expect(reviewDeckSkill).toContain("drever check --rendered --evidence .drever/review --json");
    expect(createDeckSkill).toMatch(/single owner[^.]*exhaustive\s+rendered completion gate/iu);
    expect(createDeckSkill).toMatch(/one\s+production build[^.]*requested PDF export/iu);
  });

  it("keeps editing, review, and delivery ownership unambiguous", () => {
    expect(createDeckSkill).toMatch(
      /\*\*Edit:\*\*[^]*use the project-local `drever-author-deck`/iu,
    );
    expect(createDeckSkill).toMatch(/do not require a\s+new-plan approval gate/iu);
    expect(createDeckSkill).toMatch(
      /bounded semantic pass[^.]*Draft 1 before starting design research or\s+refinement/iu,
    );

    for (const skill of [createDeckSkill, createDesignSkill, authorDeckSkill, deliverDeckSkill]) {
      expect(skill).not.toContain("drever check --rendered --json");
    }
    expect(reviewDeckSkill).toMatch(/single owner[^.]*exhaustive rendered completion gate/iu);
    expect(deliverDeckSkill).toMatch(/Reuse review evidence[^.]*when no source/iu);
    expect(deliverDeckSkill).toMatch(/input changed[^.]*run the review skill again/iu);

    for (const skill of [
      createDeckSkill,
      createDesignSkill,
      authorDeckSkill,
      reviewDeckSkill,
      deliverDeckSkill,
    ]) {
      expect(skill).toMatch(/mutation invalidates[^.]*evidence/iu);
      expect(skill).toMatch(/Never (?:hand off or )?cite\s+stale\s+evidence/iu);
    }
  });

  it("preserves the approved visual foundation across generation and refinement", () => {
    expect(prompt).toMatch(/official designs[^.]*reference studies[^.]*never automatic presets/iu);
    expect(prompt).toMatch(/custom direction[^.]*replaces\s+starter paint/iu);
    expect(prompt).toMatch(/configured canvas and safe area/iu);
    expect(prompt).toMatch(/stable preview before\s+research or browser automation/iu);
    expect(prompt).toMatch(/not generic browser control/iu);

    expect(createDeckSkill).toContain("<!-- drever-visual-foundation-contract:v1 -->");
    expect(createDesignSkill).toContain("<!-- drever-visual-foundation-contract:v1 -->");
    expect(createDeckSkill).toMatch(/never substitute\s+1920 × 1080/iu);
    expect(createDesignSkill).toMatch(/custom[^.]*owns the complete presentation surface/iu);
    expect(createDesignSkill).toMatch(/inherited\s+blue rail/iu);
    expect(authorDeckSkill).toMatch(/last-known-good visual checkpoint/iu);
    expect(reviewDeckSkill).toMatch(/blocking contract drift/iu);
  });

  it("carries the approved plan through design, authoring, and review", () => {
    expect(createDesignSkill).toMatch(/approved `drever\.plan\.json`/iu);
    expect(createDesignSkill).toMatch(
      /planned focal\s+artifact, composition recipe, density choice, and motion owner/iu,
    );
    expect(authorDeckSkill).toMatch(/preserve its ordered planning labels, narrative jobs/iu);
    expect(authorDeckSkill).toMatch(/compiled slide identity remains positional/iu);
    expect(reviewDeckSkill).toMatch(/text overlap, direct scroll overflow/iu);
    expect(reviewDeckSkill).toMatch(/compare every planned narrative job/iu);
    expect(reviewDeckSkill).toMatch(/resolved solid-color contrast failures/iu);
    expect(reviewDeckSkill).toMatch(/indeterminate-paint warnings/iu);
  });
});

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

const wordCount = (source: string): number => source.trim().split(/\s+/u).length;

describe("public bootstrap prompt", () => {
  it("delegates quickly to the installed version-matched workflow", () => {
    expect(wordCount(prompt)).toBeLessThan(450);
    expect(prompt).toMatch(/Follow these instructions now[^.]*do not merely summarize/iu);
    expect(prompt).toMatch(/project-local\s+`drever-create-deck` skill/iu);
    expect(prompt).toMatch(/When scaffolding is required/iu);
    expect(prompt).toMatch(/no project-local adapter[^.]*drever agent sync/iu);
    expect(prompt).toMatch(/generated project contract is authoritative/iu);
    expect(prompt).toMatch(/do not search the\s+Drever repository/iu);
    expect(prompt).toContain("`node_modules`");
    expect(prompt).not.toMatch(/drever-(?:briefing|plan-review|preview)-contract/iu);
    expect(prompt).not.toMatch(/topic-fingerprint|usable inner silhouette|MotionGroup/iu);
  });

  it("keeps the adaptive interview in one canonical skill", () => {
    expect(createDeckSkill).toContain("<!-- drever-authoring-scope-contract:v2 -->");
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
    expect(createDeckSkill).toContain("<!-- drever-plan-review-contract:v2 -->");
    expect(createDeckSkill).toContain("`brief.md`");
    expect(createDeckSkill).toContain("`drever.plan.json`");
    expect(createDeckSkill).toMatch(/stable lowercase hyphenated id/iu);
    expect(createDeckSkill).toMatch(/narrative job/iu);
    expect(createDeckSkill).toMatch(/evidence and one focal artifact/iu);
    expect(createDeckSkill).toMatch(/composition recipe/iu);
    expect(createDeckSkill).toMatch(/motion[^.]*named intent, purpose, and single owner/iu);
    expect(createDeckSkill).toMatch(/check --json[^.]*before presenting/iu);
    expect(createDeckSkill).toMatch(/invite edits or explicit approval, and stop/iu);
    expect(createDeckSkill).toMatch(/After explicit approval,\s+mark\s+both files approved/iu);
    expect(createDeckSkill).toMatch(/skip-remaining escape does not bypass this gate/iu);
  });

  it("separates first preview, deterministic checks, and human visual judgment", () => {
    expect(createDeckSkill).toContain("<!-- drever-preview-contract:v3 -->");
    expect(createDeckSkill).toMatch(/coherent Draft 1 with every planned\s+slide/iu);
    expect(createDeckSkill).toMatch(/first and last slides open/iu);
    expect(createDeckSkill).toMatch(/continue in the same turn/iu);
    expect(createDeckSkill).toMatch(/feedback invalidates stale checks/iu);
    expect(createDeckSkill).toMatch(/never invent or guess a preview address/iu);
    expect(createDeckSkill).toContain("drever check --rendered --json");
    expect(createDeckSkill).toMatch(/machine-proven error/iu);
    expect(createDeckSkill).toMatch(/production build only after[^.]*preview is stable/iu);
    expect(createDeckSkill).toMatch(/Export PDF only when requested/iu);
  });

  it("carries the approved plan through design, authoring, and review", () => {
    expect(createDesignSkill).toMatch(/approved `drever\.plan\.json`/iu);
    expect(createDesignSkill).toMatch(
      /planned focal\s+artifact, composition recipe, density choice, and motion owner/iu,
    );
    expect(authorDeckSkill).toMatch(/preserve its ordered planning labels, narrative jobs/iu);
    expect(authorDeckSkill).toMatch(/compiled slide identity remains positional/iu);
    expect(authorDeckSkill).toMatch(/text overlap, direct scroll overflow/iu);
    expect(reviewDeckSkill).toMatch(/compare every planned narrative job/iu);
    expect(reviewDeckSkill).toMatch(/resolved solid-color contrast failures/iu);
    expect(reviewDeckSkill).toMatch(/indeterminate-paint warnings/iu);
  });
});

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createStoryboardPlanReader } from "./storyboard-plan-plugin.ts";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

const approvedPlan = {
  version: 1,
  status: "awaiting-approval",
  brief: {
    topic: "Why black holes are not cosmic vacuum cleaners",
    audience: "Curious high-school students",
    desiredChange: "Replace a familiar myth with a useful mental model",
    durationMinutes: 12,
    language: "en",
    density: "concise",
  },
  slides: [
    {
      id: "the-myth",
      job: "opening",
      title: "A black hole is not a vacuum cleaner",
      purpose: "Name the misconception before replacing it.",
      evidence: ["Gravity depends on mass and distance."],
      focalArtifact: "A Sun-to-black-hole orbit comparison",
      composition: { recipe: "comparison" },
      density: "concise",
      motion: {
        intent: "compare",
        purpose: "Keep the orbit fixed while the central object changes.",
        owner: "orbit-comparison",
      },
    },
  ],
} as const;

describe("storyboard plan reader", () => {
  it("represents a project before the planning interview has produced a plan", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-storyboard-reader-"));
    directories.push(root);

    await expect(createStoryboardPlanReader(root).read()).resolves.toEqual({
      diagnostics: [],
      revision: 1,
      status: "missing",
    });
  });

  it("maps an approval-ready plan to the visual storyboard contract", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-storyboard-reader-"));
    directories.push(root);
    await writeFile(join(root, "drever.plan.json"), JSON.stringify(approvedPlan), "utf8");

    await expect(createStoryboardPlanReader(root).read()).resolves.toMatchObject({
      diagnostics: [{ code: "DREVER_PLAN_AWAITING_APPROVAL", severity: "warning" }],
      plan: approvedPlan,
      revision: 1,
      status: "ready",
    });
  });

  it("keeps the last valid cards visible while a plan write is temporarily invalid", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-storyboard-reader-"));
    directories.push(root);
    const path = join(root, "drever.plan.json");
    const reader = createStoryboardPlanReader(root);
    await writeFile(path, JSON.stringify(approvedPlan), "utf8");
    await reader.read();
    await writeFile(path, '{"version":1,"status":', "utf8");

    await expect(reader.read()).resolves.toMatchObject({
      diagnostics: [{ code: "DREVER_PLAN_JSON_INVALID", severity: "error" }],
      plan: approvedPlan,
      revision: 2,
      status: "invalid",
    });
  });
});

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DREVER_DECK_PLAN_VERSION, validateDreverDeckPlanValue } from "@drever/schema";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { DREVER_DECK_PLAN_FILE, loadDreverDeckPlan } from "./deck-plan.ts";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

const createRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "drever-plan-test-"));
  directories.push(root);
  return root;
};

const plan = (status: "approved" | "awaiting-approval" = "approved") => ({
  version: DREVER_DECK_PLAN_VERSION,
  status,
  brief: {
    topic: "Why black holes are not cosmic vacuum cleaners",
    audience: "Curious adults",
    desiredChange: "Replace a common misconception with a useful mental model",
    durationMinutes: 12,
    language: "en",
    density: "balanced",
  },
  slides: [
    {
      id: "opening-question",
      job: "opening",
      title: "A black hole is not a vacuum cleaner",
      purpose: "Surface the familiar misconception.",
      evidence: ["A comparison with an equal-mass star"],
      focalArtifact: "An orbit that remains stable",
      composition: { recipe: "single-artifact", variant: "dark-field" },
      density: "concise",
      motion: {
        intent: "compare",
        purpose: "Keep the orbit fixed while the central object changes.",
        owner: "orbit",
      },
    },
  ],
});

const writePlan = async (root: string, value: unknown): Promise<string> => {
  const path = join(root, DREVER_DECK_PLAN_FILE);
  await writeFile(path, JSON.stringify(value, null, 2));
  return path;
};

describe("loadDreverDeckPlan", () => {
  it("keeps the plan optional for existing projects", async () => {
    const root = await createRoot();

    await expect(loadDreverDeckPlan({ root, slideCount: 1 })).resolves.toEqual({
      path: join(root, DREVER_DECK_PLAN_FILE),
      diagnostics: [],
    });
  });

  it("loads a valid approved plan", async () => {
    const root = await createRoot();
    await writePlan(root, plan());

    const result = await loadDreverDeckPlan({ root, slideCount: 1 });

    expect(result.diagnostics).toEqual([]);
    expect(result.plan).toEqual(plan());
  });

  it("validates every nested V1 field through the shared schema contract", () => {
    const result = validateDreverDeckPlanValue({
      version: DREVER_DECK_PLAN_VERSION,
      status: "approved",
      unknown: true,
      brief: {
        topic: "",
        audience: 42,
        durationMinutes: 0,
        language: "not a language",
        density: "dense",
        unknown: true,
      },
      slides: [
        {
          id: "Opening Question",
          job: "decoration",
          title: "",
          evidence: ["", 42],
          focalArtifact: "",
          composition: { recipe: "", variant: 42, unknown: true },
          density: "dense",
          motion: { intent: "fly", purpose: "", owner: "", unknown: true },
          unknown: true,
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected an invalid deck plan.");
    expect(result.issues.map(({ field }) => field)).toEqual(
      expect.arrayContaining([
        "unknown",
        "brief.unknown",
        "brief.topic",
        "brief.audience",
        "brief.desiredChange",
        "brief.durationMinutes",
        "brief.language",
        "brief.density",
        "slides[0].unknown",
        "slides[0].id",
        "slides[0].job",
        "slides[0].title",
        "slides[0].purpose",
        "slides[0].evidence[0]",
        "slides[0].evidence[1]",
        "slides[0].focalArtifact",
        "slides[0].composition.unknown",
        "slides[0].composition.recipe",
        "slides[0].composition.variant",
        "slides[0].density",
        "slides[0].motion.unknown",
        "slides[0].motion.intent",
        "slides[0].motion.purpose",
        "slides[0].motion.owner",
      ]),
    );
  });

  it("reports missing fields once without inventing secondary type failures", () => {
    const result = validateDreverDeckPlanValue({});

    expect(result).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({ code: "DREVER_PLAN_FIELD_REQUIRED", field: "version" }),
        expect.objectContaining({ code: "DREVER_PLAN_FIELD_REQUIRED", field: "status" }),
        expect.objectContaining({ code: "DREVER_PLAN_FIELD_REQUIRED", field: "brief" }),
        expect.objectContaining({ code: "DREVER_PLAN_FIELD_REQUIRED", field: "slides" }),
      ],
    });
  });

  it("rejects duplicate stable slide IDs in the shared schema contract", () => {
    const value = plan();
    const result = validateDreverDeckPlanValue({
      ...value,
      slides: [value.slides[0], { ...value.slides[0] }],
    });

    expect(result).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: "DREVER_PLAN_SLIDE_ID_DUPLICATE" })],
    });
  });

  it("rejects non-JSON values instead of accepting structurally incomplete objects", () => {
    expect(validateDreverDeckPlanValue(undefined)).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ field: "$" })],
    });

    const value = plan();
    expect(
      validateDreverDeckPlanValue({
        ...value,
        slides: [undefined],
      }),
    ).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ field: "slides[0]" })],
    });
  });

  it("accepts a minimal scaffold plan while awaiting input", async () => {
    const root = await createRoot();
    await writePlan(root, {
      version: DREVER_DECK_PLAN_VERSION,
      status: "awaiting-input",
    });

    const result = await loadDreverDeckPlan({ root, slideCount: 1 });

    expect(result.plan).toEqual({
      version: DREVER_DECK_PLAN_VERSION,
      status: "awaiting-input",
    });
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["DREVER_PLAN_AWAITING_INPUT"]);
  });

  it("does not compare an awaiting-approval plan with the scaffold deck", async () => {
    const root = await createRoot();
    await writePlan(root, {
      ...plan("awaiting-approval"),
      slides: [plan().slides[0], { ...plan().slides[0], id: "closing-decision" }],
    });

    const result = await loadDreverDeckPlan({ root, slideCount: 1 });

    expect(result.plan?.status).toBe("awaiting-approval");
    if (result.plan?.status !== "awaiting-approval") throw new Error("Expected a reviewable plan.");
    expect(result.plan.slides).toHaveLength(2);
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["DREVER_PLAN_AWAITING_APPROVAL"]);
  });

  it("reports strict field errors against the plan source without throwing", async () => {
    const root = await createRoot();
    const path = await writePlan(root, {
      ...plan(),
      brief: { ...plan().brief, language: "not a language", mystery: true },
      slides: [{ ...plan().slides[0], id: "Opening Question" }],
    });

    const result = await loadDreverDeckPlan({ root, slideCount: 1 });

    expect(result.plan).toBeUndefined();
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "DREVER_PLAN_FIELD_UNKNOWN",
          source: expect.objectContaining({ path }),
          details: { field: "brief.mystery" },
        }),
        expect.objectContaining({
          code: "DREVER_PLAN_SLIDE_ID_INVALID",
          details: { field: "slides[0].id" },
        }),
      ]),
    );
  });

  it("reports malformed JSON and approved slide-count drift as diagnostics", async () => {
    const malformedRoot = await createRoot();
    const malformedPath = join(malformedRoot, DREVER_DECK_PLAN_FILE);
    await writeFile(malformedPath, "{\n  invalid\n}");
    const mismatchRoot = await createRoot();
    await writePlan(mismatchRoot, plan());

    const malformed = await loadDreverDeckPlan({ root: malformedRoot });
    const mismatch = await loadDreverDeckPlan({ root: mismatchRoot, slideCount: 2 });

    expect(malformed.diagnostics[0]).toMatchObject({
      code: "DREVER_PLAN_JSON_INVALID",
      source: { path: malformedPath },
    });
    expect(mismatch.plan).toBeUndefined();
    expect(mismatch.diagnostics[0]).toMatchObject({
      code: "DREVER_PLAN_SLIDE_COUNT_MISMATCH",
      details: { field: "slides" },
    });
  });
});

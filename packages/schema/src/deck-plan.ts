import type { MotionIntent } from "./extension.ts";

export const DREVER_DECK_PLAN_LEGACY_VERSION = 1 as const;
export const DREVER_DECK_PLAN_VERSION = 2 as const;

export type DreverDeckPlanStatus = "awaiting-input" | "awaiting-approval" | "approved";

export type DreverDeckPlanDensity = "concise" | "balanced" | "detailed";

export type DreverDeckPlanSlideJob =
  | "opening"
  | "section"
  | "context"
  | "claim"
  | "explanation"
  | "evidence"
  | "comparison"
  | "process"
  | "demo"
  | "decision"
  | "close";

export type DreverDeckPlanBrief = Readonly<{
  topic: string;
  audience: string;
  desiredChange: string;
  durationMinutes: number;
  language: string;
  density: DreverDeckPlanDensity;
}>;

/** @deprecated V1 stored composition in the Storyboard. V2 defers it until design authoring. */
export type DreverDeckPlanComposition = Readonly<{
  recipe: string;
  variant?: string;
}>;

/** @deprecated V1 stored motion in the Storyboard. V2 defers it until design authoring. */
export type DreverDeckPlanMotion = Readonly<{
  intent: MotionIntent;
  purpose: string;
  owner: string;
}>;

export type DreverDeckPlanSlide = Readonly<{
  id: string;
  job: DreverDeckPlanSlideJob;
  title: string;
  purpose: string;
  evidence: readonly string[];
  focalArtifact: string;
}>;

/** @deprecated Read-only compatibility shape for version 1 deck plans. */
export type DreverDeckPlanSlideV1 = DreverDeckPlanSlide &
  Readonly<{
    density: DreverDeckPlanDensity;
    composition: DreverDeckPlanComposition;
    motion?: DreverDeckPlanMotion;
  }>;

type DreverDeckPlanAwaitingInput<Version extends number> = Readonly<{
  version: Version;
  status: "awaiting-input";
}>;

type DreverDeckPlanReviewable<Version extends number, Slide> = Readonly<{
  version: Version;
  status: Exclude<DreverDeckPlanStatus, "awaiting-input">;
  brief: DreverDeckPlanBrief;
  slides: readonly Slide[];
}>;

/** @deprecated Version 1 is accepted for existing projects but is no longer authored. */
export type DreverDeckPlanV1 =
  | DreverDeckPlanAwaitingInput<typeof DREVER_DECK_PLAN_LEGACY_VERSION>
  | DreverDeckPlanReviewable<typeof DREVER_DECK_PLAN_LEGACY_VERSION, DreverDeckPlanSlideV1>;

export type DreverDeckPlanV2 =
  | DreverDeckPlanAwaitingInput<typeof DREVER_DECK_PLAN_VERSION>
  | DreverDeckPlanReviewable<typeof DREVER_DECK_PLAN_VERSION, DreverDeckPlanSlide>;

/** Serializable, ordered story intent written before presentation authoring. */
export type DreverDeckPlan = DreverDeckPlanV1 | DreverDeckPlanV2;

export type DreverDeckPlanValidationIssue = Readonly<{
  code: string;
  field: string;
  message: string;
}>;

export type DreverDeckPlanValidationResult =
  | Readonly<{
      ok: true;
      value: DreverDeckPlan;
      issues: readonly [];
    }>
  | Readonly<{
      ok: false;
      issues: readonly DreverDeckPlanValidationIssue[];
    }>;

type JsonRecord = Record<string, unknown>;

const STATUSES = ["awaiting-input", "awaiting-approval", "approved"] as const;
const DENSITIES = ["concise", "balanced", "detailed"] as const;
const JOBS = [
  "opening",
  "section",
  "context",
  "claim",
  "explanation",
  "evidence",
  "comparison",
  "process",
  "demo",
  "decision",
  "close",
] as const;
const MOTIONS = ["compare", "continuity", "focus", "replace", "stagger"] as const;
const STABLE_ID = /^[a-z][a-z\d]*(?:-[a-z\d]+)*$/u;
const MISSING = Symbol("missing deck-plan field");

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Validates an untrusted value against the current or supported legacy deck-plan contract. */
export const validateDreverDeckPlanValue = (value: unknown): DreverDeckPlanValidationResult => {
  const issues: DreverDeckPlanValidationIssue[] = [];
  const report = (code: string, field: string, message: string): void => {
    issues.push({ code, field, message });
  };
  const invalid = (field: string, expectation: string, code = "DREVER_PLAN_FIELD_INVALID"): void =>
    report(code, field, `${field} must be ${expectation}.`);
  const required = (owner: JsonRecord, key: string, parent = "$"): unknown => {
    if (Object.hasOwn(owner, key)) return owner[key];
    const field = parent === "$" ? key : `${parent}.${key}`;
    report("DREVER_PLAN_FIELD_REQUIRED", field, `${field} is required.`);
    return MISSING;
  };
  const object = (candidate: unknown, field: string): JsonRecord | undefined => {
    if (candidate === MISSING) return;
    if (isRecord(candidate)) return candidate;
    invalid(field, "an object");
  };
  const text = (candidate: unknown, field: string): string | undefined => {
    if (candidate === MISSING) return;
    if (typeof candidate === "string" && candidate.trim() !== "") return candidate;
    invalid(field, "a non-empty string");
  };
  const choice = <Value extends string>(
    candidate: unknown,
    field: string,
    choices: readonly Value[],
  ): Value | undefined => {
    if (candidate === MISSING) return;
    if (typeof candidate === "string" && choices.includes(candidate as Value)) {
      return candidate as Value;
    }
    invalid(field, `one of: ${choices.join(", ")}`);
  };
  const exactKeys = (owner: JsonRecord, field: string, keys: readonly string[]): void => {
    for (const key of Object.keys(owner)) {
      if (keys.includes(key)) continue;
      const child = field === "$" ? key : `${field}.${key}`;
      report("DREVER_PLAN_FIELD_UNKNOWN", child, `${child} is not supported.`);
    }
  };

  if (!isRecord(value)) {
    invalid("$", "an object");
    return { ok: false, issues };
  }
  const root = value;
  const version = required(root, "version");
  const supportedVersion =
    version === DREVER_DECK_PLAN_VERSION || version === DREVER_DECK_PLAN_LEGACY_VERSION;
  if (version !== MISSING && !supportedVersion) {
    report(
      "DREVER_PLAN_VERSION_UNSUPPORTED",
      "version",
      `drever.plan.json must use version ${String(DREVER_DECK_PLAN_VERSION)} or supported legacy version ${String(DREVER_DECK_PLAN_LEGACY_VERSION)}.`,
    );
  }
  const legacy = version === DREVER_DECK_PLAN_LEGACY_VERSION;
  const status = choice(required(root, "status"), "status", STATUSES);
  exactKeys(
    root,
    "$",
    status === "awaiting-input" ? ["version", "status"] : ["version", "status", "brief", "slides"],
  );
  if (status === "awaiting-input") {
    return issues.length === 0
      ? { ok: true, value: value as DreverDeckPlan, issues: [] }
      : { ok: false, issues };
  }

  const brief = object(required(root, "brief"), "brief");
  if (brief !== undefined) {
    exactKeys(brief, "brief", [
      "topic",
      "audience",
      "desiredChange",
      "durationMinutes",
      "language",
      "density",
    ]);
    text(required(brief, "topic", "brief"), "brief.topic");
    text(required(brief, "audience", "brief"), "brief.audience");
    text(required(brief, "desiredChange", "brief"), "brief.desiredChange");
    const duration = required(brief, "durationMinutes", "brief");
    if (
      duration !== MISSING &&
      !(typeof duration === "number" && Number.isFinite(duration) && duration > 0)
    ) {
      invalid("brief.durationMinutes", "a positive number");
    }
    const language = text(required(brief, "language", "brief"), "brief.language");
    if (language !== undefined) {
      try {
        Intl.getCanonicalLocales(language);
      } catch {
        invalid("brief.language", "a valid BCP 47 language tag");
      }
    }
    choice(required(brief, "density", "brief"), "brief.density", DENSITIES);
  }

  const slidesValue = required(root, "slides");
  const slides = Array.isArray(slidesValue) ? slidesValue : undefined;
  if (slidesValue !== MISSING && slides === undefined) invalid("slides", "an array");
  else if (slides?.length === 0) invalid("slides", "a non-empty array");

  const ids: string[] = [];
  for (const [index, candidate] of (slides ?? []).entries()) {
    const field = `slides[${String(index)}]`;
    const slide = object(candidate, field);
    if (slide === undefined) continue;
    const slideKeys = [
      "id",
      "job",
      "title",
      "purpose",
      "evidence",
      "focalArtifact",
      ...(legacy ? ["density", "composition", "motion"] : []),
    ];
    exactKeys(slide, field, slideKeys);
    const id = text(required(slide, "id", field), `${field}.id`);
    if (id !== undefined) {
      ids.push(id);
      if (!STABLE_ID.test(id)) {
        invalid(`${field}.id`, "a stable lower-kebab-case id", "DREVER_PLAN_SLIDE_ID_INVALID");
      }
    }
    choice(required(slide, "job", field), `${field}.job`, JOBS);
    text(required(slide, "title", field), `${field}.title`);
    text(required(slide, "purpose", field), `${field}.purpose`);
    const evidence = required(slide, "evidence", field);
    if (evidence !== undefined && (!Array.isArray(evidence) || evidence.length === 0)) {
      invalid(`${field}.evidence`, "a non-empty array");
    } else if (Array.isArray(evidence)) {
      evidence.forEach((item, itemIndex) => text(item, `${field}.evidence[${String(itemIndex)}]`));
    }
    text(required(slide, "focalArtifact", field), `${field}.focalArtifact`);
    if (legacy) {
      const composition = object(required(slide, "composition", field), `${field}.composition`);
      if (composition !== undefined) {
        exactKeys(composition, `${field}.composition`, ["recipe", "variant"]);
        text(
          required(composition, "recipe", `${field}.composition`),
          `${field}.composition.recipe`,
        );
        if (Object.hasOwn(composition, "variant")) {
          text(composition.variant, `${field}.composition.variant`);
        }
      }
    }
    if (legacy) choice(required(slide, "density", field), `${field}.density`, DENSITIES);
    if (legacy && Object.hasOwn(slide, "motion")) {
      const motion = object(slide.motion, `${field}.motion`);
      if (motion !== undefined) {
        exactKeys(motion, `${field}.motion`, ["intent", "purpose", "owner"]);
        choice(required(motion, "intent", `${field}.motion`), `${field}.motion.intent`, MOTIONS);
        text(required(motion, "purpose", `${field}.motion`), `${field}.motion.purpose`);
        text(required(motion, "owner", `${field}.motion`), `${field}.motion.owner`);
      }
    }
  }
  for (const id of new Set(ids.filter((item, index) => ids.indexOf(item) !== index))) {
    report(
      "DREVER_PLAN_SLIDE_ID_DUPLICATE",
      "slides",
      `Slide id ${JSON.stringify(id)} is duplicated.`,
    );
  }

  return issues.length === 0
    ? { ok: true, value: value as DreverDeckPlan, issues: [] }
    : { ok: false, issues };
};

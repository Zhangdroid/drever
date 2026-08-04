import { DREVER_DECK_PLAN_VERSION, type DreverDeckPlan } from "@drever/schema";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { Storyboard, type StoryboardState } from "./storyboard.tsx";

const plan = {
  version: DREVER_DECK_PLAN_VERSION,
  status: "awaiting-approval",
  brief: {
    topic: "Why black holes are not cosmic vacuum cleaners",
    audience: "Curious high-school students",
    desiredChange: "Replace a familiar myth with an accurate mental model.",
    durationMinutes: 12,
    language: "en",
    density: "balanced",
  },
  slides: [
    {
      id: "opening-question",
      job: "opening",
      title: "What would happen to Earth if the Sun became a black hole?",
      purpose: "Surface the misconception before correcting it.",
      evidence: [
        "Earth follows the same orbit when the central mass stays constant.",
        "The loss of sunlight is catastrophic, but gravity does not suddenly intensify.",
      ],
      focalArtifact: "A paired orbital diagram with equal paths and different light.",
      composition: { recipe: "split-proof", variant: "orbit" },
      density: "concise",
      motion: {
        intent: "compare",
        purpose: "Keep the orbit fixed while the star changes into a black hole.",
        owner: "orbit-model",
      },
    },
    {
      id: "closing-model",
      job: "close",
      title: "Mass shapes the path. Distance sets the danger.",
      purpose: "Leave the audience with a reusable explanation.",
      evidence: ["A black hole attracts like any object with the same mass at the same distance."],
      focalArtifact: "One sentence beside a restrained gravity well.",
      composition: { recipe: "statement" },
      density: "concise",
    },
  ],
} as const satisfies DreverDeckPlan;

const render = (state: StoryboardState): string =>
  renderToStaticMarkup(<Storyboard state={state} />);

describe("Storyboard", () => {
  it("renders the complete ordered story contract without presentation runtime content", () => {
    const markup = render({ diagnostics: [], plan, revision: 1, status: "waiting" });

    expect(markup).toContain("Structure preview—not final design.");
    expect(markup).toContain("Awaiting approval");
    expect(markup).toContain("Curious high-school students");
    expect(markup).toContain("Replace a familiar myth with an accurate mental model.");
    expect(markup).toContain("12 min");
    expect(markup).toContain("2 slides");
    expect(markup).toContain('data-storyboard-state="waiting"');
    expect(markup).toContain('data-storyboard-slide="opening-question"');
    expect(markup).toContain("What would happen to Earth if the Sun became a black hole?");
    expect(markup).toContain("Surface the misconception before correcting it.");
    expect(markup).toContain("Earth follows the same orbit when the central mass stays constant.");
    expect(markup).toContain("A paired orbital diagram with equal paths and different light.");
    expect(markup).toContain("split-proof · orbit");
    expect(markup).toContain("Motion · Compare · owner orbit-model");
    expect(markup).toContain("Keep the orbit fixed while the star changes into a black hole.");
    expect(markup).toContain("None planned");
    expect(markup.match(/data-storyboard-slide/g)).toHaveLength(2);
  });

  it("keeps expected briefing diagnostics out of the repair surface", () => {
    const markup = render({
      diagnostics: [
        {
          code: "DREVER_PLAN_AWAITING_INPUT",
          message: "The brief is waiting for an audience.",
          severity: "warning",
        },
      ],
      plan: { version: DREVER_DECK_PLAN_VERSION, status: "awaiting-input" },
      revision: 2,
      status: "waiting",
    });

    expect(markup).toContain("The briefing is still taking shape.");
    expect(markup).toContain('data-storyboard-state="waiting"');
    expect(markup).not.toContain("The plan needs a small repair");
    expect(markup).not.toContain("DREVER_PLAN_AWAITING_INPUT");
  });

  it("shows every invalid-plan diagnostic beside the last valid structure", () => {
    const markup = render({
      diagnostics: [
        {
          code: "DREVER_PLAN_FIELD_REQUIRED",
          hint: "Add a stable slide id.",
          message: "slides[1].id is required.",
          severity: "error",
        },
      ],
      plan,
      revision: 3,
      status: "invalid",
    });

    expect(markup).toContain("Showing the last valid structure");
    expect(markup).toContain("The plan needs a small repair");
    expect(markup).toContain("slides[1].id is required.");
    expect(markup).toContain("Add a stable slide id.");
    expect(markup).toContain("DREVER_PLAN_FIELD_REQUIRED");
    expect(markup).toContain('data-storyboard-state="invalid"');
    expect(markup).toContain('data-storyboard-slide="closing-model"');
  });

  it("distinguishes a missing plan from a plan that is still waiting", () => {
    const missing = render({ diagnostics: [], revision: 4, status: "missing" });
    const waiting = render({ diagnostics: [], revision: 5, status: "waiting" });

    expect(missing).toContain("No story plan yet.");
    expect(missing).toContain("Create drever.plan.json");
    expect(waiting).toContain("The briefing is still taking shape.");
    expect(waiting).toContain("Answer the remaining briefing questions.");
  });

  it("reports plan approval independently from the transport state", () => {
    const awaiting = render({ diagnostics: [], plan, revision: 6, status: "ready" });
    const approved = render({
      diagnostics: [],
      plan: { ...plan, status: "approved" },
      revision: 7,
      status: "ready",
    });

    expect(awaiting).toContain("Awaiting approval");
    expect(awaiting).not.toContain("Approved structure");
    expect(awaiting).toContain("Approve it there or request changes");
    expect(approved).toContain("Approved structure");
    expect(approved).toContain("The story contract is approved.");
  });
});

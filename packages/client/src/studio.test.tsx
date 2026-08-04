import {
  DREVER_DECK_PLAN_VERSION,
  DREVER_STUDIO_PROTOCOL_VERSION,
  type DreverDeckPlan,
  type DreverStudioQuestion,
  type DreverStudioState,
} from "@drever/schema";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  hydrateStudioAnswerDrafts,
  nextStudioMode,
  resolveStudioAnswers,
  resolveStudioDuration,
  Studio,
  type StudioProps,
  submitStudioBrief,
} from "./studio.tsx";

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
      title: "What if the Sun became a black hole?",
      purpose: "Surface the misconception before correcting it.",
      evidence: ["The orbit depends on mass and distance."],
      focalArtifact: "Two equal orbital paths around different central objects.",
      composition: { recipe: "split-proof", variant: "orbit" },
      density: "concise",
      motion: {
        intent: "compare",
        purpose: "Keep the orbit fixed while the central object changes.",
        owner: "orbit-model",
      },
    },
    {
      id: "closing-model",
      job: "close",
      title: "Mass shapes the path. Distance sets the danger.",
      purpose: "Leave the room with a reusable model.",
      evidence: ["Gravity does not become a vacuum cleaner."],
      focalArtifact: "One sentence beside a restrained gravity well.",
      composition: { recipe: "statement" },
      density: "concise",
    },
  ],
} as const satisfies DreverDeckPlan;

const adaptiveQuestions = [
  {
    id: "starting-model",
    prompt: "Which misconception should the opening reveal?",
    options: [
      {
        id: "vacuum",
        label: "Cosmic vacuum",
        description: "Begin with the familiar suction metaphor.",
        recommended: true,
      },
      {
        id: "infinite-gravity",
        label: "Infinite gravity",
        description: "Begin with the idea that distance no longer matters.",
      },
    ],
  },
] as const satisfies readonly DreverStudioQuestion[];

const state = (value: Partial<DreverStudioState>): DreverStudioState => ({
  version: DREVER_STUDIO_PROTOCOL_VERSION,
  revision: 1,
  phase: "briefing",
  agentConnected: false,
  latestActionRevision: 0,
  pendingActionCount: 0,
  ...value,
});

const render = (value: DreverStudioState): string =>
  renderToStaticMarkup(
    <Studio audienceUrl="http://127.0.0.1:4317/" onAction={vi.fn()} state={value} />,
  );

describe("Studio", () => {
  it("starts with one focused common brief and an explicit skip path", () => {
    const markup = render(state({}));

    expect(markup).toContain("What should this presentation help people understand—or do?");
    expect(markup).toContain("Presentation topic");
    expect(markup).toContain("Information density");
    expect(markup).toContain("Motion direction");
    expect(markup).toContain("After the presentation");
    expect(markup).toContain("No local agent is active.");
    expect(markup).toContain('aria-label="Custom duration in minutes"');
    expect(markup).toContain("Skip the rest — surprise me");
    expect(markup).toContain('data-studio-phase="briefing"');
  });

  it("removes the offline notice when the local agent lease is active", () => {
    const markup = render(state({ agentConnected: true }));

    expect(markup).toContain("Local agent active recently");
    expect(markup).not.toContain("No local agent is active.");
  });

  it("does not pretend disconnected queued work is already running", () => {
    const markup = render(
      state({
        phase: "waiting-for-agent",
        commonBrief: { topic: "A deliberate subject" },
      }),
    );

    expect(markup).toContain("Request saved locally");
    expect(markup).toContain("Nothing is running inside Studio itself.");
    expect(markup).not.toContain("Reading the room");
    expect(markup).not.toContain("Your agent is turning");
  });

  it("hydrates an arbitrary duration in the custom minutes field", () => {
    const markup = render(
      state({
        commonBrief: { durationMinutes: 45, topic: "A deliberate subject" },
      }),
    );

    expect(markup).toContain('aria-label="Custom duration in minutes"');
    expect(markup).toContain('value="45"');
  });

  it("renders topic-specific questions supplied by the connected agent", () => {
    const markup = render(
      state({
        phase: "adaptive-questions",
        commonBrief: { topic: "Why black holes are not cosmic vacuum cleaners" },
        adaptiveQuestions,
      }),
    );

    expect(markup).toContain("A few choices that genuinely change this deck.");
    expect(markup).toContain("Which misconception should the opening reveal?");
    expect(markup).toContain("Cosmic vacuum");
    expect(markup).toContain("Recommended");
    expect(markup).toContain("Skip remaining questions");
  });

  it("shows the complete plan, scoped feedback, and explicit approval before authoring", () => {
    const markup = render(
      state({
        phase: "plan-review",
        commonBrief: {
          topic: plan.brief.topic,
          audience: plan.brief.audience,
          desiredChange: plan.brief.desiredChange,
        },
        plan,
      }),
    );

    expect(markup).toContain("Structure preview");
    expect(markup).toContain("What if the Sun became a black hole?");
    expect(markup).toContain("Mass shapes the path. Distance sets the danger.");
    expect(markup).toContain("Entire deck");
    expect(markup).toContain("What should change?");
    expect(markup).toContain("Approve and create Draft 1");
    expect(markup).not.toContain("Live Drever draft");
  });

  it("renders agent errors instead of leaving a green waiting surface", () => {
    const markup = render(
      state({
        phase: "error",
        commonBrief: { topic: plan.brief.topic },
        message: "The agent could not validate Draft 1.",
        plan,
      }),
    );

    expect(markup).toContain("Agent needs attention");
    expect(markup).toContain("The draft paused.");
    expect(markup).toContain("The agent could not validate Draft 1.");
    expect(markup).not.toContain("Structure preview");
  });

  it("keeps approval disabled while earlier feedback is waiting for the agent", () => {
    const markup = render(
      state({
        phase: "plan-review",
        commonBrief: { topic: plan.brief.topic },
        pendingActionCount: 1,
        plan,
      }),
    );

    expect(markup).toContain('disabled=""');
    expect(markup).toContain("Waiting for the agent…");
  });

  it("opens an already available draft instead of returning to the storyboard", () => {
    const markup = render(
      state({
        phase: "preview",
        commonBrief: { topic: plan.brief.topic },
        plan: { ...plan, status: "approved" },
      }),
    );

    expect(markup).toContain('title="Live Drever draft"');
    expect(markup).toContain('aria-pressed="true" type="button">Live draft');
  });
});

describe("Studio flow helpers", () => {
  it("accepts a useful custom duration and rejects invalid values", () => {
    expect(resolveStudioDuration("45")).toBe(45);
    expect(resolveStudioDuration(" 90 ")).toBe(90);
    expect(resolveStudioDuration("")).toBeUndefined();
    expect(resolveStudioDuration("0")).toBeUndefined();
    expect(resolveStudioDuration("12.5")).toBeUndefined();
    expect(resolveStudioDuration("1441")).toBeUndefined();
  });

  it("does not skip questions when the common brief was rejected", async () => {
    const onAction = vi
      .fn<StudioProps["onAction"]>()
      .mockRejectedValueOnce(new Error("Choose a topic first."));

    await expect(submitStudioBrief(onAction, { topic: "A useful topic" }, true)).rejects.toThrow(
      "Choose a topic first.",
    );
    expect(onAction).toHaveBeenCalledOnce();
    expect(onAction).toHaveBeenCalledWith({
      brief: { topic: "A useful topic" },
      type: "submit-common-brief",
    });
  });

  it("preserves custom-only answers without turning them into option ids", () => {
    const drafts = hydrateStudioAnswerDrafts(adaptiveQuestions, [
      { questionId: "starting-model", text: "Begin with an orbital thought experiment." },
    ]);

    expect(resolveStudioAnswers(adaptiveQuestions, drafts)).toEqual([
      {
        questionId: "starting-model",
        text: "Begin with an orbital thought experiment.",
      },
    ]);
  });

  it("drops answers from an earlier question round and invalid option ids", () => {
    const nextQuestions = [
      {
        id: "visual-proof",
        prompt: "Which proof should anchor the explanation?",
        options: [
          {
            id: "orbit",
            label: "Orbit",
            description: "Keep the orbit fixed while the center changes.",
          },
        ],
      },
    ] as const satisfies readonly DreverStudioQuestion[];
    const drafts = hydrateStudioAnswerDrafts(nextQuestions, [
      { questionId: "starting-model", optionIds: ["vacuum"] },
      { questionId: "visual-proof", optionIds: ["invalid", "orbit"] },
    ]);

    expect(drafts).toEqual({ "visual-proof": { optionIds: ["orbit"], text: "" } });
    expect(resolveStudioAnswers(nextQuestions, drafts)).toEqual([
      { questionId: "visual-proof", optionIds: ["orbit"] },
    ]);
  });

  it("switches to a draft only when it first becomes available", () => {
    expect(nextStudioMode("storyboard", false, true)).toBe("draft");
    expect(nextStudioMode("storyboard", true, true)).toBe("storyboard");
    expect(nextStudioMode("draft", true, false)).toBe("storyboard");
  });
});

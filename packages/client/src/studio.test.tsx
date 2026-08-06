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
  isStudioPreviewReady,
  latestStudioNarration,
  nextStudioMode,
  readStudioPreviewState,
  resolveStudioAnswers,
  resolveStudioDraftLifecycle,
  resolveStudioDuration,
  resolveStudioProgress,
  respondToStudioAgentApproval,
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
    expect(markup).not.toContain("Experimental");
  });

  it("removes the offline notice when the local agent lease is active", () => {
    const markup = render(state({ agentConnected: true }));

    expect(markup).toContain("Local agent active recently");
    expect(markup).not.toContain("No local agent is active.");
  });

  it("shows the current agent approval without exposing transport internals", () => {
    const markup = render(
      state({
        agentConnected: true,
        agentApprovals: [
          {
            id: "approval-write-storyboard",
            kind: "file-change",
            reason: "Write the approved storyboard",
            detail: "Update the deck source in this project.",
          },
          {
            id: "approval-run-check",
            kind: "command",
            reason: "Verify the draft",
          },
        ],
      }),
    );

    expect(markup).toContain(
      'aria-label="Respond to agent approval" class="drever-studio-agent-approval__actions" role="group"',
    );
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('role="alertdialog"');
    expect(markup).toContain("File change approval");
    expect(markup).toContain("Write the approved storyboard");
    expect(markup).toContain("Update the deck source in this project.");
    expect(markup).toContain("1 more waiting");
    expect(markup).toContain("Allow once");
    expect(markup).toContain("Allow for session");
    expect(markup).toContain("Decline");
  });

  it("shows only approval choices supported by the current agent request", () => {
    const markup = render(
      state({
        agentConnected: true,
        agentApprovals: [
          {
            decisions: ["accept", "cancel"],
            id: "approval-run-check",
            kind: "command",
          },
        ],
      }),
    );

    expect(markup).toContain("Allow once");
    expect(markup).toContain("Cancel");
    expect(markup).not.toContain("Allow for session");
    expect(markup).not.toContain("Decline");
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
    expect(markup).toContain("Brief saved");
    expect(markup).toContain("Waiting for a local agent");
    expect(markup).toContain("Questions ready");
    expect(markup).toContain("Paused");
    expect(markup).not.toContain("No local agent is active.");
    expect(markup).not.toContain("Reading the room");
    expect(markup).not.toContain("Your agent is turning");
  });

  it("shows the connected agent's published activity and measurable progress", () => {
    const markup = render(
      state({
        agentConnected: true,
        commonBrief: { topic: "A deliberate subject" },
        message: "Selecting the decisions that materially change the deck.",
        phase: "waiting-for-agent",
        progress: { completed: 1, label: "Reviewing the submitted brief", total: 3 },
      }),
    );

    expect(markup).toContain("Agent activity");
    expect(markup).toContain("Reviewing the submitted brief");
    expect(markup).toContain("1 of 3");
    expect(markup).toContain('aria-label="Reviewing the submitted brief" max="3" value="1"');
    expect(markup).toContain("Selecting the decisions that materially change the deck.");
    expect(markup).toContain('aria-current="step"');
    expect(markup).toContain('class="drever-studio-activity__current"');
    expect(markup).toContain('<details class="drever-studio-activity-history">');
    expect(markup).not.toContain('<details class="drever-studio-activity-history" open="">');
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
    expect(markup).toContain("Approve story");
    expect(markup).toContain('aria-controls="drever-studio-plan-card-closing-model"');
    expect(markup).toContain('data-studio-slide-id="closing-model"');
    expect(markup).not.toContain("Live Drever draft");
  });

  it("renders an error surface when no reviewable artifact exists", () => {
    const markup = render(
      state({
        phase: "error",
        commonBrief: { topic: plan.brief.topic },
        message: "The agent could not validate Draft 1.",
      }),
    );

    expect(markup).toContain("Agent needs attention");
    expect(markup).toContain("The draft paused.");
    expect(markup).toContain("The agent could not validate Draft 1.");
    expect(markup).toContain("Retry from this brief");
    expect(markup).not.toContain("Live Drever draft");
  });

  it("keeps the last published draft visible when refinement fails", () => {
    const markup = render(
      state({
        draftAvailable: true,
        phase: "error",
        commonBrief: { topic: plan.brief.topic },
        message: "The motion pass stopped before verification.",
        plan: { ...plan, status: "approved" },
      }),
    );

    expect(markup).toContain('title="Live Drever draft"');
    expect(markup).toContain("Refinement paused");
    expect(markup).toContain("The motion pass stopped before verification.");
    expect(markup).toContain("Resume from last draft");
    expect(markup).not.toContain("The draft paused.");
  });

  it("retries the first draft without claiming that an unpublished draft exists", () => {
    const markup = render(
      state({
        phase: "error",
        commonBrief: { topic: plan.brief.topic },
        message: "Draft 1 stopped before its first preview.",
        plan: { ...plan, status: "approved" },
      }),
    );

    expect(markup).toContain("Draft 1 stopped before its first preview.");
    expect(markup).toContain("Retry Draft 1");
    expect(markup).not.toContain("Resume from last draft");
  });

  it("keeps a reviewable plan locked while an earlier request is still being reconciled", () => {
    const markup = render(
      state({
        phase: "plan-review",
        commonBrief: { topic: plan.brief.topic },
        pendingActionCount: 1,
        plan,
      }),
    );

    expect(markup).toContain("Waiting for agent…");
    expect(markup).toMatch(/<button class="drever-studio-approve" disabled=/u);
  });

  it("keeps an older storyboard out of view while new direction is being handled", () => {
    const markup = render(
      state({
        adaptiveAnswers: [{ questionId: "starting-model", optionIds: ["vacuum"] }],
        agentConnected: true,
        commonBrief: { topic: plan.brief.topic },
        pendingActionCount: 1,
        phase: "waiting-for-agent",
        plan: { ...plan, status: "approved" },
      }),
    );

    expect(markup).toContain("Agent activity");
    expect(markup).not.toContain("Live Drever draft");
    expect(markup).not.toContain("What should change?");
  });

  it("shows published activity in the workspace without presenting it as private reasoning", () => {
    const markup = render(
      state({
        agentConnected: true,
        phase: "drafting",
        commonBrief: { topic: plan.brief.topic },
        plan: { ...plan, status: "approved" },
        activity: [
          {
            id: "draft-layout",
            label: "Laying out the evidence slides",
            detail: "The opening and comparison are ready; the closing is next.",
            status: "active",
          },
        ],
      }),
    );

    expect(markup).toContain("Live work in progress");
    expect(markup).toContain("Laying out the evidence slides");
    expect(markup).toContain("Draft 1 is taking shape");
    expect(markup).not.toContain('aria-label="Recent agent activity"');
    expect(markup).not.toContain("chain of thought");
  });

  it("keeps the approved story truthful while the first live draft starts", () => {
    const markup = render(
      state({
        agentConnected: true,
        phase: "waiting-for-agent",
        commonBrief: { topic: plan.brief.topic },
        plan: { ...plan, status: "approved" },
        activity: [
          {
            id: "draft-layout",
            label: "Composing the first draft",
            status: "active",
          },
        ],
        message: "**Pausing briefly**\n**Waiting for tool execution**",
      }),
    );

    expect(markup).toContain("Live work in progress");
    expect(markup).toContain("Draft 1 is taking shape");
    expect(markup).toContain("Composing the first draft");
    expect(markup).toContain("Waiting for tool execution");
    expect(markup).not.toContain("Approve the story before authoring");
    expect(markup).not.toContain("**");
    expect(markup).toContain('disabled="" type="button">Live draft');
    expect(markup).not.toContain('title="Live Drever draft"');
  });

  it("does not mistake an idle connected agent for active draft work", () => {
    const markup = render(
      state({
        agentConnected: true,
        phase: "waiting-for-agent",
        commonBrief: { topic: plan.brief.topic },
        plan: { ...plan, status: "approved" },
        activity: [
          {
            id: "story-approved",
            label: "Storyboard approved",
            status: "complete",
          },
        ],
      }),
    );

    expect(markup).toContain("Waiting for the agent to start Draft 1");
    expect(markup).not.toContain("Live work in progress");
    expect(markup).not.toContain("Storyboard approved · Draft 1 is taking shape");
  });

  it("opens an already available draft instead of returning to the storyboard", () => {
    const markup = renderToStaticMarkup(
      <Studio
        audienceUrl="http://127.0.0.1:4317/"
        onAction={vi.fn()}
        previewUrl="http://127.0.0.1:51999/"
        state={state({
          phase: "preview",
          commonBrief: { topic: plan.brief.topic },
          plan: { ...plan, status: "approved" },
        })}
      />,
    );

    expect(markup).toContain('title="Live Drever draft"');
    expect(markup).toContain('src="http://127.0.0.1:51999/"');
    expect(markup).toContain('sandbox="allow-same-origin allow-scripts"');
    expect(markup).toContain('referrerPolicy="no-referrer"');
    expect(markup).toContain('allow="fullscreen"');
    expect(markup).toContain('allowFullScreen=""');
    expect(markup).toContain("Connecting to speaker notes…");
    expect(markup).not.toContain("allow-top-navigation");
    expect(markup).toContain('href="http://127.0.0.1:4317/"');
    expect(markup).toContain('aria-pressed="true" type="button">Live draft');
  });

  it("keeps a published live draft available while the agent starts another pass", () => {
    const markup = renderToStaticMarkup(
      <Studio
        audienceUrl="http://127.0.0.1:4317/"
        onAction={vi.fn()}
        previewUrl="http://127.0.0.1:51999/"
        state={state({
          draftAvailable: true,
          phase: "drafting",
          commonBrief: { topic: plan.brief.topic },
          plan: { ...plan, status: "approved" },
        })}
      />,
    );

    expect(markup).toContain('title="Live Drever draft"');
    expect(markup).toContain('aria-pressed="true" type="button">Live draft');
    expect(markup).not.toContain('disabled="" type="button">Live draft');
  });

  it("does not infer a draft from refining telemetry without a durable publication", () => {
    const markup = renderToStaticMarkup(
      <Studio
        audienceUrl="http://127.0.0.1:4317/"
        onAction={vi.fn()}
        previewUrl="http://127.0.0.1:51999/"
        state={state({
          phase: "refining",
          commonBrief: { topic: plan.brief.topic },
          plan: { ...plan, status: "approved" },
        })}
      />,
    );

    expect(markup).not.toContain('title="Live Drever draft"');
    expect(markup).toContain('disabled="" type="button">Live draft');
  });
});

describe("Studio flow helpers", () => {
  it("marks Storyboard current until a real plan has been approved", () => {
    const progress = resolveStudioProgress(
      state({
        adaptiveAnswers: [],
        commonBrief: { topic: "A useful topic" },
        phase: "waiting-for-agent",
      }),
    );

    expect(progress).toEqual([
      { label: "Brief", status: "complete" },
      { label: "Direction", status: "complete" },
      { label: "Storyboard", status: "current" },
      { label: "Draft", status: "pending" },
    ]);
  });

  it("does not reuse an older approved storyboard while new direction is pending", () => {
    const progress = resolveStudioProgress(
      state({
        adaptiveAnswers: [{ questionId: "starting-model", optionIds: ["vacuum"] }],
        commonBrief: { topic: "A useful topic" },
        pendingActionCount: 1,
        phase: "waiting-for-agent",
        plan: { ...plan, status: "approved" },
      }),
    );

    expect(progress).toEqual([
      { label: "Brief", status: "complete" },
      { label: "Direction", status: "current" },
      { label: "Storyboard", status: "pending" },
      { label: "Draft", status: "pending" },
    ]);
  });

  it("keeps Direction current while the published plan still asks for input", () => {
    const progress = resolveStudioProgress(
      state({
        commonBrief: { topic: "A useful topic" },
        phase: "waiting-for-agent",
        plan: { ...plan, status: "awaiting-input" },
      }),
    );

    expect(progress).toEqual([
      { label: "Brief", status: "complete" },
      { label: "Direction", status: "current" },
      { label: "Storyboard", status: "pending" },
      { label: "Draft", status: "pending" },
    ]);
  });

  it("marks the last durable stage as failed without erasing completed work", () => {
    const progress = resolveStudioProgress(
      state({
        commonBrief: { topic: plan.brief.topic },
        draftAvailable: true,
        phase: "error",
        plan: { ...plan, status: "approved" },
      }),
    );

    expect(progress.map(({ status }) => status)).toEqual([
      "complete",
      "complete",
      "complete",
      "error",
    ]);
  });

  it("shows the newest safe plain-text narration instead of an accumulated stream", () => {
    expect(latestStudioNarration("Reading the brief.\nChoosing the strongest visual proof.")).toBe(
      "Choosing the strongest visual proof.",
    );
    expect(latestStudioNarration("**Pausing briefly**\n**Waiting for tool execution**")).toBe(
      "Waiting for tool execution",
    );
    expect(latestStudioNarration("> **Checking the rendered deck**")).toBe(
      "Checking the rendered deck",
    );
    expect(latestStudioNarration("1. **Repairing the preview**")).toBe("Repairing the preview");
    expect(latestStudioNarration("```text\nFinished the visual pass.\n```")).toBe(
      "Finished the visual pass.",
    );
    expect(latestStudioNarration("```text\n```")).toBeUndefined();
  });

  it("describes working, reviewable, ready, and failed draft states explicitly", () => {
    expect(resolveStudioDraftLifecycle(state({ phase: "drafting" }))?.title).toBe(
      "Draft 1 is taking shape",
    );
    expect(
      resolveStudioDraftLifecycle(
        state({
          agentConnected: true,
          phase: "waiting-for-agent",
          plan: { ...plan, status: "approved" },
          activity: [{ id: "draft-layout", label: "Drafting", status: "active" }],
        }),
      )?.title,
    ).toBe("Draft 1 is taking shape");
    expect(resolveStudioDraftLifecycle(state({ phase: "preview" }))?.title).toBe(
      "Draft 1 is ready to review",
    );
    expect(resolveStudioDraftLifecycle(state({ phase: "ready" }))?.title).toBe(
      "This pass is ready for your feedback",
    );
    expect(
      resolveStudioDraftLifecycle(state({ draftAvailable: true, phase: "error" }))?.title,
    ).toBe("Refinement paused");
    expect(
      resolveStudioDraftLifecycle(state({ draftAvailable: true, phase: "waiting-for-agent" }))
        ?.title,
    ).toBe("Last published draft is available");
  });

  it("accepts only self-consistent preview bridge state", () => {
    const previewState = {
      type: "drever:studio-preview-state",
      version: 1,
      manifest: {
        version: 2,
        slides: [{ id: "intro", index: 0, speakerNotes: [], stepStops: [] }],
      },
      position: { slideId: "intro", slideIndex: 0, step: 0 },
    } as const;

    expect(readStudioPreviewState(previewState)).toEqual(previewState);
    expect(
      readStudioPreviewState({
        ...previewState,
        position: { slideId: "missing", slideIndex: 0, step: 0 },
      }),
    ).toBeUndefined();
    expect(
      readStudioPreviewState({
        ...previewState,
        manifest: {
          ...previewState.manifest,
          version: 1,
        },
      }),
    ).toBeUndefined();
    expect(
      readStudioPreviewState({
        ...previewState,
        manifest: {
          ...previewState.manifest,
          slides: [
            {
              ...previewState.manifest.slides[0],
              speakerNotes: [{ format: "markdown", plainText: 42, value: "Broken" }],
            },
          ],
        },
      }),
    ).toBeUndefined();
  });

  it("accepts only the versioned child-ready preview handshake", () => {
    expect(isStudioPreviewReady({ type: "drever:studio-preview-ready", version: 1 })).toBe(true);
    expect(isStudioPreviewReady({ type: "drever:studio-preview-ready", version: 2 })).toBe(false);
    expect(isStudioPreviewReady({ type: "drever:studio-preview-state", version: 1 })).toBe(false);
  });

  it("sends every supported agent approval decision through the Studio action boundary", async () => {
    const onAction = vi.fn<StudioProps["onAction"]>();
    const decisions = ["accept", "acceptForSession", "decline", "cancel"] as const;

    for (const decision of decisions) {
      await respondToStudioAgentApproval(onAction, "approval-1", decision);
    }

    expect(onAction.mock.calls.map(([action]) => action)).toEqual(
      decisions.map((decision) => ({
        approvalId: "approval-1",
        decision,
        type: "respond-agent-approval",
      })),
    );
  });

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

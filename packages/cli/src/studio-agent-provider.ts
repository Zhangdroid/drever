import type {
  DreverStudioActionRecord,
  DreverStudioAgentApprovalDecision,
  DreverStudioAgentApprovalKind,
  DreverStudioAgentState,
  DreverStudioPhase,
} from "@drever/schema";
import { resolve } from "node:path";

/** @internal Marks commands started inside a managed Studio agent session. */
export const DREVER_STUDIO_HOST_ROOT = "DREVER_STUDIO_HOST_ROOT";

/** @internal Lets nested Drever commands recognize the user-owned Studio host. */
export const studioAgentProcessEnvironment = (
  root: string,
  environment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv => Object.freeze({ ...environment, [DREVER_STUDIO_HOST_ROOT]: resolve(root) });

/** @internal Isolates agent-owned command cleanup from the Studio host process group. */
export const studioAgentProcessOptions = (
  root: string,
  environment: NodeJS.ProcessEnv = process.env,
): Readonly<{ cwd: string; detached: boolean; env: NodeJS.ProcessEnv }> =>
  Object.freeze({
    cwd: root,
    detached: process.platform !== "win32",
    env: studioAgentProcessEnvironment(root, environment),
  });

/** @internal Detects a development command that would compete with its owning Studio session. */
export const managedStudioHostRoot = (
  environment: NodeJS.ProcessEnv = process.env,
): string | undefined => {
  const root = environment[DREVER_STUDIO_HOST_ROOT];
  return typeof root === "string" && root.length > 0 ? root : undefined;
};

type StudioAgentChildProcess = Readonly<{
  pid?: number | undefined;
  kill(signal?: NodeJS.Signals | number): boolean;
}>;

/** @internal Signals the complete detached agent process group when POSIX can identify it. */
export const signalStudioAgentProcess = (
  child: StudioAgentChildProcess,
  signal: NodeJS.Signals,
  signalProcessGroup:
    | ((pid: number, signal: NodeJS.Signals) => boolean)
    | undefined = process.platform === "win32"
    ? undefined
    : (pid, ownedSignal) => process.kill(pid, ownedSignal),
): boolean => {
  const pid = child.pid;
  if (
    signalProcessGroup !== undefined &&
    typeof pid === "number" &&
    Number.isSafeInteger(pid) &&
    pid > 0
  ) {
    try {
      return signalProcessGroup(-pid, signal);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ESRCH"
      ) {
        return false;
      }
      throw error;
    }
  }
  return child.kill(signal);
};

export type StudioAgentApprovalDecision = DreverStudioAgentApprovalDecision;

export type StudioAgentApprovalRequest = Readonly<{
  decisions?: readonly StudioAgentApprovalDecision[];
  id: string | number;
  kind: DreverStudioAgentApprovalKind;
  itemId: string;
  reason?: string;
  detail?: string;
}>;

export type StudioAgentProviderSnapshot = Readonly<{
  connected: boolean;
  sessionId?: string;
  state?: DreverStudioAgentState;
}>;

/** @internal Maps browser actions to their in-flight Studio surface. */
export const phaseForStudioAction = (record: DreverStudioActionRecord): DreverStudioPhase => {
  switch (record.action.type) {
    case "approve-plan":
      return "drafting";
    case "submit-feedback":
      return "refining";
    default:
      return "waiting-for-agent";
  }
};

/** @internal Gives every agent transport the same validated browser action and server context. */
export const studioActionAgentPayload = (
  record: DreverStudioActionRecord,
): Readonly<{
  revision: number;
  action: DreverStudioActionRecord["action"];
  context?: DreverStudioActionRecord["context"];
}> =>
  Object.freeze({
    revision: record.revision,
    action: record.action,
    ...(record.context === undefined ? {} : { context: record.context }),
  });

/** @internal Keeps the latency-sensitive Studio handoff identical across agent transports. */
export const studioActionWorkflowInstructions = (record: DreverStudioActionRecord): string =>
  [
    record.action.type === "submit-adaptive-answers" ||
    record.action.type === "skip-remaining-questions"
      ? [
          "Treat this Storyboard handoff as latency-sensitive.",
          "In one bounded semantic pass, use only the submitted brief and direction to update brief.md and write a coherent, valid version-2 drever.plan.json with status awaiting-approval, then publish plan-review immediately.",
          "The Storyboard is a content contract: each slide records its job, working title, purpose, evidence, and anchor evidence. Do not choose or emit per-slide density, composition, layout, or motion before approval; keep the deck-wide density, global canvas, safe area, content inset, surface ownership, and the user's visual and motion preferences in brief.md for the later design pass.",
          "Before that first reviewable Storyboard, do not browse, research facts or assets, inspect broad project or package source, start another worker, build, export, or run browser automation.",
          "Express uncertain facts as explicit evidence requirements instead of inventing them.",
          "Publish plan-review and return this managed child turn at the human approval gate; do not mutate the Storyboard behind the reviewer. The owning Studio server and parent task remain active and must keep observing the session until ready, error, cancellation, or new user input. Continue factual research and visual refinement after approve-plan while building the same live Draft 1.",
        ].join(" ")
      : record.action.type === "approve-plan"
        ? [
            "Treat this approve-plan handoff as latency-sensitive.",
            "First mark brief.md and drever.plan.json approved and publish the drafting phase for this action, then write one bounded, semantic, content-complete Draft 1: every approved slide has its real readable copy, evidence, focal artifact, and speaker notes, using only a deliberately simple visual system.",
            "Unless the approved story explicitly calls for a cold open or immediate live surface, make slide 1 a restrained cover with a title or premise, at most one short orientation line, optional presenter or event metadata, and one focal artifact; move the first body argument or dense evidence to slide 2.",
            "Before Draft 1, preserve the exact approved or configured canvas and choose one explicit safe-area or content-inset policy; do not substitute another familiar resolution. Treat those bounds as locked.",
            "Write CSS in project-local files. Never use data:, blob:, or javascript: URLs as CSS @import sources, and never turn inline CSS into an import specifier.",
            "Before preview, do not load the design skill or its references, write art-direction.md, replace Theme or Stage configuration, browse or search, generate optional assets, or start or wait for another worker. Use the current coherent starter or approved surface unless a minimal complete replacement is required for safe rendering.",
            "After the complete Draft 1 write, run the project-local `drever check --json` through the detected package manager exactly once; rerun it only to repair a blocking source diagnostic.",
            "Reuse the active Studio development server and its embedded preview iframe; let HMR reveal the draft in that same surface.",
            "Before preview, do not start or restart another development server, open another browser, invoke Playwright or any browser automation, run rendered review, build, or export.",
            "Publish preview in the same action immediately after the last passing source check; do not pause for documentation, a recap, optional research, or polish. Then refine the same live draft with the design skill, using parallel read-only research or art-direction preparation only when it cannot contend with the single visual-source writer, and run the isolated rendered review only after the final authored source is stable.",
            "During later design or motion refinement, treat the last-known-good canvas, safe area, outer margins, slide and panel padding, grid, layout shell, readable line wraps, and largest painted footprint as immutable geometry. Add motion inside that shell; never temporarily remove those foundations. If an enhancement regresses them, revert it before publishing the next preview and redesign it around the checkpoint.",
          ].join(" ")
        : record.action.type === "request-draft-review"
          ? [
              "Treat this as an analysis-only review of the current ready Draft; do not edit source, apply a suggestion, rebuild, or start a refinement pass.",
              "Inspect the requested deck or slide scope and publish `draftReview` in `.drever/studio/state.json` for this exact action revision, with at most three specific suggestions.",
              "Each suggestion must include a stable kebab-case id, category (`content`, `design`, `motion`, or `accessibility`), priority (`must-fix`, `worth-improving`, or `optional`), deck or slide scope, and concrete `observation`, `reason`, `proposal`, and `impact` text.",
              "Include concrete source, rendered, narrative, or accessibility `evidence` for every must-fix or worth-improving suggestion. Without evidence, mark the suggestion optional. Prefer fewer high-value suggestions over generic advice.",
              "Publish phase `ready` with handledActionRevision and the structured draftReview, then return. The human decides whether to place any proposal into feedback and explicitly send it; never apply all suggestions automatically.",
            ].join(" ")
          : "",
    "The active Studio development server, Creation room URL, embedded preview, and managed-agent transport are user-owned session resources. Keep them alive through Storyboard review, Draft 1, refinement, and user feedback; never stop, restart, replace, or clean them up as temporary review infrastructure.",
    "Do not launch another `drever dev` or Vite server, and never use broad process cleanup such as `pkill`, `killall`, killing a process by port, or terminating an unowned browser or server.",
    "For final rendered evidence use the project-local `drever check --rendered --evidence .drever/review --json`; Drever owns its isolated ephemeral loopback preview and Playwright browser and closes only those resources.",
  ]
    .filter((part) => part.length > 0)
    .join(" ");

/** @internal Live agent boundary used by the local Studio server. */
export type StudioAgentProvider = Readonly<{
  start(): Promise<void>;
  stop(): Promise<void>;
  snapshot(): StudioAgentProviderSnapshot;
  subscribe(listener: () => void): () => void;
  handleAction(record: DreverStudioActionRecord): Promise<void>;
  approvals(): readonly StudioAgentApprovalRequest[];
  respondToApproval(
    requestId: string | number,
    decision: StudioAgentApprovalDecision,
  ): Promise<void>;
}>;

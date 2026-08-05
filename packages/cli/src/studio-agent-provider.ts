import type {
  DreverStudioActionRecord,
  DreverStudioAgentApprovalDecision,
  DreverStudioAgentApprovalKind,
  DreverStudioAgentState,
} from "@drever/schema";

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

/** @internal Keeps the latency-sensitive Studio handoff identical across agent transports. */
export const studioActionWorkflowInstructions = (record: DreverStudioActionRecord): string =>
  record.action.type === "approve-plan"
    ? [
        "Treat this approve-plan handoff as latency-sensitive.",
        "First mark brief.md and drever.plan.json approved and publish the drafting phase for this action, then write one bounded, semantic, content-complete Draft 1: every approved slide has its real readable copy, evidence, focal artifact, and speaker notes, using only a deliberately simple visual system.",
        "Before publishing preview, run only the project-local `drever check --json` through the detected package manager and repair blocking source diagnostics.",
        "Reuse the active Studio development server and its embedded preview iframe; let HMR reveal the draft in that same surface.",
        "Before preview, do not start or restart another development server, open another browser, invoke Playwright or any browser automation, run rendered review, build, export, or begin design research.",
        "Publish preview as soon as the source check passes. Then refine the same live draft with the design skill, and run the isolated rendered review only after the final authored source is stable.",
      ].join(" ")
    : "";

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

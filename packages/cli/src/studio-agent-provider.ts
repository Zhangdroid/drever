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

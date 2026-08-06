import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  DreverDeckPlanStatus,
  DreverStudioActionRecord,
  DreverStudioAgentState,
} from "@drever/schema";
import { loadDreverDeckPlan } from "./deck-plan.ts";
import {
  decodeStudioAgentState,
  DREVER_STUDIO_AGENT_STATE_FILE,
  DREVER_STUDIO_DIRECTORY,
  readStudioActionRecords,
} from "./studio-plugin.ts";

export type StudioActionPublicationVerifier = (
  record: DreverStudioActionRecord,
) => Promise<boolean>;

const PUBLICATION_GRACE_MS = 2_000;
const PUBLICATION_POLL_MS = 40;

const isMissingFile = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

const readPublishedState = async (root: string): Promise<DreverStudioAgentState | undefined> => {
  const path = join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_AGENT_STATE_FILE);
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFile(error)) return;
    throw error;
  }

  try {
    return decodeStudioAgentState(JSON.parse(source) as unknown);
  } catch {
    return;
  }
};

const publicationCoversRevision = async (
  root: string,
  state: DreverStudioAgentState,
  revision: number,
): Promise<boolean> => {
  const records = await readStudioActionRecords(root);
  const latestActionRevision = records.at(-1)?.revision ?? 0;
  const handledActionRevision = state.handledActionRevision ?? 0;
  return handledActionRevision >= revision && handledActionRevision <= latestActionRevision;
};

const hasPlanStatus = async (root: string, status: DreverDeckPlanStatus): Promise<boolean> =>
  (await loadDreverDeckPlan({ root })).plan?.status === status;

const hasConsecutiveSkipOutcome = async (
  root: string,
  record: DreverStudioActionRecord,
  state: DreverStudioAgentState,
): Promise<boolean> => {
  const handledActionRevision = state.handledActionRevision ?? 0;
  if (state.phase !== "plan-review" || handledActionRevision <= record.revision) return false;

  const records = await readStudioActionRecords(root);
  const skip = records.find(({ revision }) => revision === record.revision + 1);
  return (
    skip?.action.type === "skip-remaining-questions" &&
    skip.action.expectedRevision === record.revision &&
    handledActionRevision >= skip.revision &&
    (await hasPlanStatus(root, "awaiting-approval"))
  );
};

const hasActionOutcome = async (
  root: string,
  record: DreverStudioActionRecord,
  state: DreverStudioAgentState,
): Promise<boolean> => {
  // A bounded published failure is still a concrete action result. Providers should
  // not replay it indefinitely merely because the requested artifact could not be made.
  if (state.phase === "error") return true;

  switch (record.action.type) {
    case "submit-common-brief":
      if (state.phase === "adaptive-questions" && state.adaptiveQuestions !== undefined)
        return true;
      return hasConsecutiveSkipOutcome(root, record, state);
    case "submit-adaptive-answers":
      return (
        (state.phase === "adaptive-questions" && state.adaptiveQuestions !== undefined) ||
        (state.phase === "plan-review" && (await hasPlanStatus(root, "awaiting-approval")))
      );
    case "skip-remaining-questions":
      return state.phase === "plan-review" && (await hasPlanStatus(root, "awaiting-approval"));
    case "approve-plan":
      return state.phase === "ready" && (await hasPlanStatus(root, "approved"));
    case "submit-feedback":
      if (await hasPlanStatus(root, "awaiting-approval")) return state.phase === "plan-review";
      return state.phase === "ready" && (await hasPlanStatus(root, "approved"));
    case "respond-agent-approval":
      // Approval responses use the provider's bidirectional channel and are not journaled.
      return true;
  }
};

/** @internal Verifies that a validated project-local publication acknowledges an action. */
export const verifyStudioActionPublication = async (
  root: string,
  revision: number,
): Promise<boolean> => {
  const state = await readPublishedState(root);
  if (state === undefined) return false;
  return publicationCoversRevision(root, state, revision);
};

/** @internal Creates the postcondition shared by native and protocol agent providers. */
export const createStudioActionPublicationVerifier =
  (root: string): StudioActionPublicationVerifier =>
  async (record) => {
    const state = await readPublishedState(root);
    if (state === undefined || !(await publicationCoversRevision(root, state, record.revision))) {
      return false;
    }
    return hasActionOutcome(root, record, state);
  };

/** @internal Gives an atomic agent publication a short window to become observable. */
export const withStudioActionPublicationGrace =
  (
    verify: StudioActionPublicationVerifier,
    timeoutMs = PUBLICATION_GRACE_MS,
    pollMs = PUBLICATION_POLL_MS,
  ): StudioActionPublicationVerifier =>
  async (record) => {
    const deadline = Date.now() + timeoutMs;
    while (true) {
      if (await verify(record)) return true;
      const remaining = deadline - Date.now();
      if (remaining <= 0) return false;
      await new Promise((resolve) => setTimeout(resolve, Math.min(pollMs, remaining)));
    }
  };

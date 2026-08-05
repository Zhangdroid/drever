import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DreverStudioActionRecord } from "@drever/schema";
import {
  decodeStudioAgentState,
  DREVER_STUDIO_AGENT_STATE_FILE,
  DREVER_STUDIO_DIRECTORY,
  readStudioActionRecords,
} from "./studio-plugin.ts";

export type StudioActionPublicationVerifier = (
  record: DreverStudioActionRecord,
) => Promise<boolean>;

const isMissingFile = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

/** @internal Verifies that a validated project-local publication acknowledges an action. */
export const verifyStudioActionPublication = async (
  root: string,
  revision: number,
): Promise<boolean> => {
  const path = join(root, DREVER_STUDIO_DIRECTORY, DREVER_STUDIO_AGENT_STATE_FILE);
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }

  let value: unknown;
  try {
    value = JSON.parse(source) as unknown;
  } catch {
    return false;
  }
  const state = decodeStudioAgentState(value);
  if (state === undefined) return false;
  const records = await readStudioActionRecords(root);
  const latestActionRevision = records.at(-1)?.revision ?? 0;
  const handledActionRevision = state.handledActionRevision ?? 0;
  return handledActionRevision >= revision && handledActionRevision <= latestActionRevision;
};

/** @internal Creates the postcondition shared by native and protocol agent providers. */
export const createStudioActionPublicationVerifier =
  (root: string): StudioActionPublicationVerifier =>
  async (record) =>
    verifyStudioActionPublication(root, record.revision);

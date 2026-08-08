import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type {
  DreverStudioActionRecord,
  DreverStudioActivity,
  DreverStudioAgentState,
} from "@drever/schema";
import { DreverCliError } from "./errors.ts";
import {
  createStudioSession,
  readStudioActionRecords,
  writeStudioAgentActivity,
  writeStudioAgentHeartbeat,
  writeStudioAgentState,
} from "./studio-plugin.ts";

export type StudioStatusCommand = Readonly<{
  action: "status";
  json: boolean;
  name: "studio";
}>;

export type StudioWaitCommand = Readonly<{
  action: "wait";
  after: number;
  json: boolean;
  name: "studio";
  timeoutSeconds: number;
}>;

export type StudioPublishCommand = Readonly<{
  action: "publish";
  file: string;
  json: boolean;
  name: "studio";
}>;

export type StudioCommand = StudioStatusCommand | StudioWaitCommand | StudioPublishCommand;

export type RunStudioCommandRequest = Readonly<{
  command: StudioCommand;
  delay?: (milliseconds: number) => Promise<void>;
  now?: () => number;
  root: string;
  stdout: Pick<NodeJS.WriteStream, "write">;
}>;

const formatJson = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const AGENT_HEARTBEAT_INTERVAL_MS = 30_000;

const receivedActionActivity = (record: DreverStudioActionRecord): DreverStudioActivity => {
  const shared = { id: `received-${String(record.revision)}`, status: "active" as const };
  switch (record.action.type) {
    case "submit-common-brief":
      return Object.freeze({
        ...shared,
        label: "Preparing your questions",
        detail: "Reading the brief and choosing the few decisions that will change the story.",
      });
    case "submit-adaptive-answers":
    case "skip-remaining-questions":
      return Object.freeze({
        ...shared,
        label: "Shaping the story",
        detail: "Turning your direction into a reviewable slide plan.",
      });
    case "approve-plan":
      return Object.freeze({
        ...shared,
        label: "Building the first preview",
        detail: "The plan is approved. Drafting the complete presentation now.",
      });
    case "resume-pending":
      return Object.freeze({
        ...shared,
        label: "Reconnecting the managed agent",
        detail: "Replaying the existing pending Studio action without adding another request.",
      });
    case "request-draft-review":
      return Object.freeze({
        ...shared,
        label: "Reviewing the current draft",
        detail: "Finding a few concrete improvements without changing the presentation.",
      });
    case "respond-agent-approval":
      return Object.freeze({
        ...shared,
        label: "Resuming agent work",
        detail: "The permission decision was returned to the managed agent.",
      });
    case "submit-feedback":
      return Object.freeze({
        ...shared,
        label: "Applying your feedback",
        detail: "Updating the selected part before the next preview.",
      });
  }
};

const readPublication = async (root: string, file: string): Promise<unknown> => {
  const projectRoot = resolve(root);
  const path = resolve(projectRoot, file);
  const projectPath = relative(projectRoot, path);
  if (
    projectPath === ".." ||
    projectPath.startsWith(`..${sep}`) ||
    isAbsolute(projectPath) ||
    !path.endsWith(".json")
  ) {
    throw new DreverCliError(
      "DREVER_STUDIO_PUBLICATION_PATH_INVALID",
      "Studio publish accepts a project-local JSON file.",
      { details: { file } },
    );
  }
  let canonicalRoot: string;
  let canonicalPath: string;
  try {
    [canonicalRoot, canonicalPath] = await Promise.all([realpath(projectRoot), realpath(path)]);
  } catch (cause) {
    throw new DreverCliError(
      "DREVER_STUDIO_PUBLICATION_INVALID",
      "Drever could not read the Studio agent-state publication.",
      {
        cause,
        details: { file: path },
        hint: "Write valid JSON that matches the versioned DreverStudioAgentState contract.",
      },
    );
  }
  const canonicalProjectPath = relative(canonicalRoot, canonicalPath);
  if (
    canonicalProjectPath === ".." ||
    canonicalProjectPath.startsWith(`..${sep}`) ||
    isAbsolute(canonicalProjectPath)
  ) {
    throw new DreverCliError(
      "DREVER_STUDIO_PUBLICATION_PATH_INVALID",
      "Studio publish accepts a project-local JSON file.",
      { details: { file } },
    );
  }
  try {
    return JSON.parse(await readFile(canonicalPath, "utf8")) as unknown;
  } catch (cause) {
    throw new DreverCliError(
      "DREVER_STUDIO_PUBLICATION_INVALID",
      "Drever could not read the Studio agent-state publication.",
      {
        cause,
        details: { file: path },
        hint: "Write valid JSON that matches the versioned DreverStudioAgentState contract.",
      },
    );
  }
};

const publish = async (root: string, file: string): Promise<DreverStudioAgentState> => {
  const value = await readPublication(root, file);
  try {
    return await writeStudioAgentState(root, value);
  } catch (cause) {
    throw new DreverCliError(
      "DREVER_STUDIO_PUBLICATION_INVALID",
      "The Studio agent-state publication is invalid.",
      {
        cause,
        details: { file },
        hint: 'For questions, publish {"version":1,"phase":"adaptive-questions","handledActionRevision":<revision>,"adaptiveQuestions":[...]}; put optional `recommended: true` on at most one option, never on the question.',
      },
    );
  }
};

const waitForActions = async (
  root: string,
  after: number,
  timeoutSeconds: number,
  now: () => number,
  delay: (milliseconds: number) => Promise<void>,
  renewAgentLease: () => Promise<void>,
): Promise<Readonly<{ actions: readonly DreverStudioActionRecord[]; timedOut: boolean }>> => {
  const deadline = now() + timeoutSeconds * 1_000;
  let nextHeartbeat = now() + AGENT_HEARTBEAT_INTERVAL_MS;
  while (true) {
    const actions = (await readStudioActionRecords(root)).filter(
      ({ revision }) => revision > after,
    );
    if (actions.length > 0) return Object.freeze({ actions, timedOut: false });
    const currentTime = now();
    if (currentTime >= nextHeartbeat) {
      await renewAgentLease();
      nextHeartbeat = currentTime + AGENT_HEARTBEAT_INTERVAL_MS;
    }
    const remaining = deadline - currentTime;
    if (remaining <= 0) return Object.freeze({ actions: [], timedOut: true });
    await delay(Math.min(remaining, 100));
  }
};

/** Runs the provider-neutral CLI side of the local Studio protocol. */
export const runStudioCommand = async ({
  command,
  delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds)),
  now = Date.now,
  root,
  stdout,
}: RunStudioCommandRequest): Promise<void> => {
  const heartbeat = async (): Promise<void> => {
    await writeStudioAgentHeartbeat(root, new Date(now()));
  };
  if (command.action === "status") {
    await heartbeat();
    const state = await createStudioSession(root, { now: () => new Date(now()) }).read();
    stdout.write(
      command.json
        ? formatJson(state)
        : `Creation room: ${state.phase}; revision ${String(state.revision)}; ${String(state.pendingActionCount)} pending action(s).\n`,
    );
    return;
  }
  if (command.action === "wait") {
    await heartbeat();
    const result = await waitForActions(
      root,
      command.after,
      command.timeoutSeconds,
      now,
      delay,
      heartbeat,
    );
    await heartbeat();
    const received = result.actions.at(-1);
    if (received !== undefined) {
      await writeStudioAgentActivity(root, receivedActionActivity(received));
    }
    const latestActionRevision = result.actions.at(-1)?.revision ?? command.after;
    const value = Object.freeze({
      version: 1,
      after: command.after,
      latestActionRevision,
      timedOut: result.timedOut,
      actions: result.actions,
    });
    stdout.write(
      command.json
        ? formatJson(value)
        : result.timedOut
          ? `No Studio action arrived after revision ${String(command.after)}.\n`
          : `Received ${String(result.actions.length)} Studio action(s) through revision ${String(latestActionRevision)}.\n`,
    );
    return;
  }
  await heartbeat();
  const state = await publish(root, command.file);
  stdout.write(
    command.json ? formatJson(state) : `Published Studio agent state from ${command.file}.\n`,
  );
};

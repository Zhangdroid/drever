import type { StudioAgentProvider } from "./studio-agent-provider.ts";
import { DREVER_VERSION } from "./package-version.ts";

export const STUDIO_AGENT_NAMES = [
  "codex",
  "claude",
  "gemini",
  "copilot",
  "goose",
  "cursor",
  "opencode",
  "openhands",
  "cline",
] as const;

export type StudioAgentName = (typeof STUDIO_AGENT_NAMES)[number];

export type StudioAgentSupport = Readonly<{
  approvals: "studio" | "provider";
  label: string;
  liveActivity: true;
  transport: "native" | "acp";
}>;

export const STUDIO_AGENT_SUPPORT = Object.freeze({
  codex: Object.freeze({
    approvals: "studio",
    label: "Codex",
    liveActivity: true,
    transport: "native",
  }),
  claude: Object.freeze({
    approvals: "provider",
    label: "Claude Code",
    liveActivity: true,
    transport: "native",
  }),
  gemini: Object.freeze({
    approvals: "studio",
    label: "Gemini CLI",
    liveActivity: true,
    transport: "acp",
  }),
  copilot: Object.freeze({
    approvals: "studio",
    label: "GitHub Copilot CLI",
    liveActivity: true,
    transport: "acp",
  }),
  goose: Object.freeze({
    approvals: "studio",
    label: "Goose",
    liveActivity: true,
    transport: "acp",
  }),
  cursor: Object.freeze({
    approvals: "studio",
    label: "Cursor CLI",
    liveActivity: true,
    transport: "acp",
  }),
  opencode: Object.freeze({
    approvals: "studio",
    label: "OpenCode",
    liveActivity: true,
    transport: "acp",
  }),
  openhands: Object.freeze({
    approvals: "studio",
    label: "OpenHands",
    liveActivity: true,
    transport: "acp",
  }),
  cline: Object.freeze({
    approvals: "studio",
    label: "Cline CLI",
    liveActivity: true,
    transport: "acp",
  }),
}) satisfies Readonly<Record<StudioAgentName, StudioAgentSupport>>;

export const isStudioAgentName = (value: string): value is StudioAgentName =>
  (STUDIO_AGENT_NAMES as readonly string[]).includes(value);

/** @internal Loads only the protocol implementation selected for this development session. */
export const createStudioAgentProvider = async (
  agent: StudioAgentName,
  root: string,
): Promise<StudioAgentProvider> => {
  if (agent === "codex") {
    const { createCodexStudioAgent } = await import("./studio-codex-agent.ts");
    return createCodexStudioAgent({ clientVersion: DREVER_VERSION, root });
  }
  if (agent === "claude") {
    const { createClaudeStudioAgent } = await import("./studio-claude-agent.ts");
    return createClaudeStudioAgent({ root });
  }
  const { createAcpStudioAgentProvider } = await import("./acp-studio-agent-provider.ts");
  return createAcpStudioAgentProvider({ agent, cwd: root });
};

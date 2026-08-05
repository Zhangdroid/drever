import { PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import type {
  JsonRpcId,
  PermissionOptionKind,
  PlanEntryPriority,
  PlanEntryStatus,
  RequestPermissionRequest,
  SessionNotification,
  ToolCallStatus,
  ToolKind,
} from "@agentclientprotocol/sdk";

export const ACP_PROTOCOL_VERSION = PROTOCOL_VERSION;

export type AcpSafeEvent =
  | Readonly<{
      kind: "agent-message";
      messageId?: string;
      sessionId: string;
      text: string;
    }>
  | Readonly<{
      kind: "tool-call";
      phase: "start" | "update";
      sessionId: string;
      status?: ToolCallStatus;
      toolCallId: string;
      toolKind?: ToolKind;
    }>
  | Readonly<{
      entries: readonly Readonly<{
        content: string;
        priority: PlanEntryPriority;
        status: PlanEntryStatus;
      }>[];
      kind: "plan";
      sessionId: string;
    }>
  | Readonly<{
      kind: "permission-request";
      options: readonly Readonly<{
        kind: PermissionOptionKind;
        optionId: string;
      }>[];
      requestId: JsonRpcId;
      sessionId: string;
      toolCall: Readonly<{
        location?: string;
        status?: ToolCallStatus;
        title?: string;
        toolCallId: string;
        toolKind?: ToolKind;
      }>;
    }>;

export type AcpStdioAgentCommand = Readonly<{
  args: readonly string[];
  command: string;
  documentationUrl: string;
  label: string;
}>;

/** Verified native ACP stdio entry points. This intentionally excludes adapter-only agents. */
export const ACP_STDIO_AGENT_COMMANDS = Object.freeze({
  cline: Object.freeze({
    args: Object.freeze(["--acp"]),
    command: "cline",
    documentationUrl: "https://docs.cline.bot/cli/cli-reference",
    label: "Cline CLI",
  }),
  copilot: Object.freeze({
    args: Object.freeze(["--acp", "--stdio"]),
    command: "copilot",
    documentationUrl:
      "https://docs.github.com/en/copilot/reference/copilot-cli-reference/acp-server",
    label: "GitHub Copilot CLI",
  }),
  goose: Object.freeze({
    args: Object.freeze(["acp"]),
    command: "goose",
    documentationUrl: "https://block.github.io/goose/",
    label: "Goose",
  }),
  cursor: Object.freeze({
    args: Object.freeze(["acp"]),
    command: "cursor-agent",
    documentationUrl: "https://cursor.com/docs/cli/acp",
    label: "Cursor CLI",
  }),
  gemini: Object.freeze({
    args: Object.freeze(["--acp"]),
    command: "gemini",
    documentationUrl: "https://geminicli.com/docs/cli/acp-mode/",
    label: "Gemini CLI",
  }),
  opencode: Object.freeze({
    args: Object.freeze(["acp"]),
    command: "opencode",
    documentationUrl: "https://opencode.ai/docs/acp/",
    label: "OpenCode",
  }),
  openhands: Object.freeze({
    args: Object.freeze(["acp", "--streaming"]),
    command: "openhands",
    documentationUrl: "https://docs.openhands.dev/openhands/usage/cli/command-reference",
    label: "OpenHands",
  }),
}) satisfies Readonly<Record<string, AcpStdioAgentCommand>>;

export type AcpStdioAgentName = keyof typeof ACP_STDIO_AGENT_COMMANDS;

const safeTool = (
  tool: Readonly<{
    kind?: ToolKind | null;
    status?: ToolCallStatus | null;
    toolCallId: string;
  }>,
) =>
  Object.freeze({
    ...(tool.status == null ? {} : { status: tool.status }),
    toolCallId: tool.toolCallId,
    ...(tool.kind == null ? {} : { toolKind: tool.kind }),
  });

const SECRET_VALUE =
  /(\b(?:api[-_ ]?key|authorization|password|secret|token)\b\s*(?:=|:)\s*)(?:"[^"]*"|'[^']*'|\S+)/giu;
const SECRET_OPTION =
  /(\B--?(?:api[-_]?key|authorization|password|secret|token)\b(?:=|\s+))(?:"[^"]*"|'[^']*'|\S+)/giu;
const TOKEN_SHAPE =
  /\b(?:Bearer\s+)?(?:gh[opsu]_[A-Za-z\d_]{16,}|npm_[A-Za-z\d]{16,}|sk-[A-Za-z\d_-]{16,}|eyJ[A-Za-z\d_-]{12,}\.[A-Za-z\d_-]{12,}(?:\.[A-Za-z\d_-]{12,})?)\b/gu;
const ABSOLUTE_PATH = /(?:[A-Za-z]:[\\/]|\/)[^\s"'`|<>;,)]*/gu;

const basename = (value: string): string => value.replaceAll("\\", "/").split("/").at(-1) ?? "";

const safeApprovalLocation = (
  locations: RequestPermissionRequest["toolCall"]["locations"],
): string | undefined => {
  const location = locations?.at(0);
  if (location === undefined) return undefined;
  const name = basename(location.path)
    .replace(/\p{Cc}/gu, "")
    .trim();
  if (name.length === 0 || /\b(?:password|secret|token)\b/iu.test(name)) return undefined;
  const line = location.line == null ? "" : `:${String(location.line)}`;
  return `${name.slice(0, 96)}${line}`;
};

const safeApprovalTitle = (value: string | null | undefined): string | undefined => {
  if (value == null || /(?:&&|\|\||[|;$<>`]|\$\()/u.test(value)) return undefined;
  const title = value
    .replace(ABSOLUTE_PATH, (path) => basename(path))
    .replace(SECRET_OPTION, "$1[redacted]")
    .replace(SECRET_VALUE, "$1[redacted]")
    .replace(TOKEN_SHAPE, "[redacted]")
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 160);
  return title.length === 0 ? undefined : title;
};

const safePermissionTool = (tool: RequestPermissionRequest["toolCall"]) => {
  const title = safeApprovalTitle(tool.title);
  const location = safeApprovalLocation(tool.locations);
  return Object.freeze({
    ...safeTool(tool),
    ...(title === undefined ? {} : { title }),
    ...(location === undefined ? {} : { location }),
  });
};

/** Converts typed ACP updates into the deliberately small, public Studio activity surface. */
export const normalizeAcpSessionNotification = (
  notification: SessionNotification,
): readonly AcpSafeEvent[] => {
  const { sessionId, update } = notification;
  switch (update.sessionUpdate) {
    case "agent_message_chunk":
      return update.content.type === "text" && update.content.text.length > 0
        ? [
            Object.freeze({
              kind: "agent-message",
              ...(update.messageId == null ? {} : { messageId: update.messageId }),
              sessionId,
              text: update.content.text,
            }),
          ]
        : [];
    case "agent_thought_chunk":
      // ACP can carry private model reasoning. Product surfaces must never expose it.
      return [];
    case "tool_call":
    case "tool_call_update":
      return [
        Object.freeze({
          kind: "tool-call",
          phase: update.sessionUpdate === "tool_call" ? "start" : "update",
          sessionId,
          ...safeTool(update),
        }),
      ];
    case "plan":
      return [
        Object.freeze({
          entries: Object.freeze(
            update.entries.map(({ content, priority, status }) =>
              Object.freeze({ content, priority, status }),
            ),
          ),
          kind: "plan",
          sessionId,
        }),
      ];
    default:
      return [];
  }
};

/** Normalizes an SDK-validated permission request without forwarding raw tool input or output. */
export const normalizeAcpPermissionRequest = (
  requestId: JsonRpcId,
  request: RequestPermissionRequest,
): Extract<AcpSafeEvent, Readonly<{ kind: "permission-request" }>> =>
  Object.freeze({
    kind: "permission-request",
    options: Object.freeze(
      request.options.map(({ kind, optionId }) => Object.freeze({ kind, optionId })),
    ),
    requestId,
    sessionId: request.sessionId,
    toolCall: safePermissionTool(request.toolCall),
  });

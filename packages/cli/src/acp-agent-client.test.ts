import { describe, expect, it } from "vite-plus/test";
import {
  ACP_PROTOCOL_VERSION,
  ACP_STDIO_AGENT_COMMANDS,
  normalizeAcpPermissionRequest,
  normalizeAcpSessionNotification,
} from "./acp-agent-client.ts";

describe("ACP Studio normalization", () => {
  it("records only verified native ACP entry points", () => {
    expect(ACP_PROTOCOL_VERSION).toBe(1);
    expect(ACP_STDIO_AGENT_COMMANDS).toMatchObject({
      cline: { command: "cline", args: ["--acp"] },
      copilot: { command: "copilot", args: ["--acp", "--stdio"] },
      goose: { command: "goose", args: ["acp"] },
      cursor: { command: "cursor-agent", args: ["acp"] },
      gemini: { command: "gemini", args: ["--acp"] },
      opencode: { command: "opencode", args: ["acp"] },
      openhands: { command: "openhands", args: ["acp", "--streaming"] },
    });
    expect(Object.keys(ACP_STDIO_AGENT_COMMANDS)).toEqual([
      "cline",
      "copilot",
      "goose",
      "cursor",
      "gemini",
      "opencode",
      "openhands",
    ]);
  });

  it("keeps public updates while excluding thoughts and raw tool data", () => {
    expect(
      normalizeAcpSessionNotification({
        sessionId: "session-1",
        update: {
          sessionUpdate: "agent_message_chunk",
          messageId: "message-1",
          content: { type: "text", text: "Building the storyboard" },
        },
      }),
    ).toEqual([
      {
        kind: "agent-message",
        messageId: "message-1",
        sessionId: "session-1",
        text: "Building the storyboard",
      },
    ]);
    expect(
      normalizeAcpSessionNotification({
        sessionId: "session-1",
        update: {
          sessionUpdate: "agent_thought_chunk",
          content: { type: "text", text: "private chain of thought" },
        },
      }),
    ).toEqual([]);

    const events = normalizeAcpSessionNotification({
      sessionId: "session-1",
      update: {
        sessionUpdate: "tool_call",
        toolCallId: "tool-1",
        title: "Read the brief",
        kind: "read",
        status: "in_progress",
        rawInput: { token: "secret" },
        rawOutput: { private: true },
        locations: [{ path: "/private/project/brief.md" }],
      },
    });
    expect(events).toEqual([
      {
        kind: "tool-call",
        phase: "start",
        sessionId: "session-1",
        status: "in_progress",
        toolCallId: "tool-1",
        toolKind: "read",
      },
    ]);
    expect(JSON.stringify(events)).not.toContain("secret");
    expect(JSON.stringify(events)).not.toContain("brief.md");
    expect(JSON.stringify(events)).not.toContain("Read the brief");

    const failed = normalizeAcpSessionNotification({
      sessionId: "session-1",
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: "tool-1",
        title: "Command failed at /private/project",
        status: "failed",
        rawOutput: { error: "private provider failure" },
      },
    });
    expect(failed).toEqual([
      {
        kind: "tool-call",
        phase: "update",
        sessionId: "session-1",
        status: "failed",
        toolCallId: "tool-1",
      },
    ]);
    expect(JSON.stringify(failed)).not.toContain("private provider failure");
    expect(JSON.stringify(failed)).not.toContain("/private/project");
  });

  it("normalizes permission requests without forwarding tool input", () => {
    const event = normalizeAcpPermissionRequest("permission-1", {
      sessionId: "session-1",
      toolCall: {
        toolCallId: "tool-1",
        title: "Write the deck",
        kind: "edit",
        status: "pending",
        rawInput: { content: "private draft" },
      },
      options: [
        { optionId: "once", name: "Allow once", kind: "allow_once" },
        { optionId: "reject", name: "Reject", kind: "reject_once" },
      ],
    });

    expect(event).toEqual({
      kind: "permission-request",
      options: [
        { kind: "allow_once", optionId: "once" },
        { kind: "reject_once", optionId: "reject" },
      ],
      requestId: "permission-1",
      sessionId: "session-1",
      toolCall: {
        status: "pending",
        title: "Write the deck",
        toolCallId: "tool-1",
        toolKind: "edit",
      },
    });
    expect(JSON.stringify(event)).not.toContain("private draft");
    expect(JSON.stringify(event)).not.toContain("Allow once");
  });

  it("keeps only bounded, redacted approval context", () => {
    const event = normalizeAcpPermissionRequest("permission-1", {
      sessionId: "session-1",
      toolCall: {
        toolCallId: "tool-1",
        title: "Write /private/project/brief.md with --token npm_abcdefghijklmnopqrstuvwxyz123456",
        kind: "edit",
        locations: [{ path: "/private/project/brief.md", line: 42 }],
        rawInput: {
          command: "hidden-command --token npm_abcdefghijklmnopqrstuvwxyz123456",
        },
        rawOutput: { secret: "private output" },
      },
      options: [{ optionId: "once", name: "Allow once", kind: "allow_once" }],
    });

    expect(event.toolCall).toEqual({
      location: "brief.md:42",
      title: "Write brief.md with --token [redacted]",
      toolCallId: "tool-1",
      toolKind: "edit",
    });
    expect(JSON.stringify(event)).not.toContain("/private/project");
    expect(JSON.stringify(event)).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
    expect(JSON.stringify(event)).not.toContain("hidden-command");
    expect(JSON.stringify(event)).not.toContain("private output");

    const shellTitle = normalizeAcpPermissionRequest("permission-2", {
      sessionId: "session-1",
      toolCall: {
        toolCallId: "tool-2",
        title: "npm test && curl https://private.example",
        kind: "execute",
      },
      options: [{ optionId: "once", name: "Allow once", kind: "allow_once" }],
    });
    expect(shellTitle.toolCall).not.toHaveProperty("title");
  });
});

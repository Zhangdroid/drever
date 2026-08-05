import { describe, expect, it } from "vite-plus/test";
import { ClaudeStreamDecoder, decodeClaudeStreamLine } from "./claude-stream-adapter.ts";

describe("Claude stream-json adapter", () => {
  it("decodes session initialization and partial public text", () => {
    expect(
      decodeClaudeStreamLine(
        JSON.stringify({
          type: "system",
          subtype: "init",
          session_id: "session-1",
          model: "claude-sonnet",
        }),
      ),
    ).toEqual([{ kind: "session-start", model: "claude-sonnet", sessionId: "session-1" }]);

    expect(
      decodeClaudeStreamLine(
        JSON.stringify({
          type: "stream_event",
          session_id: "session-1",
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "Preparing the storyboard" },
          },
        }),
      ),
    ).toEqual([{ kind: "text-delta", sessionId: "session-1", text: "Preparing the storyboard" }]);
  });

  it("decodes streamed tool activity without exposing private thinking", () => {
    expect(
      decodeClaudeStreamLine(
        JSON.stringify({
          type: "stream_event",
          session_id: "session-1",
          event: {
            type: "content_block_start",
            index: 1,
            content_block: { type: "tool_use", id: "tool-1", name: "Read", input: {} },
          },
        }),
      ),
    ).toEqual([
      { kind: "tool-start", sessionId: "session-1", toolName: "Read", toolUseId: "tool-1" },
    ]);
    expect(
      decodeClaudeStreamLine(
        JSON.stringify({
          type: "stream_event",
          session_id: "session-1",
          event: {
            type: "content_block_delta",
            index: 1,
            delta: { type: "input_json_delta", partial_json: '{"file_path":' },
          },
        }),
      ),
    ).toEqual([{ kind: "tool-input-delta", partialJson: '{"file_path":', sessionId: "session-1" }]);
    expect(
      decodeClaudeStreamLine(
        JSON.stringify({
          type: "stream_event",
          session_id: "session-1",
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "thinking_delta", thinking: "private reasoning" },
          },
        }),
      ),
    ).toEqual([]);
    expect(
      decodeClaudeStreamLine(
        JSON.stringify({
          type: "user",
          session_id: "session-1",
          message: {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "tool-1",
                is_error: false,
                content: "private command output",
              },
            ],
          },
        }),
      ),
    ).toEqual([
      { isError: false, kind: "tool-result", sessionId: "session-1", toolUseId: "tool-1" },
    ]);
  });

  it("surfaces a deferred approval before the terminating result", () => {
    expect(
      decodeClaudeStreamLine(
        JSON.stringify({
          type: "result",
          subtype: "success",
          session_id: "session-1",
          stop_reason: "tool_deferred",
          deferred_tool_use: {
            id: "tool-2",
            name: "AskUserQuestion",
            input: { questions: [{ question: "Which direction?" }] },
          },
        }),
      ),
    ).toEqual([
      {
        kind: "approval-required",
        sessionId: "session-1",
        deferredTool: {
          id: "tool-2",
          name: "AskUserQuestion",
          input: { questions: [{ question: "Which direction?" }] },
        },
      },
      {
        isError: false,
        kind: "result",
        sessionId: "session-1",
        stopReason: "tool_deferred",
        subtype: "success",
      },
    ]);
  });

  it("fails closed when a deferred result omits a valid deferred tool", () => {
    expect(
      decodeClaudeStreamLine(
        JSON.stringify({
          type: "result",
          subtype: "success",
          session_id: "session-1",
          stop_reason: "tool_deferred",
          deferred_tool_use: { name: "AskUserQuestion" },
        }),
      ),
    ).toEqual([
      {
        isError: true,
        kind: "result",
        sessionId: "session-1",
        stopReason: "tool_deferred",
        subtype: "success",
      },
    ]);
  });

  it("buffers split NDJSON chunks and flushes the final unterminated line", () => {
    const decoder = new ClaudeStreamDecoder();
    expect(
      decoder.push('{"type":"stream_event","session_id":"s","event":{"type":"content_'),
    ).toEqual([]);
    expect(
      decoder.push(
        'block_delta","delta":{"type":"text_delta","text":"Ready"}}}\r\n{"type":"result",',
      ),
    ).toEqual([{ kind: "text-delta", sessionId: "s", text: "Ready" }]);
    expect(decoder.push('"subtype":"success","session_id":"s","result":"Done"}')).toEqual([]);
    expect(decoder.finish()).toEqual([
      {
        isError: false,
        kind: "result",
        result: "Done",
        sessionId: "s",
        subtype: "success",
      },
    ]);
  });

  it("fails closed on malformed protocol output without echoing its contents", () => {
    expect(() => decodeClaudeStreamLine('{"secret":"not closed"')).toThrowError(
      "Claude emitted invalid stream-json output.",
    );
  });
});

type JsonRecord = Record<string, unknown>;

export type ClaudeDeferredTool = Readonly<{
  id: string;
  input: JsonRecord;
  name: string;
}>;

export type ClaudeStreamSignal =
  | Readonly<{
      kind: "session-start";
      model?: string;
      sessionId: string;
    }>
  | Readonly<{
      kind: "text-delta";
      sessionId?: string;
      text: string;
    }>
  | Readonly<{
      kind: "tool-start";
      sessionId?: string;
      toolName: string;
      toolUseId: string;
    }>
  | Readonly<{
      kind: "tool-input-delta";
      partialJson: string;
      sessionId?: string;
    }>
  | Readonly<{
      isError: boolean;
      kind: "tool-result";
      sessionId?: string;
      toolUseId: string;
    }>
  | Readonly<{
      blockIndex: number;
      kind: "content-block-stop";
      sessionId?: string;
    }>
  | Readonly<{
      kind: "turn-stop";
      sessionId?: string;
    }>
  | Readonly<{
      deferredTool: ClaudeDeferredTool;
      kind: "approval-required";
      sessionId: string;
    }>
  | Readonly<{
      isError: boolean;
      kind: "result";
      result?: string;
      sessionId: string;
      stopReason?: string;
      subtype: string;
    }>
  | Readonly<{
      kind: "unhandled";
      type: string;
    }>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringOf = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const numberOf = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const session = (value: JsonRecord): Readonly<{ sessionId?: string }> => {
  const sessionId = stringOf(value.session_id);
  return sessionId === undefined ? {} : { sessionId };
};

const decodeDeferredTool = (value: unknown): ClaudeDeferredTool | undefined => {
  if (!isRecord(value)) return undefined;
  const id = stringOf(value.id);
  const input = isRecord(value.input) ? value.input : undefined;
  const name = stringOf(value.name);
  if (id === undefined || input === undefined || name === undefined) return undefined;
  return Object.freeze({ id, input, name });
};

const decodePartial = (message: JsonRecord): readonly ClaudeStreamSignal[] => {
  const event = message.event;
  if (!isRecord(event)) return [];
  const shared = session(message);

  switch (event.type) {
    case "content_block_start": {
      const block = event.content_block;
      if (!isRecord(block) || block.type !== "tool_use") return [];
      const toolName = stringOf(block.name);
      const toolUseId = stringOf(block.id);
      if (toolName === undefined || toolUseId === undefined) return [];
      return [Object.freeze({ ...shared, kind: "tool-start", toolName, toolUseId })];
    }
    case "content_block_delta": {
      const delta = event.delta;
      if (!isRecord(delta)) return [];
      if (delta.type === "text_delta") {
        const text = stringOf(delta.text);
        return text === undefined || text.length === 0
          ? []
          : [Object.freeze({ ...shared, kind: "text-delta", text })];
      }
      if (delta.type === "input_json_delta") {
        const partialJson = stringOf(delta.partial_json);
        return partialJson === undefined || partialJson.length === 0
          ? []
          : [Object.freeze({ ...shared, kind: "tool-input-delta", partialJson })];
      }
      // Never forward private thinking deltas to a product UI.
      return [];
    }
    case "content_block_stop": {
      const blockIndex = numberOf(event.index);
      return blockIndex === undefined
        ? []
        : [Object.freeze({ ...shared, blockIndex, kind: "content-block-stop" })];
    }
    case "message_stop":
      return [Object.freeze({ ...shared, kind: "turn-stop" })];
    default:
      return [];
  }
};

const decodeResult = (message: JsonRecord): readonly ClaudeStreamSignal[] => {
  const sessionId = stringOf(message.session_id);
  const subtype = stringOf(message.subtype);
  if (sessionId === undefined || subtype === undefined) return [];

  const stopReason = stringOf(message.stop_reason);
  const result = stringOf(message.result);
  const isError = message.is_error === true || subtype.startsWith("error_");
  const signals: ClaudeStreamSignal[] = [];
  const deferredTool = decodeDeferredTool(message.deferred_tool_use);
  const malformedDeferredTool = stopReason === "tool_deferred" && deferredTool === undefined;
  if (stopReason === "tool_deferred" && deferredTool !== undefined) {
    signals.push(Object.freeze({ deferredTool, kind: "approval-required", sessionId }));
  }
  signals.push(
    Object.freeze({
      isError: isError || malformedDeferredTool,
      kind: "result",
      ...(result === undefined ? {} : { result }),
      sessionId,
      ...(stopReason === undefined ? {} : { stopReason }),
      subtype,
    }),
  );
  return signals;
};

const decodeToolResults = (message: JsonRecord): readonly ClaudeStreamSignal[] => {
  const value = message.message;
  if (!isRecord(value) || !Array.isArray(value.content)) return [];
  const shared = session(message);
  return value.content.flatMap((content): readonly ClaudeStreamSignal[] => {
    if (!isRecord(content) || content.type !== "tool_result") return [];
    const toolUseId = stringOf(content.tool_use_id);
    if (toolUseId === undefined) return [];
    return [
      Object.freeze({
        ...shared,
        isError: content.is_error === true,
        kind: "tool-result",
        toolUseId,
      }),
    ];
  });
};

export const decodeClaudeStreamLine = (line: string): readonly ClaudeStreamSignal[] => {
  const source = line.trim();
  if (source.length === 0) return [];

  let value: unknown;
  try {
    value = JSON.parse(source) as unknown;
  } catch (cause) {
    throw new SyntaxError("Claude emitted invalid stream-json output.", { cause });
  }
  if (!isRecord(value)) return [];

  const type = stringOf(value.type);
  if (type === "system" && value.subtype === "init") {
    const sessionId = stringOf(value.session_id);
    if (sessionId === undefined) return [];
    const model = stringOf(value.model);
    return [
      Object.freeze({
        kind: "session-start",
        ...(model === undefined ? {} : { model }),
        sessionId,
      }),
    ];
  }
  if (type === "stream_event") return decodePartial(value);
  if (type === "user") return decodeToolResults(value);
  if (type === "result") return decodeResult(value);
  return type === undefined ? [] : [Object.freeze({ kind: "unhandled", type })];
};

export class ClaudeStreamDecoder {
  readonly #lines: string[] = [];
  #remainder = "";

  push(chunk: string): readonly ClaudeStreamSignal[] {
    const lines = `${this.#remainder}${chunk}`.split(/\r?\n/u);
    this.#remainder = lines.pop() ?? "";
    this.#lines.push(...lines);
    return this.#drain();
  }

  finish(): readonly ClaudeStreamSignal[] {
    if (this.#remainder.length > 0) this.#lines.push(this.#remainder);
    this.#remainder = "";
    return this.#drain();
  }

  #drain(): readonly ClaudeStreamSignal[] {
    return this.#lines.splice(0).flatMap(decodeClaudeStreamLine);
  }
}

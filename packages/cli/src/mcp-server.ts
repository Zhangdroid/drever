import type {
  DeckPreflightReport,
  DreverAuthoringContext,
  DreverCurrentPosition,
} from "@drever/schema";
import { createInterface } from "node:readline";
import { createCheckReport } from "./check.ts";
import { createAuthoringContext } from "./context.ts";
import { DreverCliError } from "./errors.ts";
import { readCurrentPosition } from "./current-position.ts";
import type { ResolvedDreverPlan } from "./project.ts";

export const MCP_PROTOCOL_VERSION = "2025-11-25";

type JsonRpcRequestId = string | number;
type JsonRpcResponseId = JsonRpcRequestId | null;

type JsonRpcResponse = Readonly<{
  jsonrpc: "2.0";
  id: JsonRpcResponseId;
  result?: unknown;
  error?: Readonly<{
    code: number;
    message: string;
    data?: unknown;
  }>;
}>;

type McpToolResult = Readonly<{
  content: readonly Readonly<{ type: "text"; text: string }>[];
  structuredContent?: object;
  isError?: boolean;
}>;

type McpToolDefinition = Readonly<{
  name: string;
  title: string;
  description: string;
  inputSchema: Readonly<Record<string, unknown>>;
  annotations: Readonly<Record<string, boolean>>;
}>;

type ToolDependencies = Readonly<{
  check(): Promise<DeckPreflightReport>;
  createContext(): Promise<DreverAuthoringContext>;
  readCurrent(): Promise<DreverCurrentPosition>;
  project: ResolvedDreverPlan;
}>;

const EMPTY_INPUT = Object.freeze({ type: "object", additionalProperties: false });
const READ_ONLY_ANNOTATIONS = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});

export const MCP_TOOLS: readonly McpToolDefinition[] = Object.freeze([
  {
    name: "drever_get_context",
    title: "Get Drever authoring context",
    description:
      "Return the complete resolved deck, exact slide and Step manifest, source ranges, design contract, plugins, and source preflight.",
    inputSchema: EMPTY_INPUT,
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: "drever_list_slides",
    title: "List Drever slides",
    description:
      "List every slide with its one-based number, stable id, title, exact sparse Step stops, note count, and source range.",
    inputSchema: EMPTY_INPUT,
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: "drever_get_slide",
    title: "Get one Drever slide",
    description:
      "Return one slide's exact authored source fragments, compiler manifest, speaker notes, and source locations.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        number: {
          type: "integer",
          minimum: 1,
          description: "One-based slide number from drever_list_slides.",
        },
      },
      required: ["number"],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: "drever_check",
    title: "Check Drever source",
    description:
      "Run Drever's source preflight and return stable accessibility diagnostics with exact authored locations.",
    inputSchema: EMPTY_INPUT,
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: "drever_get_current",
    title: "Get current Drever position",
    description:
      "Return the most recently updated open audience or speaker route from drever dev, or available=false when none is connected.",
    inputSchema: EMPTY_INPUT,
    annotations: READ_ONLY_ANNOTATIONS,
  },
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isJsonRpcId = (value: unknown): value is JsonRpcRequestId =>
  typeof value === "string" || Number.isSafeInteger(value);

const success = (id: JsonRpcRequestId, result: unknown): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  result,
});

const failure = (
  id: JsonRpcResponseId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  error: { code, message, ...(data === undefined ? {} : { data }) },
});

const structuredResult = (value: object): McpToolResult => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  structuredContent: value,
});

const describeError = (error: unknown): string => {
  if (error instanceof DreverCliError) {
    return [
      `[${error.code}] ${error.message}`,
      ...(error.hint === undefined ? [] : [`Hint: ${error.hint}`]),
    ].join("\n");
  }
  return error instanceof Error ? error.message : String(error);
};

const toolError = (error: unknown): McpToolResult => ({
  content: [{ type: "text", text: describeError(error) }],
  isError: true,
});

class ToolInputError extends Error {}

const requireEmptyArguments = (arguments_: Record<string, unknown>): void => {
  if (Object.keys(arguments_).length > 0) {
    throw new ToolInputError("This tool does not accept arguments.");
  }
};

const sourceRange = (slide: DreverAuthoringContext["deck"]["slides"][number]) => {
  const first = slide.source[0]?.range;
  const last = slide.source.at(-1)?.range;
  return first === undefined || last === undefined
    ? undefined
    : { path: first.path, start: first.start, end: last.end };
};

const executeTool = async (
  name: string,
  arguments_: Record<string, unknown>,
  dependencies: ToolDependencies,
): Promise<McpToolResult> => {
  try {
    if (name === "drever_get_context") {
      requireEmptyArguments(arguments_);
      return structuredResult(await dependencies.createContext());
    }
    if (name === "drever_list_slides") {
      requireEmptyArguments(arguments_);
      const context = await dependencies.createContext();
      return structuredResult({
        sourcePath: context.sourcePath,
        slides: context.deck.slides.map((slide) => {
          const range = sourceRange(slide);
          return {
            number: slide.index + 1,
            id: slide.id,
            index: slide.index,
            ...(slide.title === undefined ? {} : { title: slide.title }),
            stepStops: slide.stepStops,
            speakerNoteCount: slide.speakerNotes.length,
            ...(range === undefined ? {} : { sourceRange: range }),
          };
        }),
      });
    }
    if (name === "drever_get_slide") {
      if (
        Object.keys(arguments_).length !== 1 ||
        !Number.isSafeInteger(arguments_.number) ||
        (arguments_.number as number) < 1
      ) {
        throw new ToolInputError("number must be a one-based positive integer.");
      }
      const context = await dependencies.createContext();
      const number = arguments_.number as number;
      const slide = context.deck.slides[number - 1];
      if (slide === undefined) {
        throw new ToolInputError(
          `Slide ${number} is outside this deck's 1-${context.deck.slides.length} range.`,
        );
      }
      const { source, ...manifest } = slide;
      return structuredResult({
        number,
        ...manifest,
        source: source.map((fragment) => fragment.value).join(""),
        sourceFragments: source,
      });
    }
    if (name === "drever_check") {
      requireEmptyArguments(arguments_);
      const report = await dependencies.check();
      return structuredResult({
        valid: report.summary.errors === 0,
        ...report,
      });
    }
    if (name === "drever_get_current") {
      requireEmptyArguments(arguments_);
      try {
        const current = await dependencies.readCurrent();
        return structuredResult({
          available: true,
          ...current,
          slideNumber: current.position.slideIndex + 1,
        });
      } catch (error) {
        if (
          error instanceof DreverCliError &&
          error.code === "DREVER_CURRENT_POSITION_UNAVAILABLE"
        ) {
          return structuredResult({
            available: false,
            sourcePath: dependencies.project.entry,
            reason: "No audience or speaker window is connected to drever dev.",
          });
        }
        throw error;
      }
    }
    throw new TypeError(`Unknown tool: ${name}`);
  } catch (error) {
    if (error instanceof DreverCliError || error instanceof ToolInputError) {
      return toolError(error);
    }
    throw error;
  }
};

type ProtocolPhase = "new" | "waiting" | "ready";

const validateInitialize = (params: unknown): params is Record<string, unknown> =>
  isRecord(params) &&
  typeof params.protocolVersion === "string" &&
  isRecord(params.capabilities) &&
  isRecord(params.clientInfo) &&
  typeof params.clientInfo.name === "string" &&
  typeof params.clientInfo.version === "string";

const validateListTools = (params: unknown): boolean =>
  params === undefined || (isRecord(params) && Object.keys(params).length === 0);

const createProtocol = (dependencies: ToolDependencies) => {
  let phase: ProtocolPhase = "new";

  const handleRequest = async (
    id: JsonRpcRequestId,
    method: string,
    params: unknown,
  ): Promise<JsonRpcResponse> => {
    if (method === "ping") return success(id, {});
    if (method === "initialize") {
      if (phase !== "new") return failure(id, -32600, "Drever MCP is already initialized.");
      if (!validateInitialize(params)) return failure(id, -32602, "Invalid initialize params.");
      phase = "waiting";
      return success(id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: {
          name: "drever",
          title: "Drever",
          version: "0.0.0",
          description: "Read-only authoring context for one Drever presentation.",
        },
        instructions:
          "Use these read-only tools to inspect the resolved deck, exact slide source, preflight diagnostics, and live presentation position. Edit authored project files with your normal workspace tools.",
      });
    }
    if (phase !== "ready") return failure(id, -32002, "Drever MCP is not initialized.");
    if (method === "tools/list") {
      return validateListTools(params)
        ? success(id, { tools: MCP_TOOLS })
        : failure(id, -32602, "Invalid tools/list params.");
    }
    if (method === "tools/call") {
      if (
        !isRecord(params) ||
        typeof params.name !== "string" ||
        (params.arguments !== undefined && !isRecord(params.arguments))
      ) {
        return failure(id, -32602, "Invalid tools/call params.");
      }
      if (!MCP_TOOLS.some((tool) => tool.name === params.name)) {
        return failure(id, -32602, `Unknown tool: ${params.name}`);
      }
      try {
        return success(id, await executeTool(params.name, params.arguments ?? {}, dependencies));
      } catch (error) {
        return failure(id, -32603, "Internal error.", { message: describeError(error) });
      }
    }
    return failure(id, -32601, `Method not found: ${method}`);
  };

  const handleNotification = (method: string): void => {
    if (method === "notifications/initialized" && phase === "waiting") {
      phase = "ready";
    }
  };

  return {
    async handle(line: string): Promise<JsonRpcResponse | undefined> {
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch {
        return failure(null, -32700, "Parse error.");
      }
      if (!isRecord(value)) {
        return failure(null, -32600, "Invalid Request.");
      }
      const hasId = Object.hasOwn(value, "id");
      const responseId = hasId && isJsonRpcId(value.id) ? value.id : null;
      if (value.jsonrpc !== "2.0" || typeof value.method !== "string") {
        return failure(responseId, -32600, "Invalid Request.");
      }
      if (hasId && !isJsonRpcId(value.id)) {
        return failure(null, -32600, "Invalid Request.");
      }
      if (!hasId) {
        handleNotification(value.method);
        return;
      }
      return handleRequest(value.id as JsonRpcRequestId, value.method, value.params);
    },
  };
};

export type RunMcpServerRequest = Readonly<{
  project: ResolvedDreverPlan;
  input: NodeJS.ReadableStream;
  output: Pick<NodeJS.WriteStream, "write">;
  check?: () => Promise<DeckPreflightReport>;
  createContext?: () => Promise<DreverAuthoringContext>;
  readCurrent?: () => Promise<DreverCurrentPosition>;
}>;

/** Runs one newline-delimited MCP 2025-11-25 session over stdio-compatible streams. */
export const runMcpServer = async ({
  project,
  input,
  output,
  check = () => createCheckReport(project.entry),
  createContext = () => createAuthoringContext(project),
  readCurrent = () => readCurrentPosition(project.root),
}: RunMcpServerRequest): Promise<void> => {
  const protocol = createProtocol({ check, createContext, readCurrent, project });
  const lines = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY, terminal: false });
  for await (const line of lines) {
    const response = await protocol.handle(line);
    if (response !== undefined) {
      output.write(`${JSON.stringify(response)}\n`);
    }
  }
};

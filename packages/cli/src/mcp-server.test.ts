import type { DreverAuthoringContext, DreverCurrentPosition } from "@drever/schema";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vite-plus/test";
import { MCP_PROTOCOL_VERSION, MCP_TOOLS, runMcpServer } from "./mcp-server.ts";
import type { ResolvedDreverPlan } from "./project.ts";

const project = {
  entry: "/project/slides.mdx",
  root: "/project",
} as ResolvedDreverPlan;

const point = (line: number, offset: number) => ({ column: 1, line, offset });

const context = {
  version: 1,
  sourcePath: project.entry,
  canvas: { height: 900, width: 1_600 },
  deck: {
    version: 2,
    slides: [
      {
        id: "slide-1",
        index: 0,
        speakerNotes: [],
        stepStops: [],
        title: "Opening",
        source: [
          {
            value: "# Opening",
            range: {
              path: project.entry,
              start: point(1, 0),
              end: point(1, 9),
            },
          },
        ],
      },
      {
        id: "slide-2",
        index: 1,
        speakerNotes: [{ format: "markdown", plainText: "Explain.", value: "Explain." }],
        stepStops: [2, 5],
        title: "Decision",
        source: [
          {
            value: "## Decision\n\n<Step at={2}>Choose.</Step>",
            range: {
              path: project.entry,
              start: point(5, 20),
              end: point(7, 62),
            },
          },
        ],
      },
    ],
  },
  design: { theme: { id: "test" }, layouts: [], components: [], elements: [] },
  plugins: [],
  preflight: {
    version: 1,
    sourcePath: project.entry,
    slideCount: 2,
    summary: { errors: 0, info: 0, warnings: 0 },
    diagnostics: [],
  },
} as unknown as DreverAuthoringContext;

const current: DreverCurrentPosition = {
  version: 1,
  sourcePath: project.entry,
  surface: "speaker",
  route: "/speaker/2/5",
  position: { slideId: "slide-2", slideIndex: 1, step: 5 },
};

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "drever-test", version: "1.0.0" },
  },
};

const request = (id: number, method: string, params?: object) => ({
  jsonrpc: "2.0",
  id,
  method,
  ...(params === undefined ? {} : { params }),
});

const runProtocol = async (
  messages: readonly (object | string)[],
  dependencies: Readonly<{
    check?: () => Promise<DreverAuthoringContext["preflight"]>;
    createContext?: () => Promise<DreverAuthoringContext>;
    readCurrent?: () => Promise<DreverCurrentPosition>;
  }> = {},
): Promise<readonly Record<string, unknown>[]> => {
  let output = "";
  const source = `${messages
    .map((message) => (typeof message === "string" ? message : JSON.stringify(message)))
    .join("\n")}\n`;
  await runMcpServer({
    project,
    input: Readable.from([source]),
    output: { write: (chunk) => ((output += String(chunk)), true) },
    check: async () => context.preflight,
    ...dependencies,
  });
  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
};

describe("read-only MCP server", () => {
  it("negotiates the latest protocol and serves fresh structured deck tools", async () => {
    const createContext = vi.fn(async () => context);
    const readCurrent = vi.fn(async () => current);
    const responses = await runProtocol(
      [
        initialize,
        { jsonrpc: "2.0", method: "notifications/initialized" },
        request(2, "tools/list", {}),
        request(3, "tools/call", { name: "drever_get_context", arguments: {} }),
        request(4, "tools/call", { name: "drever_list_slides", arguments: {} }),
        request(5, "tools/call", {
          name: "drever_get_slide",
          arguments: { number: 2 },
        }),
        request(6, "tools/call", { name: "drever_check", arguments: {} }),
        request(7, "tools/call", { name: "drever_get_current", arguments: {} }),
        request(8, "ping"),
      ],
      { createContext, readCurrent },
    );

    expect(responses).toHaveLength(8);
    expect(responses[0]).toMatchObject({
      id: 1,
      result: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "drever", version: "0.0.0" },
      },
    });
    expect(responses[1]).toMatchObject({
      id: 2,
      result: {
        tools: MCP_TOOLS.map(({ name }) =>
          expect.objectContaining({
            name,
            annotations: expect.objectContaining({ readOnlyHint: true }),
          }),
        ),
      },
    });
    expect(responses[2]).toMatchObject({
      id: 3,
      result: {
        content: [{ type: "text", text: JSON.stringify(context, null, 2) }],
        structuredContent: context,
      },
    });
    expect(responses[3]).toMatchObject({
      id: 4,
      result: {
        structuredContent: {
          slides: [
            { number: 1, id: "slide-1", speakerNoteCount: 0 },
            { number: 2, id: "slide-2", speakerNoteCount: 1, stepStops: [2, 5] },
          ],
        },
      },
    });
    expect(responses[4]).toMatchObject({
      id: 5,
      result: {
        structuredContent: {
          number: 2,
          id: "slide-2",
          source: "## Decision\n\n<Step at={2}>Choose.</Step>",
        },
      },
    });
    expect(responses[5]).toMatchObject({
      id: 6,
      result: { structuredContent: { valid: true, ...context.preflight } },
    });
    expect(responses[6]).toMatchObject({
      id: 7,
      result: {
        structuredContent: { available: true, route: "/speaker/2/5", slideNumber: 2 },
      },
    });
    expect(responses[7]).toEqual({ jsonrpc: "2.0", id: 8, result: {} });
    expect(createContext).toHaveBeenCalledTimes(3);
    expect(readCurrent).toHaveBeenCalledOnce();
  });

  it("separates protocol errors from actionable tool execution errors", async () => {
    const responses = await runProtocol(
      [
        "{",
        request(1, "tools/list", {}),
        initialize,
        { jsonrpc: "2.0", method: "notifications/initialized" },
        request(2, "tools/call", { name: "drever_unknown", arguments: {} }),
        request(3, "tools/call", {
          name: "drever_get_slide",
          arguments: { number: 99 },
        }),
        { jsonrpc: "2.0", method: "notifications/unknown" },
        request(4, "unknown/method"),
        { jsonrpc: "2.0", id: "malformed" },
        [],
      ],
      { createContext: async () => context },
    );

    expect(responses).toHaveLength(8);
    expect(responses[0]).toMatchObject({ id: null, error: { code: -32700 } });
    expect(responses[1]).toMatchObject({ id: 1, error: { code: -32002 } });
    expect(responses[3]).toMatchObject({ id: 2, error: { code: -32602 } });
    expect(responses[4]).toMatchObject({
      id: 3,
      result: {
        isError: true,
        content: [{ text: expect.stringContaining("outside this deck's 1-2 range") }],
      },
    });
    expect(responses[5]).toMatchObject({ id: 4, error: { code: -32601 } });
    expect(responses[6]).toMatchObject({ id: "malformed", error: { code: -32600 } });
    expect(responses[7]).toMatchObject({ id: null, error: { code: -32600 } });
  });

  it("frames CRLF and split UTF-8 messages without leaking non-protocol output", async () => {
    const text = `${JSON.stringify({
      ...initialize,
      params: {
        ...initialize.params,
        clientInfo: { name: "演示客户端", version: "1.0.0" },
      },
    })}\r\n${JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    })}\r\n${JSON.stringify(request(2, "ping"))}`;
    const bytes = Buffer.from(text);
    const split = bytes.indexOf(Buffer.from("演")) + 1;
    let output = "";

    await runMcpServer({
      project,
      input: Readable.from([bytes.subarray(0, split), bytes.subarray(split)]),
      output: { write: (chunk) => ((output += String(chunk)), true) },
      check: async () => context.preflight,
      createContext: async () => context,
      readCurrent: async () => current,
    });

    const lines = output.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines.map((line) => JSON.parse(line))).toMatchObject([
      { id: 1, result: { protocolVersion: MCP_PROTOCOL_VERSION } },
      { id: 2, result: {} },
    ]);
  });

  it("rejects duplicate initialization and reserves internal errors for server bugs", async () => {
    const responses = await runProtocol(
      [
        initialize,
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { ...initialize, id: 2 },
        { jsonrpc: "2.0", id: null, method: "ping" },
        request(3, "tools/call", { name: "drever_get_context", arguments: {} }),
      ],
      {
        createContext: async () => {
          throw new TypeError("Unexpected context bug.");
        },
      },
    );

    expect(responses).toHaveLength(4);
    expect(responses[1]).toMatchObject({ id: 2, error: { code: -32600 } });
    expect(responses[2]).toMatchObject({ id: null, error: { code: -32600 } });
    expect(responses[3]).toMatchObject({
      id: 3,
      error: { code: -32603, data: { message: "Unexpected context bug." } },
    });
  });
});

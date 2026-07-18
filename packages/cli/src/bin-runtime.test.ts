import type { ViteDevServer } from "vite";
import { describe, expect, it, vi } from "vite-plus/test";
import { handleCliResult, type CliProcess } from "./bin-runtime.ts";

const createProcess = (): Readonly<{
  handlers: Map<NodeJS.Signals, (signal: NodeJS.Signals) => void>;
  kill: ReturnType<typeof vi.fn>;
  process: CliProcess;
}> => {
  const handlers = new Map<NodeJS.Signals, (signal: NodeJS.Signals) => void>();
  const kill = vi.fn(() => true);
  const process = {
    exitCode: undefined,
    kill,
    once: vi.fn((signal: NodeJS.Signals, handler: (signal: NodeJS.Signals) => void) => {
      handlers.set(signal, handler);
      return process;
    }),
    pid: 42,
  } as unknown as CliProcess;
  return { handlers, kill, process };
};

describe("handleCliResult", () => {
  it("applies an explicit failed check outcome without installing server handlers", () => {
    const runtime = createProcess();

    handleCliResult(1, runtime.process);

    expect(runtime.process.exitCode).toBe(1);
    expect(runtime.handlers.size).toBe(0);
    expect(runtime.kill).not.toHaveBeenCalled();
  });

  it("keeps the development server signal lifecycle unchanged", async () => {
    const runtime = createProcess();
    const close = vi.fn(async () => {});
    const server = { close } as unknown as ViteDevServer;

    handleCliResult(server, runtime.process);
    runtime.handlers.get("SIGINT")?.("SIGINT");
    runtime.handlers.get("SIGTERM")?.("SIGTERM");
    await vi.waitFor(() => expect(runtime.kill).toHaveBeenCalledOnce());

    expect(close).toHaveBeenCalledOnce();
    expect(runtime.kill).toHaveBeenCalledWith(42, "SIGINT");
  });
});

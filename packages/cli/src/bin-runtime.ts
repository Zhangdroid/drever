import type { RunCliResult } from "./cli.ts";

export type CliProcess = Pick<NodeJS.Process, "exitCode" | "kill" | "once" | "pid">;

/** Applies a finite command outcome or owns the signal lifecycle of a development server. */
export const handleCliResult = (result: RunCliResult, target: CliProcess = process): void => {
  if (typeof result === "number") {
    target.exitCode = result;
    return;
  }
  if (result === undefined) {
    return;
  }

  const server = result;
  let closing = false;
  const close = (signal: NodeJS.Signals): void => {
    if (closing) {
      return;
    }
    closing = true;
    void server.close().finally(() => {
      target.kill(target.pid, signal);
    });
  };
  target.once("SIGINT", close);
  target.once("SIGTERM", close);
};

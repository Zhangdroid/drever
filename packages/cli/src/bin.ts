#!/usr/bin/env node

import { formatCliError } from "./errors.ts";
import { runCli } from "./cli.ts";

try {
  const server = await runCli(process.argv.slice(2));
  if (server !== undefined) {
    let closing = false;
    const close = (signal: NodeJS.Signals): void => {
      if (closing) {
        return;
      }
      closing = true;
      void server.close().finally(() => {
        process.kill(process.pid, signal);
      });
    };
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
  }
} catch (error) {
  process.stderr.write(`${formatCliError(error)}\n`);
  process.exitCode = 1;
}

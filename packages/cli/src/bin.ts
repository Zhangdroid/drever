#!/usr/bin/env node

import { formatCliError } from "./errors.ts";
import { handleCliResult } from "./bin-runtime.ts";
import { runCli } from "./cli.ts";

try {
  const result = await runCli(process.argv.slice(2));
  handleCliResult(result);
} catch (error) {
  process.stderr.write(`${formatCliError(error)}\n`);
  process.exitCode = 1;
}
